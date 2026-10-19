import { Prisma } from "@/lib/generated/prisma/client"
import { readActiveMember } from "@/lib/membership"
import { getPrisma } from "@/lib/prisma"

// Shared by the products, super dealers and stock pages. Stock on hand is
// never stored: it is the sum of a product's stock movements.

export type ActionResult = { success?: boolean; message: string }

export const notAllowed: ActionResult = { message: "You don't have permission to do that." }

/** The active member, if their role has `permission`. Actions call it on every request. */
export async function memberWith(permission: string) {
  const member = await readActiveMember()
  return member?.permissions.has(permission) ? member : null
}

/** Trimmed text from a form field, or null when empty. Cut to `max` characters. */
export function readText(value: FormDataEntryValue | null, max = 200) {
  const text = String(value ?? "").trim()
  return text ? text.slice(0, max) : null
}

/** A whole number from 0 to 1,000,000,000, or null when empty or not one. */
export function readWholeNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").replace(/,/g, "").trim()
  if (!/^\d+$/.test(text)) return null
  const number = Number(text)
  return number <= 1_000_000_000 ? number : null
}

/**
 * A "YYYY-MM-DD" calendar day as a UTC-midnight Date, the way Prisma stores
 * @db.Date. Null when malformed or later than tomorrow (so any time zone's
 * today is allowed).
 */
export function readDay(value: FormDataEntryValue | null) {
  const text = String(value ?? "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const day = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== text) return null
  return day.getTime() <= Date.now() + 24 * 60 * 60 * 1000 ? day : null
}

/** Stock on hand per product id; products without movements are missing (0). */
export async function stockOnHand(
  organizationId: string,
  client: Prisma.TransactionClient = getPrisma()
) {
  const sums = await client.stockMovement.groupBy({
    by: ["productId"],
    where: { organizationId },
    _sum: { quantity: true },
  })
  return new Map(sums.map((row) => [row.productId, row._sum.quantity ?? 0]))
}

/**
 * Locks the organization's products with these ids, in a fixed order so two
 * transactions can't deadlock, and returns them with their stock on hand.
 * Anything that removes stock runs under this lock, so two issues can't both
 * spend the same units.
 */
export async function lockProducts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  productIds: string[]
) {
  const ids = [...new Set(productIds)].sort()
  if (!ids.length) return []
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM products
    WHERE organization_id = ${organizationId}::uuid AND id = ANY(${ids}::uuid[])
    ORDER BY id
    FOR UPDATE`
  if (!rows.length) return []
  const [products, sums] = await Promise.all([
    tx.product.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: { id: true, name: true, unit: true, archivedAt: true },
    }),
    tx.stockMovement.groupBy({
      by: ["productId"],
      where: { productId: { in: rows.map((row) => row.id) } },
      _sum: { quantity: true },
    }),
  ])
  const onHand = new Map(sums.map((row) => [row.productId, row._sum.quantity ?? 0]))
  return products.map((product) => ({ ...product, onHand: onHand.get(product.id) ?? 0 }))
}

/** Whether `id` looks like a uuid, so a bad form value can't reach a ::uuid cast. */
export function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}
