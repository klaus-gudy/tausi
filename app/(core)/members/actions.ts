"use server";

import { revalidatePath } from "next/cache";

import { normalizePhone } from "@/lib/dealers";
import { isEmail } from "@/lib/email";
import { Prisma } from "@/lib/generated/prisma/client";
import { createInvitation } from "@/lib/invitations";
import { assignableRoles, readActiveMember, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { releaseSalesperson, syncSalesperson } from "@/lib/salespeople";

// Every action re-reads the session and membership: the page only hides
// controls, it doesn't authorize anything.

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
  if (!isEmail(email)) return { message: "Enter a valid email address." };
  const contact = readContact(formData);
  if (contact.error !== null) return { message: contact.error };

  const role = await findRole(member, String(formData.get("roleId") ?? ""));
  if (!role) return { message: "Pick a role you're allowed to give." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  // Someone invited before is invited again with a new link.
  const existing = await prisma.membership.findFirst({
    where: { organizationId, user: { email }, status: { not: "invited" } },
    select: { id: true },
  });
  if (existing) return { message: `${email} is already a member.` };

  let link: string;
  try {
    ({ link } = await prisma.$transaction((tx) =>
      createInvitation(tx, {
        organizationId,
        email,
        name: contact.name,
        phone: contact.phone,
        roleId: role.id,
        invitedById: member.userId,
      })
    ));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "That invitation was just sent. Try again in a moment." };
    }
    throw error;
  }

  revalidatePath("/members");
  return { success: true, message: `Invitation link created for ${email}.`, link, email };
}

/**
 * Takes back an invitation: the invited member goes, and so does their user
 * when it was only made for this invitation.
 */
export async function revokeInvitation(membershipId: string): Promise<Result> {
  const member = await memberWith("members.invite");
  if (!member) return notAllowed;

  const organizationId = member.organization.id;
  const result = await getPrisma().$transaction(async (tx): Promise<Result> => {
    const target = await tx.membership.findFirst({
      where: { id: membershipId, organizationId, status: "invited" },
      select: {
        userId: true,
        user: { select: { email: true, authAccounts: { select: { id: true }, take: 1 } } },
      },
    });
    if (!target) return { message: "That invitation is no longer pending." };
    const blocked = await releaseSalesperson(tx, membershipId);
    if (blocked) return { message: blocked };

    await tx.invitation.updateMany({
      where: { organizationId, email: target.user.email, status: "pending" },
      data: { status: "revoked" },
    });
    await tx.membership.delete({ where: { id: membershipId } });
    if (!target.user.authAccounts.length && !(await tx.membership.count({ where: { userId: target.userId } }))) {
      await tx.user.delete({ where: { id: target.userId } });
    }
    return { success: true, message: "Invitation revoked." };
  });

  if (result.success) {
    revalidatePath("/members");
    revalidatePath("/salespeople");
  }
  return result;
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
    await syncSalesperson(tx, membershipId);
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
    select: { userId: true, roleId: true, role: { select: { key: true } } },
  });
  if (!target) return { message: "That member is no longer here." };
  if (target.role.key === "owner" && member.role.key !== "owner") {
    return { message: "Only an owner can edit an owner." };
  }

  if (roleId && roleId !== target.roleId) {
    const changed = await changeMemberRole(membershipId, roleId);
    if (!changed.success) return changed;
  }
  // Their name is their user's, the same in every organization they're in.
  await prisma.$transaction([
    prisma.membership.update({ where: { id: membershipId }, data: { phone: contact.phone } }),
    ...(contact.name
      ? [prisma.user.update({ where: { id: target.userId }, data: { name: contact.name } })]
      : []),
  ]);

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
    const blocked = await releaseSalesperson(tx, membershipId);
    if (blocked) return { message: blocked };
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
