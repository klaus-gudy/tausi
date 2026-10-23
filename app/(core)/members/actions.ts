"use server";

import { revalidatePath } from "next/cache";

import { normalizePhone } from "@/lib/dealers";
import { Prisma } from "@/lib/generated/prisma/client";
import { assignableRoles, readActiveMember, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";

// Every action re-reads the session and membership: the page only hides
// controls, it doesn't authorize anything.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITATION_DAYS = 7;
const MAX_NAME = 100;

type Result = { success?: boolean; message: string };
export type InviteState = Result & { link?: string; email?: string };

async function memberWith(permission: string) {
  const member = await readActiveMember();
  return member?.permissions.has(permission) ? member : null;
}

const notAllowed = { message: "You don't have permission to do that." };

/** Whether the organization would still have an active owner without this membership. */
async function hasOtherOwner(
  tx: Prisma.TransactionClient,
  organizationId: string,
  membershipId: string
) {
  // Serialize owner changes per organization, so two concurrent demotions
  // can't each count the other as the remaining owner.
  await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
  const owners = await tx.membership.count({
    where: {
      organizationId,
      id: { not: membershipId },
      status: "active",
      role: { key: "owner", organizationId: null },
    },
  });
  return owners > 0;
}

/** Points the user's sessions in this organization at another one they're in, if any. */
async function moveSessionsOut(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string
) {
  const other = await tx.membership.findFirst({
    where: {
      userId,
      status: "active",
      organizationId: { not: organizationId },
      organization: { deletedAt: null },
    },
    orderBy: { joinedAt: "asc" },
    select: { organizationId: true },
  });
  await tx.session.updateMany({
    where: { userId, activeOrganizationId: organizationId },
    data: { activeOrganizationId: other?.organizationId ?? null },
  });
}

async function findRole(member: ActiveMember, roleId: string) {
  const roles = await assignableRoles(member);
  return roles.find((role) => role.id === roleId) ?? null;
}

/** The form's name and phone, with the phone in +255 form; an error message when it isn't a number. */
function readContact(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME) || null;
  const typed = String(formData.get("phone") ?? "").trim();
  const phone = typed ? normalizePhone(typed) : null;
  if (typed && !phone) return { error: "Enter a valid phone number, like 0754 123 456." };
  return { name, phone, error: null };
}

export async function inviteMember(
  _previous: InviteState,
  formData: FormData
): Promise<InviteState> {
  const member = await memberWith("members.invite");
  if (!member) return notAllowed;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { message: "Enter a valid email address." };
  const contact = readContact(formData);
  if (contact.error !== null) return { message: contact.error };

  const role = await findRole(member, String(formData.get("roleId") ?? ""));
  if (!role) return { message: "Pick a role you're allowed to give." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  const existing = await prisma.membership.findFirst({
    where: { organizationId, user: { email } },
    select: { id: true },
  });
  if (existing) return { message: `${email} is already a member.` };

  const { token, tokenHash } = createToken();
  try {
    await prisma.$transaction(async (tx) => {
      // Inviting the same address again replaces the earlier link.
      await tx.invitation.updateMany({
        where: { organizationId, email, status: "pending" },
        data: { status: "revoked" },
      });
      await tx.invitation.create({
        data: {
          organizationId,
          email,
          name: contact.name,
          phone: contact.phone,
          roleId: role.id,
          tokenHash,
          invitedById: member.userId,
          expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "That invitation was just sent. Try again in a moment." };
    }
    throw error;
  }

  // No email is sent yet: the dialog shows the link for the inviter to share.
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invite/${token}`;

  revalidatePath("/members");
  return { success: true, message: `Invitation link created for ${email}.`, link, email };
}

export async function revokeInvitation(invitationId: string): Promise<Result> {
  const member = await memberWith("members.invite");
  if (!member) return notAllowed;

  const { count } = await getPrisma().invitation.updateMany({
    where: { id: invitationId, organizationId: member.organization.id, status: "pending" },
    data: { status: "revoked" },
  });
  if (!count) return { message: "That invitation is no longer pending." };

  revalidatePath("/members");
  return { success: true, message: "Invitation revoked." };
}

export async function changeMemberRole(membershipId: string, roleId: string): Promise<Result> {
  const member = await memberWith("members.update");
  if (!member) return notAllowed;

  const roles = await assignableRoles(member);
  const role = roles.find((role) => role.id === roleId);
  if (!role) return { message: "Pick a role you're allowed to give." };

  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx): Promise<Result> => {
    const target = await tx.membership.findFirst({
      where: { id: membershipId, organizationId: member.organization.id },
      select: { role: { select: { id: true, key: true } } },
    });
    if (!target) return { message: "That member is no longer here." };
    if (target.role.key === "owner" && member.role.key !== "owner") {
      return { message: "Only an owner can change an owner's role." };
    }
    // Their role can do things you can't, so you couldn't give it back.
    if (!roles.some((role) => role.id === target.role.id)) {
      return { message: "Only someone with every permission of their role can change it." };
    }
    if (
      target.role.key === "owner" &&
      role.key !== "owner" &&
      !(await hasOtherOwner(tx, member.organization.id, membershipId))
    ) {
      return { message: "Make someone else an owner first." };
    }
    await tx.membership.update({ where: { id: membershipId }, data: { roleId: role.id } });
    return { success: true, message: `Role changed to ${role.name}.` };
  });

  if (result.success) revalidatePath("/", "layout");
  return result;
}

/**
 * Saves a member's name, phone and role from the edit dialog. The role goes
 * through changeMemberRole, so the same rules about owners apply.
 */
export async function updateMember(_previous: Result, formData: FormData): Promise<Result> {
  const member = await memberWith("members.update");
  if (!member) return notAllowed;

  const membershipId = String(formData.get("id") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const contact = readContact(formData);
  if (contact.error !== null) return { message: contact.error };

  const prisma = getPrisma();
  const target = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: member.organization.id },
    select: { roleId: true, role: { select: { key: true } } },
  });
  if (!target) return { message: "That member is no longer here." };
  if (target.role.key === "owner" && member.role.key !== "owner") {
    return { message: "Only an owner can edit an owner." };
  }

  if (roleId && roleId !== target.roleId) {
    const changed = await changeMemberRole(membershipId, roleId);
    if (!changed.success) return changed;
  }
  await prisma.membership.update({
    where: { id: membershipId },
    data: { name: contact.name, phone: contact.phone },
  });

  revalidatePath("/members");
  return { success: true, message: "Member saved." };
}

/** Removes a member, or lets members leave on their own without permission. */
export async function removeMember(membershipId: string): Promise<Result> {
  const member = await readActiveMember();
  if (!member) return notAllowed;
  const leaving = membershipId === member.membershipId;
  if (!leaving && !member.permissions.has("members.remove")) return notAllowed;

  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx): Promise<Result> => {
    const target = await tx.membership.findFirst({
      where: { id: membershipId, organizationId: member.organization.id },
      select: { userId: true, role: { select: { key: true } } },
    });
    if (!target) return { message: "That member is no longer here." };
    if (target.role.key === "owner" && !leaving && member.role.key !== "owner") {
      return { message: "Only an owner can remove an owner." };
    }
    if (
      target.role.key === "owner" &&
      !(await hasOtherOwner(tx, member.organization.id, membershipId))
    ) {
      return { message: "Make someone else an owner first." };
    }
    await tx.membership.delete({ where: { id: membershipId } });
    await moveSessionsOut(tx, target.userId, member.organization.id);
    return {
      success: true,
      message: leaving ? `You left ${member.organization.name}.` : "Member removed.",
    };
  });

  if (result.success) revalidatePath("/", "layout");
  return result;
}
