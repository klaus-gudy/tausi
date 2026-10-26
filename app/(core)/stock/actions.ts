"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  isUniqueViolation,
  isUuid,
  lockProducts,
  memberWith,
  notAllowed,
  pickedWarehouse,
  plural,
  readDay,
  readLines,
  readText,
  readWholeNumber,
  type ActionResult,
} from "@/lib/inventory";
import { formatCount } from "@/lib/format";
import { getPrisma } from "@/lib/prisma";

// Every change to stock is a new stock_movements row; nothing here edits or
// deletes one. Anything that removes stock locks the products first and
// checks there is enough, so concurrent changes can't take stock below zero.
// Each form picks the warehouse the stock is received into or counted in.

function revalidateInventory() {
  revalidatePath("/stock");
  revalidatePath("/goods-received", "layout");
  revalidatePath("/products");
  revalidatePath("/super-dealers");
  revalidatePath("/transfers");
}

/** Records stock that arrived from a supplier. */
export async function receiveStock(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("stock.receive");
  if (!member) return notAllowed;

  const occurredOn = readDay(formData.get("occurredOn"));
  if (!occurredOn) return { message: "Pick the day the stock arrived, today or earlier." };
  const lines = readLines(formData, true);
  if (typeof lines === "string") return { message: lines };

  const organizationId = member.organization.id;
  const prisma = getPrisma();
  const warehouse = await pickedWarehouse(organizationId, formData.get("warehouseId"));
  if ("message" in warehouse) return warehouse;
  const products = await prisma.product.findMany({
    where: { organizationId, id: { in: lines.map((line) => line.productId) } },
    select: { id: true, name: true, archivedAt: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) return { message: "One of those products no longer exists." };
    if (product.archivedAt) return { message: `${product.name} is archived. Restore it first.` };
  }

  // The receipt holds the delivery's details; its movements are the lines.
  await prisma.stockReceipt.create({
    data: {
      organizationId,
      warehouseId: warehouse.id,
      supplierName: readText(formData.get("supplier")),
      reference: readText(formData.get("reference"), 100),
      note: readText(formData.get("note"), 1000),
      receivedOn: occurredOn,
      receivedById: member.userId,
      stockMovements: {
        createMany: {
          data: lines.map((line) => ({
            ...line,
            organizationId,
            type: "received" as const,
            holder: "warehouse" as const,
            warehouseId: warehouse.id,
            occurredOn,
            createdById: member.userId,
          })),
        },
      },
    },
  });

  revalidateInventory();
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  return {
    success: true,
    message: `Received ${plural(units, "unit")} of ${plural(lines.length, "product")} into ${warehouse.name}.`,
  };
}

/**
 * Sets a product's stock to what was counted on the shelf, recording the
 * difference as an adjustment with the reason given.
 */
export async function adjustStock(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("stock.adjust");
  if (!member) return notAllowed;

  const productId = String(formData.get("productId") ?? "");
  if (!isUuid(productId)) return { message: "Pick the product you counted." };
  const counted = readWholeNumber(formData.get("counted"));
  if (counted === null) return { message: "Enter how many you counted, 0 or more." };
  const note = readText(formData.get("note"), 1000);
  if (!note) return { message: "Say why the stock is different, e.g. damaged or a recount." };
  const occurredOn = readDay(formData.get("occurredOn"));
  if (!occurredOn) return { message: "Pick the day of the count, today or earlier." };

  const organizationId = member.organization.id;
  const result = await getPrisma().$transaction(async (tx): Promise<ActionResult> => {
    const warehouse = await pickedWarehouse(organizationId, formData.get("warehouseId"), tx);
    if ("message" in warehouse) return warehouse;
    const [product] = await lockProducts(tx, organizationId, warehouse.id, [productId]);
    if (!product) return { message: "That product no longer exists." };
    const difference = counted - product.onHand;
    if (!difference) {
      return { message: `${product.name} already has ${formatCount(counted)} on hand in ${warehouse.name}.` };
    }

    await tx.stockMovement.create({
      data: {
        organizationId,
        productId,
        type: "adjustment",
        holder: "warehouse",
        warehouseId: warehouse.id,
        quantity: difference,
        occurredOn,
        note,
        createdById: member.userId,
      },
    });
    return {
      success: true,
      message: `${product.name} in ${warehouse.name} set to ${formatCount(counted)} (${difference > 0 ? "+" : "−"}${formatCount(Math.abs(difference))}).`,
    };
  });

  if (result.success) revalidateInventory();
  return result;
}

/**
 * Undoes a warehouse movement entered by mistake with an opposite one; the
 * original stays visible. Both rows of an issue are reversed together.
 */
export async function reverseMovement(movementId: string): Promise<ActionResult> {
  const member = await memberWith("stock.adjust");
  if (!member) return notAllowed;
  if (!isUuid(movementId)) return { message: "That movement no longer exists." };

  const organizationId = member.organization.id;
  try {
    const result = await getPrisma().$transaction(async (tx): Promise<ActionResult> => {
      const movement = await tx.stockMovement.findFirst({
        where: { id: movementId, organizationId, holder: "warehouse" },
        select: {
          type: true,
          productId: true,
          quantity: true,
          warehouseId: true,
          moveId: true,
          reversedBy: { select: { id: true } },
        },
      });
      if (!movement?.warehouseId) return { message: "That movement no longer exists." };
      if (movement.type === "reversal") return { message: "A reversal can't be reversed." };
      // Its transfer tracks where the stock is, so only cancelling the transfer undoes it.
      if (movement.type === "transferred") return { message: "Cancel its transfer under Transfers instead." };
      if (movement.reversedBy) return { message: "That movement was already reversed." };

      const [product] = await lockProducts(tx, organizationId, movement.warehouseId, [movement.productId]);
      if (!product) return { message: "That product no longer exists." };
      if (product.onHand - movement.quantity < 0) {
        return {
          message: `Reversing it would take ${product.name} below zero: only ${formatCount(product.onHand)} on hand.`,
        };
      }

      const rows = await tx.stockMovement.findMany({
        where: movement.moveId ? { moveId: movement.moveId } : { id: movementId },
        select: {
          id: true,
          holder: true,
          quantity: true,
          warehouseId: true,
          superDealerId: true,
          receiptId: true,
          reference: true,
        },
      });
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
      const moveId = movement.moveId ? randomUUID() : null;
      await tx.stockMovement.createMany({
        data: rows.map(({ id, quantity, ...row }) => ({
          ...row,
          organizationId,
          productId: movement.productId,
          type: "reversal" as const,
          quantity: -quantity,
          moveId,
          reversesId: id,
          occurredOn: today,
          createdById: member.userId,
        })),
      });
      return { success: true, message: "Movement reversed." };
    });
    if (result.success) revalidateInventory();
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) return { message: "That movement was already reversed." };
    throw error;
  }
}
