"use server";

import { revalidatePath } from "next/cache";

import {
  isUniqueViolation,
  memberWith,
  notAllowed,
  readText,
  readWholeNumber,
  type ActionResult,
} from "@/lib/inventory";
import { getPrisma } from "@/lib/prisma";

const SKU = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** Adds a product, or edits one when the form carries its id. */
export async function saveProduct(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("products.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const sku = readText(formData.get("sku"), 40);
  const name = readText(formData.get("name"));
  const unit = readText(formData.get("unit"), 30) ?? "piece";
  const description = readText(formData.get("description"), 1000);
  const priceText = readText(formData.get("price"));
  const price = priceText === null ? 0 : readWholeNumber(priceText);
  const reorderText = readText(formData.get("reorderLevel"));
  const reorderLevel = reorderText === null ? null : readWholeNumber(reorderText);

  if (!sku || !SKU.test(sku)) {
    return { message: "Enter a SKU: letters, digits, and . _ / - with no spaces." };
  }
  if (!name) return { message: "Enter the product's name." };
  if (price === null) return { message: "Enter the price as a whole number." };
  if (reorderText !== null && reorderLevel === null) {
    return { message: "Enter the reorder level as a whole number, or leave it empty." };
  }

  const data = { sku, name, unit, description, price, reorderLevel };
  const prisma = getPrisma();
  const organizationId = member.organization.id;
  try {
    if (id) {
      const { count } = await prisma.product.updateMany({ where: { id, organizationId }, data });
      if (!count) return { message: "That product no longer exists." };
    } else {
      await prisma.product.create({ data: { ...data, organizationId } });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { message: `Another product already uses SKU ${sku}.` };
    throw error;
  }

  revalidatePath("/products");
  revalidatePath("/stock");
  return { success: true, message: id ? `${name} saved.` : `${name} added.` };
}

/** Archiving hides a product from receiving and issuing; its history stays. */
export async function setProductArchived(id: string, archived: boolean): Promise<ActionResult> {
  const member = await memberWith("products.manage");
  if (!member) return notAllowed;

  const { count } = await getPrisma().product.updateMany({
    where: { id, organizationId: member.organization.id },
    data: { archivedAt: archived ? new Date() : null },
  });
  if (!count) return { message: "That product no longer exists." };

  revalidatePath("/products");
  revalidatePath("/stock");
  return { success: true, message: archived ? "Product archived." : "Product restored." };
}
