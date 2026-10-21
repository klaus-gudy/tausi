"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  defaultWarehouse,
  isUniqueViolation,
  isUuid,
  lockProducts,
  memberWith,
  noWarehouse,
  notAllowed,
  readDay,
  readText,
  readWholeNumber,
  type ActionResult,
} from "@/lib/inventory";
import { dealerName } from "@/lib/dealers";
import { formatCount } from "@/lib/format";
import { getPrisma } from "@/lib/prisma";

// Every change to stock is a new stock_movements row; nothing here edits or
// deletes one. Anything that removes stock locks the products first and
// checks there is enough, so concurrent issues can't take stock below zero.
// Stock is recorded against the organization's first warehouse until these
// forms let you pick one.

const MAX_LINES = 50;

type Line = { productId: string; quantity: number; unitCost: number | null };

/** The product lines of a receive or issue form, or a message saying what's wrong. */
function readLines(formData: FormData, withCost: boolean): Line[] | string {
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity");
  const unitCosts = formData.getAll("unitCost");
  const lines: Line[] = [];
  for (const [index, productId] of productIds.entries()) {
    const quantityText = readText(quantities[index] ?? null);
    // A row left completely empty is ignored.
    if (!productId && !quantityText) continue;
    const row = productIds.length > 1 ? ` on line ${index + 1}` : "";
    if (!isUuid(productId)) return `Pick a product${row}.`;
    const quantity = readWholeNumber(quantityText);
    if (!quantity) return `Enter a quantity of at least 1${row}.`;
    const costText = withCost ? readText(unitCosts[index] ?? null) : null;
    const unitCost = costText === null ? null : readWholeNumber(costText);
    if (costText !== null && unitCost === null) return `Enter the unit cost as a whole number${row}.`;
    lines.push({ productId, quantity, unitCost });
  }
  if (!lines.length) return "Add at least one product.";
  if (lines.length > MAX_LINES) return `Record at most ${MAX_LINES} products at a time.`;
  return lines;
}

function revalidateInventory() {
  revalidatePath("/stock");
  revalidatePath("/products");
  revalidatePath("/super-dealers");
}

function plural(count: number, word: string) {
  return `${formatCount(count)} ${word}${count === 1 ? "" : "s"}`;
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
  const warehouse = await defaultWarehouse(organizationId);
  if (!warehouse) return noWarehouse;
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
  return { success: true, message: `Received ${plural(units, "unit")} of ${plural(lines.length, "product")}.` };
}

/** Records stock leaving the store for a super dealer. */
export async function issueStock(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("stock.issue");
  if (!member) return notAllowed;

  const superDealerId = String(formData.get("superDealerId") ?? "");
  if (!isUuid(superDealerId)) return { message: "Pick the dealer the stock is going to." };
  const occurredOn = readDay(formData.get("occurredOn"));
  if (!occurredOn) return { message: "Pick the day the stock left, today or earlier." };
  const lines = readLines(formData, false);
  if (typeof lines === "string") return { message: lines };

  // The same product twice is one line with both quantities.
  const wanted = new Map<string, number>();
  for (const line of lines) {
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
  }

  const organizationId = member.organization.id;
  const result = await getPrisma().$transaction(async (tx): Promise<ActionResult> => {
    const dealer = await tx.superDealer.findFirst({
      where: { id: superDealerId, organizationId },
      select: { shopName: true, contactName: true, deactivatedAt: true },
    });
    if (!dealer) return { message: "That dealer no longer exists." };
    if (dealer.deactivatedAt) return { message: `${dealerName(dealer)} is inactive. Reactivate them first.` };
    const warehouse = await defaultWarehouse(organizationId, tx);
    if (!warehouse) return noWarehouse;

    const products = await lockProducts(tx, organizationId, warehouse.id, [...wanted.keys()]);
    if (products.length !== wanted.size) return { message: "One of those products no longer exists." };
    for (const product of products) {
      const quantity = wanted.get(product.id)!;
      if (product.archivedAt) return { message: `${product.name} is archived. Restore it first.` };
      if (quantity > product.onHand) {
        return {
          message: `Only ${formatCount(product.onHand)} of ${product.name} on hand in ${warehouse.name}; you tried to issue ${formatCount(quantity)}.`,
        };
      }
    }

    // Each product leaves the warehouse and arrives with the dealer: two rows
    // sharing a transfer id.
    await tx.stockMovement.createMany({
      data: [...wanted].flatMap(([productId, quantity]) => {
        const shared = {
          organizationId,
          productId,
          type: "issued" as const,
          superDealerId,
          transferId: randomUUID(),
          occurredOn,
          reference: readText(formData.get("reference"), 100),
          note: readText(formData.get("note"), 1000),
          createdById: member.userId,
        };
        return [
          { ...shared, holder: "warehouse" as const, warehouseId: warehouse.id, quantity: -quantity },
          { ...shared, holder: "super_dealer" as const, quantity },
        ];
      }),
    });
    const units = [...wanted.values()].reduce((sum, quantity) => sum + quantity, 0);
    return { success: true, message: `Issued ${plural(units, "unit")} to ${dealerName(dealer)}.` };
  });

  if (result.success) revalidateInventory();
  return result;
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
    const warehouse = await defaultWarehouse(organizationId, tx);
    if (!warehouse) return noWarehouse;
    const [product] = await lockProducts(tx, organizationId, warehouse.id, [productId]);
    if (!product) return { message: "That product no longer exists." };
    const difference = counted - product.onHand;
    if (!difference) return { message: `${product.name} already has ${formatCount(counted)} on hand.` };

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
      message: `${product.name} set to ${formatCount(counted)} (${difference > 0 ? "+" : "−"}${formatCount(Math.abs(difference))}).`,
    };
  });

  if (result.success) revalidateInventory();
  return result;
}

/**
 * Undoes a warehouse movement entered by mistake with an opposite one; the
 * original stays visible. Both rows of a transfer are reversed together.
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
          transferId: true,
          reversedBy: { select: { id: true } },
        },
      });
      if (!movement?.warehouseId) return { message: "That movement no longer exists." };
      if (movement.type === "reversal") return { message: "A reversal can't be reversed." };
      if (movement.reversedBy) return { message: "That movement was already reversed." };

      const [product] = await lockProducts(tx, organizationId, movement.warehouseId, [movement.productId]);
      if (!product) return { message: "That product no longer exists." };
      if (product.onHand - movement.quantity < 0) {
        return {
          message: `Reversing it would take ${product.name} below zero: only ${formatCount(product.onHand)} on hand.`,
        };
      }

      const rows = await tx.stockMovement.findMany({
        where: movement.transferId ? { transferId: movement.transferId } : { id: movementId },
        select: {
          id: true,
          holder: true,
          quantity: true,
          warehouseId: true,
          salespersonId: true,
          superDealerId: true,
          receiptId: true,
          dispatchId: true,
          saleId: true,
          reference: true,
        },
      });
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
      const transferId = movement.transferId ? randomUUID() : null;
      await tx.stockMovement.createMany({
        data: rows.map(({ id, quantity, ...row }) => ({
          ...row,
          organizationId,
          productId: movement.productId,
          type: "reversal" as const,
          quantity: -quantity,
          transferId,
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
