"use server";

import { redirect } from "next/navigation";

import { Prisma } from "@/lib/generated/prisma/client";
import { claimInvitation, findOpenInvitation, invitationToken } from "@/lib/invitations";
import {
  createOrganizationWithOwner,
  isOrganizationNameTaken,
  normalizeOrganizationName,
} from "@/lib/organizations";
import { safeNextPath } from "@/lib/next-path";
import { clientIp, rateLimit, tooManyAttempts } from "@/lib/rate-limit";
import { hashPassword, verifyNothing, verifyPassword } from "@/lib/password";
import { getPrisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { setFlash } from "@/lib/set-flash";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function fail(path: string, message: string): Promise<never> {
  await setFlash({ type: "error", message });
  redirect(path);
}

// Limits per window. Password checks are counted per email across login and
// sign-up (which checks an existing account's password too), so guessing
// one account's password stays slow whichever form is used.
const LIMITS = {
  passwordPerEmail: { limit: 10, windowSeconds: 15 * 60 },
  loginPerIp: { limit: 50, windowSeconds: 15 * 60 },
  signUpPerIp: { limit: 10, windowSeconds: 60 * 60 },
  nameCheckPerIp: { limit: 30, windowSeconds: 10 * 60 },
};

/**
 * Counts an attempt against each key and returns the "too many attempts"
 * message if any is over its limit. Keys without an IP (no proxy header) are
 * skipped rather than shared, so one visitor can't lock everyone out.
 */
async function checkLimits(
  checks: { key: string | null; limit: number; windowSeconds: number }[]
) {
  for (const { key, limit, windowSeconds } of checks) {
    if (!key) continue;
    const result = await rateLimit(key, limit, windowSeconds);
    if (!result.allowed) return tooManyAttempts(result.retryAfterSeconds);
  }
  return null;
}

function ipKey(scope: string, ip: string | null) {
  return ip ? `${scope}:ip:${ip}` : null;
}

function nextPath(formData: FormData) {
  return safeNextPath(field(formData, "next"));
}

// Back to the form, keeping where to go after signing in.
function formPath(path: string, next: string | null) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export type OrganizationCheck = { message: string; name?: string; available?: string };

/** Sign-up step 1: whether the organization name is still free. */
export async function checkOrganizationName(
  _previous: OrganizationCheck,
  formData: FormData
): Promise<OrganizationCheck> {
  const name = normalizeOrganizationName(field(formData, "organization"));
  if (!name) return { message: "Enter your organization's name." };
  const limited = await checkLimits([
    { key: ipKey("name-check", await clientIp()), ...LIMITS.nameCheckPerIp },
  ]);
  if (limited) return { message: limited, name };
  if (await isOrganizationNameTaken(name)) {
    return { message: `${name} is already taken. Try another name.`, name };
  }
  return { message: "", available: name };
}

export type SignUpState = {
  message: string;
  /** Set when the organization name was taken after step 1: go back to it. */
  organizationTaken?: boolean;
  name?: string;
  email?: string;
};

// Thrown inside the sign-up transaction to undo it when the invitation was
// used by someone else first.
class InvitationGone extends Error {}

/**
 * Sign-up step 2. From an invitation link it accepts the invitation with its
 * role; otherwise it creates the organization with the user as owner. An
 * email that already has an account can still do either with that account's
 * password, unless it's creating an organization and already owns one.
 * Errors come back to the form so it keeps what was typed.
 */
export async function signUp(
  _previous: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const name = field(formData, "name").slice(0, 100);
  const organizationName = normalizeOrganizationName(field(formData, "organization"));
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = nextPath(formData);
  const error = (message: string): SignUpState => ({ message, name, email });
  const taken: SignUpState = {
    message: `${organizationName} was just taken. Pick another name.`,
    organizationTaken: true,
  };
  const token = invitationToken(next);
  const gone = error("This invitation can't be used any more. Ask for a new link.");

  if (!token && !organizationName) {
    return { message: "Enter your organization's name.", organizationTaken: true };
  }
  if (!name) return error("Enter your name.");
  if (!EMAIL.test(email)) return error("Enter a valid email address.");
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return error(`Use a password of at least ${MIN_PASSWORD} characters.`);
  }

  const limited = await checkLimits([
    { key: ipKey("sign-up", await clientIp()), ...LIMITS.signUpPerIp },
    { key: `password:email:${email}`, ...LIMITS.passwordPerEmail },
  ]);
  if (limited) return error(limited);

  const invitation = token ? await findOpenInvitation(token) : null;
  if (token && !invitation) return gone;
  if (invitation && invitation.email.toLowerCase() !== email) {
    return error(`This invitation is for ${invitation.email}. Use that address.`);
  }

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      deletedAt: true,
      authAccounts: { where: { provider: "password" }, select: { passwordHash: true } },
      memberships: {
        where: {
          status: "active",
          role: { key: "owner", organizationId: null },
          organization: { deletedAt: null },
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (existing) {
    if (existing.deletedAt) return error("This account has been closed.");
    if (!invitation && existing.memberships.length) {
      return error("This email already owns an organization. Log in instead.");
    }
    const hash = existing.authAccounts[0]?.passwordHash;
    const valid = hash ? await verifyPassword(password, hash) : await verifyNothing(password);
    if (!valid) {
      return error(
        "An account with this email already exists. Enter its password to continue."
      );
    }
  }
  if (!invitation && (await isOrganizationNameTaken(organizationName))) return taken;

  const passwordHash = existing ? null : await hashPassword(password);

  // The user (if new), their sign-in method and their membership are created
  // together or not at all.
  const created = await prisma.$transaction(async (tx) => {
    let userId = existing?.id;
    if (userId) {
      await tx.user.update({ where: { id: userId }, data: { lastSignInAt: new Date() } });
    } else {
      const user = await tx.user.create({
        data: { email, name, lastSignInAt: new Date() },
        select: { id: true },
      });
      userId = user.id;
      await tx.authAccount.create({
        data: { userId, provider: "password", providerAccountId: userId, passwordHash },
      });
    }
    if (invitation) {
      if (!(await claimInvitation(tx, invitation, userId))) throw new InvitationGone();
      return { userId, organizationId: invitation.organization.id };
    }
    const organization = await createOrganizationWithOwner(tx, { name: organizationName, userId });
    return { userId, organizationId: organization.id };
  }).catch((error: unknown) => {
    if (error instanceof InvitationGone) return "gone" as const;
    // Someone took the email or organization name between the check and the insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  });
  if (created === "gone") return gone;
  if (!created) {
    return !invitation && (await isOrganizationNameTaken(organizationName))
      ? taken
      : error("An account with this email was just created. Log in instead.");
  }

  await createSession(created.userId, created.organizationId);
  await setFlash({
    type: "success",
    message: invitation
      ? `You joined ${invitation.organization.name} as ${invitation.role.name}.`
      : `Welcome! ${organizationName} is ready.`,
  });
  redirect("/dashboard");
}

export async function login(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "").slice(0, MAX_PASSWORD);
  const invalid = "Incorrect email or password.";
  const next = nextPath(formData);
  const back = formPath("/login", next);

  if (!email || !password) return fail(back, invalid);
  const limited = await checkLimits([
    { key: ipKey("login", await clientIp()), ...LIMITS.loginPerIp },
    { key: `password:email:${email}`, ...LIMITS.passwordPerEmail },
  ]);
  if (limited) return fail(back, limited);

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      deletedAt: true,
      authAccounts: { where: { provider: "password" }, select: { passwordHash: true } },
    },
  });
  const passwordHash = user && !user.deletedAt ? user.authAccounts[0]?.passwordHash : null;
  const valid = passwordHash
    ? await verifyPassword(password, passwordHash)
    : await verifyNothing(password);
  if (!user || !valid) return fail(back, invalid);

  // Resume in the oldest organization they're in.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "active", organization: { deletedAt: null } },
    orderBy: { joinedAt: "asc" },
    select: { organizationId: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
  await createSession(user.id, membership?.organizationId ?? null);
  redirect(next ?? "/dashboard");
}

export async function signOut() {
  await deleteSession();
  redirect("/login");
}
