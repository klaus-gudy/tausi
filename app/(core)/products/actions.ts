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
import { productCode, uniqueProductCode } from "@/lib/product-code";

/**
 * Adds a product, or edits one when the form carries its id. The code is
 * generated from the name and size when the product is added and never
 * changes after, so paperwork stays right when the product is renamed or resized.
 */
export async function saveProduct(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("products.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const name = readText(formData.get("name"));
  const size = readText(formData.get("size"), 30);
  const priceText = readText(formData.get("sellingPrice"));
  const sellingPrice = priceText === null ? 0 : readWholeNumber(priceText);

  if (!name) return { message: "Enter the product's name." };
  if (sellingPrice === null) return { message: "Enter the selling price as a whole number." };

  const prisma = getPrisma();
  const organizationId = member.organization.id;
  const userId = member.userId;
  const data = { name, size, sellingPrice, updatedById: userId };

  if (id) {
    const { count } = await prisma.product.updateMany({ where: { id, organizationId }, data });
    if (!count) return { message: "That product no longer exists." };
  } else {
    const base = productCode(name, size);
    if (!base) return { message: "Give the product a name with letters or digits." };
    const taken = await prisma.product.findMany({
      where: { organizationId, code: { startsWith: base } },
      select: { code: true },
    });
    const code = uniqueProductCode(base, new Set(taken.map((product) => product.code.toUpperCase())));
    try {
      await prisma.product.create({ data: { ...data, code, organizationId, createdById: userId } });
    } catch (error) {
      // Someone added a product with the same code a moment ago.
      if (isUniqueViolation(error)) return { message: "That code was just taken. Try again." };
      throw error;
    }
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
    data: { archivedAt: archived ? new Date() : null, updatedById: member.userId },
  });
  if (!count) return { message: "That product no longer exists." };

  revalidatePath("/products");
  revalidatePath("/stock");
  return { success: true, message: archived ? "Product archived." : "Product restored." };
}
