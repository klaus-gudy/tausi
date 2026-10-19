"use server";

import { revalidatePath } from "next/cache";

import { dealerName, normalizePhone } from "@/lib/dealers";
import {
  isUniqueViolation,
  memberWith,
  notAllowed,
  readText,
  type ActionResult,
} from "@/lib/inventory";
import { getPrisma } from "@/lib/prisma";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adds a super dealer, or edits one when the form carries its id. A dealer
 * needs a phone, and a shop name or a contact name; the rest is optional. The
 * region and district are picked from the seeded lists. Notes aren't in the
 * form, so saving leaves any a dealer already has.
 */
export async function saveSuperDealer(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("dealers.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const shopName = readText(formData.get("shopName"));
  const contactName = readText(formData.get("contactName"));
  const typedPhone = readText(formData.get("phone"), 40);
  const phone = typedPhone ? normalizePhone(typedPhone) : null;
  const email = readText(formData.get("email"))?.toLowerCase() ?? null;
  const regionKey = readText(formData.get("regionKey"), 100);
  const districtKey = regionKey ? readText(formData.get("districtKey"), 100) : null;
  if (!shopName && !contactName) return { message: "Enter a shop name, a contact name, or both." };
  if (!typedPhone) return { message: "Enter the dealer's phone number." };
  if (!phone) return { message: "Enter a phone number like 0754 123 456." };
  if (email && !EMAIL.test(email)) return { message: "Enter a valid email address, or leave it empty." };

  const prisma = getPrisma();
  // A district is only found in its own region, so finding it checks both.
  if (regionKey) {
    const found = districtKey
      ? await prisma.district.findUnique({ where: { regionKey_key: { regionKey, key: districtKey } } })
      : await prisma.region.findUnique({ where: { key: regionKey } });
    if (!found) return { message: districtKey ? "Pick a district in that region." : "Pick the region from the list." };
  }

  const data = {
    shopName,
    contactName,
    phone,
    email,
    regionKey,
    districtKey,
    address: readText(formData.get("address"), 300),
  };
  const organizationId = member.organization.id;
  const name = dealerName(data);
  try {
    if (id) {
      const { count } = await prisma.superDealer.updateMany({ where: { id, organizationId }, data });
      if (!count) return { message: "That dealer no longer exists." };
    } else {
      await prisma.superDealer.create({ data: { ...data, organizationId } });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { message: `There's already a dealer called ${shopName}.` };
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
