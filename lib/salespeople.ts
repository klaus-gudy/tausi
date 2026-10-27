import type { Prisma } from "@/lib/generated/prisma/client"

// A salesperson is a member of the organization plus the zone they cover:
// their name and email are their user's, their phone is their membership's.

/** Select this on a salesperson to show who they are. */
export const SALESPERSON_PERSON = {
  membership: {
    select: { status: true, phone: true, user: { select: { name: true, email: true } } },
  },
} as const

/** Order salespeople by name. */
export const BY_NAME = { membership: { user: { name: "asc" } } } as const

type Person = { membership: { user: { name: string | null; email: string } } }

/** A salesperson's name: their user's, or their email when they haven't given one. */
export function salespersonName(salesperson: Person) {
  const { user } = salesperson.membership
  return user.name || user.email
}

/**
 * Before a membership is deleted: removes the salesperson it's linked to, if
 * any. A salesperson with transfers or deliveries stays on record, so the
 * membership can't go; the message says what to do instead. Run inside the
 * transaction that deletes the membership.
 */
export async function releaseSalesperson(tx: Prisma.TransactionClient, membershipId: string) {
  const salesperson = await tx.salesperson.findUnique({
    where: { membershipId },
    select: { id: true, _count: { select: { transfers: true, deliveries: true } } },
  })
  if (!salesperson) return null
  if (salesperson._count.transfers || salesperson._count.deliveries) {
    return "They have transfers or deliveries as a salesperson. Deactivate them on Salespeople instead."
  }
  await tx.salesperson.delete({ where: { id: salesperson.id } })
  return null
}
