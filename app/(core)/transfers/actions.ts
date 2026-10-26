"use server";

import { revalidatePath } from "next/cache";

import type { Prisma, StockTransferStatus } from "@/lib/generated/prisma/client";
import { formatCount } from "@/lib/format";
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
  sumLines,
  type ActionResult,
} from "@/lib/inventory";
import { getPrisma } from "@/lib/prisma";
import { TRANSFER_STATUS_LABELS, transferNumber } from "@/lib/transfers";

// A transfer moves through initiated → in transit → arrived. Its stock comes
// off the warehouse's stock on hand when it is initiated; until it leaves, it can be cancelled, which
// reverses those movements and puts the stock back.

function revalidateTransfers() {
  revalidatePath("/transfers");
  revalidatePath("/salespeople");
  revalidatePath("/stock-on-hand");
  revalidatePath("/movement-history");
  revalidatePath("/products");
}

/** Takes stock off hand in a warehouse for a salesperson and opens a transfer for it. */
export async function initiateTransfer(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("stock.transfer");
  if (!member) return notAllowed;

  const salespersonId = String(formData.get("salespersonId") ?? "");
  if (!isUuid(salespersonId)) return { message: "Pick the salesperson the stock is going to." };
  const initiatedOn = readDay(formData.get("initiatedOn"));
  if (!initiatedOn) return { message: "Pick the day the stock was picked, today or earlier." };
  const lines = readLines(formData, false);
  if (typeof lines === "string") return { message: lines };
  const wanted = sumLines(lines);
  const reference = readText(formData.get("reference"), 100);
  const note = readText(formData.get("note"), 1000);

  const organizationId = member.organization.id;
  const attempt = () =>
    getPrisma().$transaction(async (tx): Promise<ActionResult> => {
      const salesperson = await tx.salesperson.findFirst({
        where: { id: salespersonId, organizationId },
        select: { name: true, deactivatedAt: true },
      });
      if (!salesperson) return { message: "That salesperson no longer exists." };
      if (salesperson.deactivatedAt) {
        return { message: `${salesperson.name} is inactive. Reactivate them first.` };
      }

      const warehouse = await pickedWarehouse(organizationId, formData.get("warehouseId"), tx);
      if ("message" in warehouse) return warehouse;

      const products = await lockProducts(tx, organizationId, warehouse.id, [...wanted.keys()]);
      if (products.length !== wanted.size) return { message: "One of those products no longer exists." };
      for (const product of products) {
        const quantity = wanted.get(product.id)!;
        if (product.archivedAt) return { message: `${product.name} is archived. Restore it first.` };
        if (quantity > product.onHand) {
          return {
            message: `Only ${formatCount(product.onHand)} of ${product.name} on hand in ${warehouse.name}; you tried to send ${formatCount(quantity)}.`,
          };
        }
      }

      // Two transfers started at once can pick the same number; the unique
      // index rejects the second and the caller tries again.
      const last = await tx.stockTransfer.aggregate({ where: { organizationId }, _max: { number: true } });
      const number = (last._max.number ?? 0) + 1;
      await tx.stockTransfer.create({
        data: {
          organizationId,
          number,
          salespersonId,
          warehouseId: warehouse.id,
          reference,
          note,
          initiatedOn,
          createdById: member.userId,
          movements: {
            create: [...wanted].map(([productId, quantity]) => ({
              organizationId,
              productId,
              type: "transferred" as const,
              holder: "warehouse" as const,
              warehouseId: warehouse.id,
              quantity: -quantity,
              occurredOn: initiatedOn,
              reference,
              createdById: member.userId,
            })),
          },
        },
      });
      const units = [...wanted.values()].reduce((sum, quantity) => sum + quantity, 0);
      return {
        success: true,
        message: `${transferNumber(number)}: ${plural(units, "unit")} for ${salesperson.name} taken off stock.`,
      };
    });

  for (let tries = 1; ; tries++) {
    try {
      const result = await attempt();
      if (result.success) revalidateTransfers();
      return result;
    } catch (error) {
      if (!isUniqueViolation(error) || tries === 3) throw error;
    }
  }
}

/**
 * Moves a transfer from one status to the next, if it is still in `from`;
 * the condition is part of the update, so two people can't both move it.
 */
async function advance(
  id: string,
  from: StockTransferStatus,
  data: (userId: string) => Prisma.StockTransferUpdateManyMutationInput,
  done: string,
  extra?: (tx: Prisma.TransactionClient, organizationId: string, userId: string) => Promise<void>
): Promise<ActionResult> {
  const member = await memberWith("stock.transfer");
  if (!member) return notAllowed;
  if (!isUuid(id)) return { message: "That transfer no longer exists." };

  const organizationId = member.organization.id;
  const result = await getPrisma().$transaction(async (tx): Promise<ActionResult> => {
    const transfer = await tx.stockTransfer.findFirst({
      where: { id, organizationId },
      select: { number: true, status: true },
    });
    if (!transfer) return { message: "That transfer no longer exists." };
    const { count } = await tx.stockTransfer.updateMany({
      where: { id, organizationId, status: from },
      data: data(member.userId),
    });
    if (!count) {
      const name = transferNumber(transfer.number);
      if (from === "in_transit" && transfer.status === "initiated") {
        return { message: `Mark ${name} in transit first.` };
      }
      if (transfer.status === "in_transit" || transfer.status === "arrived") {
        if (data(member.userId).status === "cancelled") {
          return { message: `${name} has left the store, so it can't be cancelled.` };
        }
      }
      return { message: `${name} is already ${TRANSFER_STATUS_LABELS[transfer.status].toLowerCase()}.` };
    }
    await extra?.(tx, organizationId, member.userId);
    return { success: true, message: `${transferNumber(transfer.number)} ${done}.` };
  });

  if (result.success) revalidateTransfers();
  return result;
}

/** The stock has left the store and is on its way. */
export async function markInTransit(id: string) {
  return advance(
    id,
    "initiated",
    (userId) => ({ status: "in_transit", dispatchedAt: new Date(), dispatchedById: userId }),
    "is in transit"
  );
}

/** The salesperson has the stock. */
export async function markArrived(id: string) {
  return advance(
    id,
    "in_transit",
    (userId) => ({ status: "arrived", arrivedAt: new Date(), arrivedById: userId }),
    "has arrived"
  );
}

/** Calls off a transfer that hasn't left yet and puts its stock back on hand. */
export async function cancelTransfer(id: string) {
  return advance(
    id,
    "initiated",
    (userId) => ({ status: "cancelled", cancelledAt: new Date(), cancelledById: userId }),
    "was cancelled and its stock is back on hand",
    async (tx, organizationId, userId) => {
      const movements = await tx.stockMovement.findMany({
        where: { transferId: id, organizationId, type: "transferred" },
        select: { id: true, productId: true, quantity: true, warehouseId: true, reference: true },
      });
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
      await tx.stockMovement.createMany({
        data: movements.map((movement) => ({
          organizationId,
          productId: movement.productId,
          type: "reversal" as const,
          holder: "warehouse" as const,
          warehouseId: movement.warehouseId,
          quantity: -movement.quantity,
          transferId: id,
          reference: movement.reference,
          reversesId: movement.id,
          occurredOn: today,
          createdById: userId,
        })),
      });
    }
  );
}
