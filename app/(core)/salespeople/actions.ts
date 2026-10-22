"use server";

import { revalidatePath } from "next/cache";

import { normalizePhone } from "@/lib/dealers";
import {
  isUniqueViolation,
  memberWith,
  notAllowed,
  readText,
  type ActionResult,
} from "@/lib/inventory";
import { getPrisma } from "@/lib/prisma";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function revalidateSalespeople() {
  revalidatePath("/salespeople");
  revalidatePath("/transfers");
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
  if (!name) return { message: "Enter the salesperson's name." };
  if (typedPhone && !phone) return { message: "Enter a phone number like 0754 123 456, or leave it empty." };
  if (email && !EMAIL.test(email)) return { message: "Enter a valid email address, or leave it empty." };

  const prisma = getPrisma();
  if (zoneKey && !(await prisma.zone.findUnique({ where: { key: zoneKey } }))) {
    return { message: "Pick the zone from the list." };
  }

  const data = { name, phone, email, zoneKey, notes: readText(formData.get("notes"), 1000) };
  const organizationId = member.organization.id;
  try {
    if (id) {
      const { count } = await prisma.salesperson.updateMany({ where: { id, organizationId }, data });
      if (!count) return { message: "That salesperson no longer exists." };
    } else {
      await prisma.salesperson.create({ data: { ...data, organizationId } });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { message: `There's already a salesperson called ${name}.` };
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
