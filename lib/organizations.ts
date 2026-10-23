import { randomBytes } from "node:crypto"

import type { Prisma } from "@/lib/generated/prisma/client"
import { seedPlaces } from "@/lib/places"
import { getPrisma } from "@/lib/prisma"

export const MAX_ORGANIZATION_NAME = 100

/** "  Acme   Inc. " -> "Acme Inc.", so spacing alone can't make a name look new. */
export function normalizeOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, MAX_ORGANIZATION_NAME)
}

/** Whether a live organization already uses this name, ignoring case. */
export async function isOrganizationNameTaken(name: string) {
  // Cast to citext: compared as plain text, "ACME" wouldn't match "Acme".
  const rows = await getPrisma().$queryRaw<{ id: string }[]>`
    SELECT id FROM organizations WHERE name = ${name}::citext AND deleted_at IS NULL LIMIT 1`
  return rows.length > 0
}

// "Acme Inc." -> "acme-inc-3f9a1c": readable, and the suffix keeps it unique.
export function uniqueSlug(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return `${base || "workspace"}-${randomBytes(3).toString("hex")}`
}

// The roles every new organization starts with besides owner. They're the
// organization's own, so they can be renamed, changed or deleted like any other.
const STARTER_ROLES = [
  {
    key: "salesperson",
    name: "Salesperson",
    description: "Takes stock out to super dealers and signs up new ones",
    permissions: ["products.read", "dealers.read", "dealers.onboard", "deliveries.record"],
  },
  {
    key: "storekeeper",
    name: "Storekeeper",
    description: "Receives, counts and sends out stock",
    permissions: [
      "products.read",
      "warehouses.read",
      "dealers.read",
      "salespeople.read",
      "stock.read",
      "stock.receive",
      "stock.issue",
      "stock.transfer",
      "stock.adjust",
    ],
  },
]

/**
 * Creates an organization with the user as its owner and the starter roles,
 * and with Tanzania's zones, regions and districts when withPlaces is set.
 * Run inside a transaction.
 */
export async function createOrganizationWithOwner(
  tx: Prisma.TransactionClient,
  { name, userId, withPlaces }: { name: string; userId: string; withPlaces: boolean }
) {
  const owner = await tx.role.findFirstOrThrow({
    where: { organizationId: null, key: "owner" },
    select: { id: true },
  })
  const organization = await tx.organization.create({
    data: { name, slug: uniqueSlug(name), createdById: userId },
    select: { id: true },
  })
  await tx.membership.create({
    data: { organizationId: organization.id, userId, roleId: owner.id },
  })
  // Only keys the database has, in case one is renamed or dropped later.
  const known = new Set((await tx.permission.findMany({ select: { key: true } })).map((p) => p.key))
  for (const { permissions, ...role } of STARTER_ROLES) {
    await tx.role.create({
      data: {
        ...role,
        organizationId: organization.id,
        permissions: {
          create: permissions.filter((key) => known.has(key)).map((permissionKey) => ({ permissionKey })),
        },
      },
    })
  }
  if (withPlaces) await seedPlaces(tx, organization.id)
  return organization
}
