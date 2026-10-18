"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/lib/generated/prisma/client";
import { assignableRoles, readActiveMember, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";

// Every action re-reads the session and membership: the page only hides
// controls, it doesn't authorize anything.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITATION_DAYS = 7;

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

export async function inviteMember(
  _previous: InviteState,
  formData: FormData
): Promise<InviteState> {
  const member = await memberWith("members.invite");
  if (!member) return notAllowed;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { message: "Enter a valid email address." };

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

  const role = await findRole(member, roleId);
  if (!role) return { message: "Pick a role you're allowed to give." };

  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx): Promise<Result> => {
    const target = await tx.membership.findFirst({
      where: { id: membershipId, organizationId: member.organization.id },
      select: { role: { select: { key: true } } },
    });
    if (!target) return { message: "That member is no longer here." };
    if (target.role.key === "owner" && member.role.key !== "owner") {
      return { message: "Only an owner can change an owner's role." };
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
