"use server";

import { revalidatePath } from "next/cache";

import { normalizePhone } from "@/lib/dealers";
import { isEmail } from "@/lib/email";
import {
  isUniqueViolation,
  isUuid,
  memberWith,
  notAllowed,
  readText,
  type ActionResult,
} from "@/lib/inventory";
import { createInvitation } from "@/lib/invitations";
import { assignableRoles, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

function revalidateSalespeople() {
  revalidatePath("/salespeople");
  revalidatePath("/transfers");
  revalidatePath("/deliveries");
}

export type SalespersonResult = ActionResult & { link?: string; email?: string };

/**
 * Adds a salesperson, or edits one when the form carries its id. A new
 * salesperson is a member too: someone already on Members is linked straight
 * away, anyone else gets an invitation whose link comes back to share.
 */
export async function saveSalesperson(
  _previous: SalespersonResult,
  formData: FormData
): Promise<SalespersonResult> {
  const member = await memberWith("salespeople.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const name = readText(formData.get("name"));
  const typedPhone = readText(formData.get("phone"), 40);
  const phone = typedPhone ? normalizePhone(typedPhone) : null;
  const email = readText(formData.get("email"))?.toLowerCase() ?? null;
  const zoneKey = readText(formData.get("zoneKey"), 100);
  if (!name) return { message: "Enter the salesperson's name." };
  if (typedPhone && !phone) return { message: "Enter a phone number like 0754 123 456, or leave it empty." };
  if (email && !isEmail(email)) return { message: "Enter a valid email address." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  if (
    zoneKey &&
    !(await prisma.zone.findUnique({ where: { organizationId_key: { organizationId, key: zoneKey } } }))
  ) {
    return { message: "Pick the zone from the list." };
  }

  const data = { name, phone, email, zoneKey, notes: readText(formData.get("notes"), 1000) };
  const result = id
    ? await editSalesperson(member, id, data, readText(formData.get("userId"), 100))
    : await addSalesperson(member, data, readText(formData.get("roleId"), 100));
  if (result.success) revalidateSalespeople();
  return result;
}

type SalespersonData = {
  name: string;
  phone: string | null;
  email: string | null;
  zoneKey: string | null;
  notes: string | null;
};

async function addSalesperson(
  member: ActiveMember,
  data: SalespersonData,
  roleId: string | null
): Promise<SalespersonResult> {
  if (!member.permissions.has("members.invite")) {
    return { message: "Adding a salesperson makes them a member, so you need permission to invite people." };
  }
  const { email } = data;
  if (!email) return { message: "Enter their email: it's what they sign in with." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  const [membership, invited] = await Promise.all([
    prisma.membership.findFirst({
      where: { organizationId, user: { email } },
      select: { status: true, userId: true },
    }),
    prisma.invitation.findFirst({
      where: { organizationId, email, status: "pending", salesperson: { isNot: null } },
      select: { salesperson: { select: { name: true } } },
    }),
  ]);

  try {
    // Already a member: they sign in as the salesperson from now on.
    if (membership) {
      if (membership.status !== "active") return { message: `${email} is on Members but suspended.` };
      const linked = await prisma.salesperson.findFirst({
        where: { organizationId, userId: membership.userId },
        select: { name: true },
      });
      if (linked) return { message: `${email} already signs in as ${linked.name}.` };
      await prisma.salesperson.create({ data: { ...data, organizationId, userId: membership.userId } });
      return { success: true, message: `${data.name} added. They sign in as ${email}.` };
    }

    if (invited?.salesperson) {
      return { message: `${email} is already invited as ${invited.salesperson.name}.` };
    }
    const role = (await assignableRoles(member)).find((role) => role.id === roleId);
    if (!role) return { message: "Pick a role you're allowed to give." };
    const { link } = await prisma.$transaction(async (tx) => {
      const invitation = await createInvitation(tx, {
        organizationId,
        email,
        name: data.name,
        phone: data.phone,
        roleId: role.id,
        invitedById: member.userId,
      });
      await tx.salesperson.create({ data: { ...data, organizationId, invitationId: invitation.id } });
      return invitation;
    });
    revalidatePath("/members");
    return { success: true, message: `${data.name} added and invited.`, link, email };
  } catch (error) {
    if (isUniqueViolation(error)) return { message: `There's already a salesperson called ${data.name}.` };
    throw error;
  }
}

async function editSalesperson(
  member: ActiveMember,
  id: string,
  data: SalespersonData,
  userId: string | null
): Promise<SalespersonResult> {
  const prisma = getPrisma();
  const organizationId = member.organization.id;

  // The login must belong to an active member, and to no other salesperson.
  if (userId) {
    if (!isUuid(userId)) return { message: "Pick the login from the list of members." };
    const [membership, linked] = await Promise.all([
      prisma.membership.findFirst({
        where: { organizationId, userId, status: "active" },
        select: { id: true },
      }),
      prisma.salesperson.findFirst({
        where: { organizationId, userId, id: { not: id } },
        select: { name: true },
      }),
    ]);
    if (!membership) return { message: "Pick the login from the list of members." };
    if (linked) return { message: `That login is already linked to ${linked.name}.` };
  }

  try {
    const { count } = await prisma.salesperson.updateMany({
      where: { id, organizationId },
      data: { ...data, userId },
    });
    if (!count) return { message: "That salesperson no longer exists." };
  } catch (error) {
    // The login was checked above, so a clash here is almost always the name.
    if (isUniqueViolation(error)) return { message: `There's already a salesperson called ${data.name}, or that login is taken.` };
    throw error;
  }
  return { success: true, message: `${data.name} saved.` };
}

/** Inactive salespeople can't be sent stock; their transfers stay on record. */
export async function setSalespersonActive(id: string, active: boolean): Promise<ActionResult> {
  const member = await memberWith("salespeople.manage");
  if (!member) return notAllowed;

  const { count } = await getPrisma().salesperson.updateMany({
    where: { id, organizationId: member.organization.id },
    data: { deactivatedAt: active ? null : new Date() },
  });
  if (!count) return { message: "That salesperson no longer exists." };

  revalidateSalespeople();
  return { success: true, message: active ? "Salesperson reactivated." : "Salesperson deactivated." };
}
