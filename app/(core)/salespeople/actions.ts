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
import { getPrisma } from "@/lib/prisma";

function revalidateSalespeople() {
  revalidatePath("/salespeople");
  revalidatePath("/transfers");
  revalidatePath("/deliveries");
}

/** Adds a salesperson, or edits one when the form carries its id. */
export async function saveSalesperson(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("salespeople.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const name = readText(formData.get("name"));
  const typedPhone = readText(formData.get("phone"), 40);
  const phone = typedPhone ? normalizePhone(typedPhone) : null;
  const email = readText(formData.get("email"))?.toLowerCase() ?? null;
  const zoneKey = readText(formData.get("zoneKey"), 100);
  const userId = readText(formData.get("userId"), 100);
  if (!name) return { message: "Enter the salesperson's name." };
  if (typedPhone && !phone) return { message: "Enter a phone number like 0754 123 456, or leave it empty." };
  if (email && !isEmail(email)) return { message: "Enter a valid email address, or leave it empty." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  if (
    zoneKey &&
    !(await prisma.zone.findUnique({ where: { organizationId_key: { organizationId, key: zoneKey } } }))
  ) {
    return { message: "Pick the zone from the list." };
  }

  // The login must belong to an active member, and to no other salesperson.
  if (userId) {
    if (!isUuid(userId)) return { message: "Pick the login from the list of members." };
    const [membership, linked] = await Promise.all([
      prisma.membership.findFirst({
        where: { organizationId, userId, status: "active" },
        select: { id: true },
      }),
      prisma.salesperson.findFirst({
        where: { organizationId, userId, ...(id ? { id: { not: id } } : {}) },
        select: { name: true },
      }),
    ]);
    if (!membership) return { message: "Pick the login from the list of members." };
    if (linked) return { message: `That login is already linked to ${linked.name}.` };
  }

  const data = { name, phone, email, zoneKey, userId, notes: readText(formData.get("notes"), 1000) };
  try {
    if (id) {
      const { count } = await prisma.salesperson.updateMany({ where: { id, organizationId }, data });
      if (!count) return { message: "That salesperson no longer exists." };
    } else {
      await prisma.salesperson.create({ data: { ...data, organizationId } });
    }
  } catch (error) {
    // The login was checked above, so a clash here is almost always the name.
    if (isUniqueViolation(error)) return { message: `There's already a salesperson called ${name}, or that login is taken.` };
    throw error;
  }

  revalidateSalespeople();
  return { success: true, message: id ? `${name} saved.` : `${name} added.` };
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
