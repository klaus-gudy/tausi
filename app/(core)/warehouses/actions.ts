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
import { pickedDistrict } from "@/lib/places";
import { getPrisma } from "@/lib/prisma";

/**
 * Adds a warehouse, or edits one when the form carries its id. Only the name
 * is required; the place is picked from the organization's zones, regions and
 * districts and stored as its district, and the storekeeper's name and phone are filled in from a member.
 */
export async function saveWarehouse(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("warehouses.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const name = readText(formData.get("name"));
  const typedPhone = readText(formData.get("phone"), 40);
  const phone = typedPhone ? normalizePhone(typedPhone) : null;
  if (!name) return { message: "Enter the warehouse's name." };
  if (typedPhone && !phone) return { message: "Enter a phone number like 0754 123 456, or leave it empty." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  const place = await pickedDistrict(organizationId, formData);
  if ("message" in place) return place;

  const data = {
    name,
    districtId: place.districtId,
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
