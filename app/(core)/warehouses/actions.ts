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

/**
 * Adds a warehouse, or edits one when the form carries its id. Only the name
 * is required; the region and district are picked from the organization's
 * places, and the storekeeper's name and phone are filled in from a member.
 */
export async function saveWarehouse(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("warehouses.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const name = readText(formData.get("name"));
  const regionKey = readText(formData.get("regionKey"), 100);
  const districtKey = regionKey ? readText(formData.get("districtKey"), 100) : null;
  const typedPhone = readText(formData.get("phone"), 40);
  const phone = typedPhone ? normalizePhone(typedPhone) : null;
  if (!name) return { message: "Enter the warehouse's name." };
  if (typedPhone && !phone) return { message: "Enter a phone number like 0754 123 456, or leave it empty." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  // A district is only found in its own region, so finding it checks both.
  if (regionKey) {
    const found = districtKey
      ? await prisma.district.findUnique({
          where: { organizationId_regionKey_key: { organizationId, regionKey, key: districtKey } },
        })
      : await prisma.region.findUnique({ where: { organizationId_key: { organizationId, key: regionKey } } });
    if (!found) return { message: districtKey ? "Pick a district in that region." : "Pick the region from the list." };
  }

  const data = {
    name,
    regionKey,
    districtKey,
    address: readText(formData.get("address"), 300),
    contactName: readText(formData.get("contactName")),
    phone,
  };
  try {
    if (id) {
      const { count } = await prisma.warehouse.updateMany({ where: { id, organizationId }, data });
      if (!count) return { message: "That warehouse no longer exists." };
    } else {
      await prisma.warehouse.create({ data: { ...data, organizationId } });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { message: `There's already a warehouse called ${name}.` };
    throw error;
  }

  revalidatePath("/warehouses");
  return { success: true, message: id ? `${name} saved.` : `${name} added.` };
}

/** Inactive warehouses stay on record but leave the main list. */
export async function setWarehouseActive(id: string, active: boolean): Promise<ActionResult> {
  const member = await memberWith("warehouses.manage");
  if (!member) return notAllowed;

  const { count } = await getPrisma().warehouse.updateMany({
    where: { id, organizationId: member.organization.id },
    data: { deactivatedAt: active ? null : new Date() },
  });
  if (!count) return { message: "That warehouse no longer exists." };

  revalidatePath("/warehouses");
  return { success: true, message: active ? "Warehouse reactivated." : "Warehouse deactivated." };
}
