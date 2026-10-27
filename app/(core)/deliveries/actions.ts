"use server";

import { revalidatePath } from "next/cache";

import { dealerName } from "@/lib/dealers";
import { deliveryNumber, heldStock, readOwnSalesperson } from "@/lib/deliveries";
import { formatCount } from "@/lib/format";
import {
  isUniqueViolation,
  isUuid,
  memberWith,
  notAllowed,
  plural,
  readDay,
  readLines,
  readText,
  sumLines,
  type ActionResult,
} from "@/lib/inventory";
import { getPrisma } from "@/lib/prisma";
import { transferNumber } from "@/lib/transfers";

// Salespeople act only for themselves: every action finds the salesperson the
// signed-in member is linked to and works on their transfers and stock.

const notLinked: ActionResult = {
  message: "Your login isn't linked to a salesperson. Ask an admin to link it under Salespeople.",
};

function revalidateDeliveries() {
  revalidatePath("/deliveries");
  revalidatePath("/transfers");
  revalidatePath("/salespeople");
  revalidatePath("/stock-on-hand");
  revalidatePath("/super-dealers");
}

/** Confirms the stock of a transfer marked arrived reached the salesperson. */
export async function acknowledgeTransfer(id: string): Promise<ActionResult> {
  const member = await memberWith("deliveries.record");
  if (!member) return notAllowed;
  const salesperson = await readOwnSalesperson(member);
  if (!salesperson) return notLinked;
  if (!isUuid(id)) return { message: "That transfer no longer exists." };

  const organizationId = member.organization.id;
  const now = new Date();
  const result = await getPrisma().$transaction(async (tx): Promise<ActionResult> => {
    const transfer = await tx.stockTransfer.findFirst({
      where: { id, organizationId, salespersonId: salesperson.id },
      select: { number: true, status: true, acknowledgedAt: true },
    });
    if (!transfer) return { message: "That transfer no longer exists." };
    const name = transferNumber(transfer.number);
    if (transfer.acknowledgedAt) return { message: `You already acknowledged ${name}.` };
    if (transfer.status !== "arrived") {
      const why = {
        initiated: "hasn't left the store yet",
        in_transit: "is still on its way. Acknowledge it once it's marked arrived",
        cancelled: "was cancelled",
      }[transfer.status];
      return { message: `${name} ${why}.` };
    }

    // The status is part of the condition, so a change in between is caught.
    const { count } = await tx.stockTransfer.updateMany({
      where: { id, status: "arrived", acknowledgedAt: null },
      data: { acknowledgedAt: now, acknowledgedById: member.userId },
    });
    if (!count) return { message: `${name} changed in the meantime. Reload and try again.` };
    return { success: true, message: `${name} acknowledged. Its stock is with you now.` };
  });

  if (result.success) revalidateDeliveries();
  return result;
}

/** Records stock the salesperson handed to a super dealer from what they hold. */
export async function recordDelivery(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("deliveries.record");
  if (!member) return notAllowed;
  const salesperson = await readOwnSalesperson(member);
  if (!salesperson) return notLinked;

  const superDealerId = String(formData.get("superDealerId") ?? "");
  if (!isUuid(superDealerId)) return { message: "Pick the dealer you supplied." };
  const deliveredOn = readDay(formData.get("deliveredOn"));
  if (!deliveredOn) return { message: "Pick the day you delivered, today or earlier." };
  const lines = readLines(formData, false);
  if (typeof lines === "string") return { message: lines };
  const wanted = sumLines(lines);
  const reference = readText(formData.get("reference"), 100);
  const note = readText(formData.get("note"), 1000);

  const organizationId = member.organization.id;
  const attempt = () =>
    getPrisma().$transaction(async (tx): Promise<ActionResult> => {
      // One delivery at a time per salesperson, so two can't spend the same units.
      await tx.$queryRaw`SELECT id FROM salespeople WHERE id = ${salesperson.id}::uuid FOR UPDATE`;

      const dealer = await tx.superDealer.findFirst({
        where: { id: superDealerId, organizationId },
        select: { shopName: true, contactName: true, deactivatedAt: true },
      });
      if (!dealer) return { message: "That dealer no longer exists." };
      if (dealer.deactivatedAt) return { message: `${dealerName(dealer)} is inactive.` };

      const [products, held] = await Promise.all([
        tx.product.findMany({
          where: { organizationId, id: { in: [...wanted.keys()] } },
          select: { id: true, name: true },
        }),
        heldStock(organizationId, salesperson.id, tx),
      ]);
      if (products.length !== wanted.size) return { message: "One of those products no longer exists." };
      const holding = held.get(salesperson.id);
      for (const product of products) {
        const have = holding?.get(product.id) ?? 0;
        const quantity = wanted.get(product.id)!;
        if (quantity > have) {
          return {
            message: `You hold ${formatCount(have)} of ${product.name}; you tried to deliver ${formatCount(quantity)}.`,
          };
        }
      }

      // Two deliveries recorded at once can pick the same number; the unique
      // index rejects the second and the caller tries again.
      const last = await tx.delivery.aggregate({ where: { organizationId }, _max: { number: true } });
      const number = (last._max.number ?? 0) + 1;
      await tx.delivery.create({
        data: {
          organizationId,
          number,
          salespersonId: salesperson.id,
          superDealerId,
          deliveredOn,
          reference,
          note,
          createdById: member.userId,
          lines: { create: [...wanted].map(([productId, quantity]) => ({ productId, quantity })) },
        },
      });
      const units = [...wanted.values()].reduce((sum, quantity) => sum + quantity, 0);
      return {
        success: true,
        message: `${deliveryNumber(number)}: ${plural(units, "unit")} delivered to ${dealerName(dealer)}.`,
      };
    });

  for (let tries = 1; ; tries++) {
    try {
      const result = await attempt();
      if (result.success) revalidateDeliveries();
      return result;
    } catch (error) {
      if (!isUniqueViolation(error) || tries === 3) throw error;
    }
  }
}
