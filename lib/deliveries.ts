import type { Prisma } from "@/lib/generated/prisma/client"
import type { ActiveMember } from "@/lib/membership"
import { getPrisma } from "@/lib/prisma"
import { SALESPERSON_PERSON, salespersonName } from "@/lib/salespeople"

// What salespeople hold and supply. Shared by the deliveries, salespeople and
// super dealers pages. Like stock on hand, what a salesperson holds is never
// stored: it is their acknowledged transfers less their deliveries.

/** "DL-0007": how a delivery is named on screen and on paperwork. */
export function deliveryNumber(number: number) {
  return `DL-${String(number).padStart(4, "0")}`
}

/** The signed-in member's salesperson record, if they're an active salesperson. */
export async function readOwnSalesperson(member: ActiveMember) {
  const salesperson = await getPrisma().salesperson.findFirst({
    where: { membershipId: member.membershipId, deactivatedAt: null },
    select: { id: true, ...SALESPERSON_PERSON },
  })
  return salesperson && { id: salesperson.id, name: salespersonName(salesperson) }
}

/**
 * Units each salesperson holds, per product id: what reached them on
 * acknowledged transfers less what they delivered. Pass `salespersonId` for
 * one salesperson. Products they hold none of are missing (0).
 */
export async function heldStock(
  organizationId: string,
  salespersonId?: string,
  client: Prisma.TransactionClient = getPrisma()
) {
  const rows = await client.$queryRaw<{ salesperson_id: string; product_id: string; units: bigint }[]>`
    SELECT salesperson_id, product_id, SUM(units) AS units
    FROM (
      SELECT t.salesperson_id, m.product_id, -m.quantity AS units
      FROM stock_transfers t
      JOIN stock_movements m ON m.transfer_id = t.id AND m.type = 'transferred'
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.acknowledged_at IS NOT NULL
        AND (${salespersonId ?? null}::uuid IS NULL OR t.salesperson_id = ${salespersonId ?? null}::uuid)
      UNION ALL
      SELECT d.salesperson_id, l.product_id, -l.quantity
      FROM deliveries d
      JOIN delivery_lines l ON l.delivery_id = d.id
      WHERE d.organization_id = ${organizationId}::uuid
        AND (${salespersonId ?? null}::uuid IS NULL OR d.salesperson_id = ${salespersonId ?? null}::uuid)
    ) moves
    GROUP BY salesperson_id, product_id
    HAVING SUM(units) <> 0`
  const held = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const products = held.get(row.salesperson_id) ?? new Map<string, number>()
    products.set(row.product_id, Number(row.units))
    held.set(row.salesperson_id, products)
  }
  return held
}
