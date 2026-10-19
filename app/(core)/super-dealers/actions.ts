"use server";

import { revalidatePath } from "next/cache";

import {
  isUniqueViolation,
  memberWith,
  notAllowed,
  readText,
  type ActionResult,
} from "@/lib/inventory";
import { getPrisma } from "@/lib/prisma";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adds a super dealer, or edits one when the form carries its id. */
export async function saveSuperDealer(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("dealers.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const name = readText(formData.get("name"));
  const email = readText(formData.get("email"))?.toLowerCase() ?? null;
  if (!name) return { message: "Enter the dealer's name." };
  if (email && !EMAIL.test(email)) return { message: "Enter a valid email address, or leave it empty." };

  const data = {
    name,
    email,
    contactPerson: readText(formData.get("contactPerson")),
    phone: readText(formData.get("phone"), 40),
    region: readText(formData.get("region"), 100),
    address: readText(formData.get("address"), 300),
    notes: readText(formData.get("notes"), 1000),
  };
  const prisma = getPrisma();
  const organizationId = member.organization.id;
  try {
    if (id) {
      const { count } = await prisma.superDealer.updateMany({ where: { id, organizationId }, data });
      if (!count) return { message: "That dealer no longer exists." };
    } else {
      await prisma.superDealer.create({ data: { ...data, organizationId } });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { message: `There's already a dealer called ${name}.` };
    throw error;
  }

  revalidatePath("/super-dealers");
  revalidatePath("/stock");
  return { success: true, message: id ? `${name} saved.` : `${name} added.` };
}

/** Inactive dealers can't be issued stock; what they were issued stays on record. */
export async function setSuperDealerActive(id: string, active: boolean): Promise<ActionResult> {
  const member = await memberWith("dealers.manage");
  if (!member) return notAllowed;

  const { count } = await getPrisma().superDealer.updateMany({
    where: { id, organizationId: member.organization.id },
    data: { deactivatedAt: active ? null : new Date() },
  });
  if (!count) return { message: "That dealer no longer exists." };

  revalidatePath("/super-dealers");
  revalidatePath("/stock");
  return { success: true, message: active ? "Dealer reactivated." : "Dealer deactivated." };
}
