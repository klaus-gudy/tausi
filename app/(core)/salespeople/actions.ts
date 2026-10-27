"use server";

import { revalidatePath } from "next/cache";

import { normalizePhone } from "@/lib/dealers";
import { isEmail } from "@/lib/email";
import {
  isUniqueViolation,
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
 * Adds a salesperson, or edits one when the form carries its id. A
 * salesperson is a member plus the zone they cover, so adding someone new
 * adds them as an invited member (the link to share comes back); someone
 * already on Members just becomes a salesperson.
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
  const zoneKey = readText(formData.get("zoneKey"), 100);
  const notes = readText(formData.get("notes"), 1000);
  if (!name) return { message: "Enter the salesperson's name." };
  if (typedPhone && !phone) return { message: "Enter a phone number like 0754 123 456, or leave it empty." };

  const organizationId = member.organization.id;
  if (
    zoneKey &&
    !(await getPrisma().zone.findUnique({ where: { organizationId_key: { organizationId, key: zoneKey } } }))
  ) {
    return { message: "Pick the zone from the list." };
  }

  const person = { name, phone, zoneKey, notes };
  const result = id
    ? await editSalesperson(member, id, person)
    : await addSalesperson(
        member,
        person,
        readText(formData.get("email"))?.toLowerCase() ?? null,
        readText(formData.get("roleId"), 100)
      );
  if (result.success) revalidateSalespeople();
  return result;
}

type Person = { name: string; phone: string | null; zoneKey: string | null; notes: string | null };

async function addSalesperson(
  member: ActiveMember,
  { name, phone, zoneKey, notes }: Person,
  email: string | null,
  roleId: string | null
): Promise<SalespersonResult> {
  if (!member.permissions.has("members.invite")) {
    return { message: "Adding a salesperson makes them a member, so you need permission to invite people." };
  }
  if (!email || !isEmail(email)) return { message: "Enter their email: it's what they sign in with." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  const existing = await prisma.membership.findFirst({
    where: { organizationId, user: { email } },
    select: { id: true, status: true, salesperson: { select: { id: true } } },
  });
  if (existing?.salesperson) return { message: `${email} is already a salesperson.` };

  // Already on Members: they become a salesperson with the role they have.
  if (existing && existing.status !== "invited") {
    if (existing.status === "suspended") return { message: `${email} is on Members but suspended.` };
    await prisma.$transaction([
      prisma.salesperson.create({ data: { organizationId, membershipId: existing.id, zoneKey, notes } }),
      ...(phone ? [prisma.membership.update({ where: { id: existing.id }, data: { phone } })] : []),
    ]);
    return { success: true, message: `${name} added. They sign in as ${email}.` };
  }

  const role = (await assignableRoles(member)).find((role) => role.id === roleId);
  if (!role) return { message: "Pick a role you're allowed to give." };
  try {
    const { link } = await prisma.$transaction(async (tx) => {
      const invitation = await createInvitation(tx, {
        organizationId,
        email,
        name,
        phone,
        roleId: role.id,
        invitedById: member.userId,
      });
      await tx.salesperson.create({
        data: { organizationId, membershipId: invitation.membershipId, zoneKey, notes },
      });
      return invitation;
    });
    revalidatePath("/members");
    return { success: true, message: `${name} added and invited.`, link, email };
  } catch (error) {
    // Added twice at once: the second one finds the first's salesperson.
    if (isUniqueViolation(error)) return { message: `${email} was just added. Check the list.` };
    throw error;
  }
}

/** Name goes to the user, phone to the membership, the rest to the salesperson. */
async function editSalesperson(
  member: ActiveMember,
  id: string,
  { name, phone, zoneKey, notes }: Person
): Promise<SalespersonResult> {
  const prisma = getPrisma();
  const salesperson = await prisma.salesperson.findFirst({
    where: { id, organizationId: member.organization.id },
    select: { membership: { select: { id: true, userId: true } } },
  });
  if (!salesperson) return { message: "That salesperson no longer exists." };
  const { membership } = salesperson;

  await prisma.$transaction([
    prisma.salesperson.update({ where: { id }, data: { zoneKey, notes } }),
    prisma.membership.update({ where: { id: membership.id }, data: { phone } }),
    prisma.user.update({ where: { id: membership.userId }, data: { name } }),
  ]);
  revalidatePath("/members");
  return { success: true, message: `${name} saved.` };
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
