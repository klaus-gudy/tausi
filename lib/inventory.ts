import { Prisma } from "@/lib/generated/prisma/client"
import { formatCount } from "@/lib/format"
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

const MAX_LINES = 50

export type Line = { productId: string; quantity: number; unitCost: number | null }

/**
 * The product lines of a receive, issue or transfer form (parallel productId,
 * quantity and, with `withCost`, unitCost fields), or a message saying what's
 * wrong.
 */
export function readLines(formData: FormData, withCost: boolean): Line[] | string {
  const productIds = formData.getAll("productId").map(String)
  const quantities = formData.getAll("quantity")
  const unitCosts = formData.getAll("unitCost")
  const lines: Line[] = []
  for (const [index, productId] of productIds.entries()) {
    const quantityText = readText(quantities[index] ?? null)
    // A row left completely empty is ignored.
    if (!productId && !quantityText) continue
    const row = productIds.length > 1 ? ` on line ${index + 1}` : ""
    if (!isUuid(productId)) return `Pick a product${row}.`
    const quantity = readWholeNumber(quantityText)
    if (!quantity) return `Enter a quantity of at least 1${row}.`
    const costText = withCost ? readText(unitCosts[index] ?? null) : null
    const unitCost = costText === null ? null : readWholeNumber(costText)
    if (costText !== null && unitCost === null) return `Enter the unit cost as a whole number${row}.`
    lines.push({ productId, quantity, unitCost })
  }
  if (!lines.length) return "Add at least one product."
  if (lines.length > MAX_LINES) return `Record at most ${MAX_LINES} products at a time.`
  return lines
}

/** Quantities per product id, with the same product on two lines added up. */
export function sumLines(lines: Line[]) {
  const wanted = new Map<string, number>()
  for (const line of lines) {
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity)
  }
  return wanted
}

/** "1 unit", "12 units". */
export function plural(count: number, word: string) {
  return `${formatCount(count)} ${word}${count === 1 ? "" : "s"}`
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
      select: { id: true, name: true, archivedAt: true },
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
