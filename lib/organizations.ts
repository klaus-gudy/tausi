import { randomBytes } from "node:crypto"

import type { Prisma } from "@/lib/generated/prisma/client"
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

/** Creates an organization with the user as its owner. Run inside a transaction. */
export async function createOrganizationWithOwner(
  tx: Prisma.TransactionClient,
  { name, userId }: { name: string; userId: string }
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
  return organization
}
