import type { Prisma } from "@/lib/generated/prisma/client"
import { isUuid, type ActionResult } from "@/lib/inventory"
import { getPrisma } from "@/lib/prisma"

/** Every organization has this supplier; stock received without one is filed under it. */
export const DEFAULT_SUPPLIER = "Manufactured"

export const MAX_SUPPLIER_NAME = 200

/** "  Bidco   Tanzania " -> "Bidco Tanzania", or null when empty. */
export function normalizeSupplierName(value: FormDataEntryValue | null) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_SUPPLIER_NAME)
  return name || null
}

/** The organization's "Manufactured" supplier, added if it's missing. */
export function defaultSupplier(
  organizationId: string,
  client: Prisma.TransactionClient = getPrisma()
) {
  return client.supplier.upsert({
    where: { organizationId_name: { organizationId, name: DEFAULT_SUPPLIER } },
    create: { organizationId, name: DEFAULT_SUPPLIER },
    update: {},
    select: { id: true, name: true },
  })
}

/**
 * The supplier a receive form picked, or a message saying what's wrong with
 * the pick. None picked means the organization made it: "Manufactured".
 */
export async function pickedSupplier(
  organizationId: string,
  value: FormDataEntryValue | null
): Promise<{ id: string; name: string } | ActionResult> {
  const id = String(value ?? "")
  if (!id) return defaultSupplier(organizationId)
  const supplier = isUuid(id)
    ? await getPrisma().supplier.findFirst({
        where: { id, organizationId },
        select: { id: true, name: true },
      })
    : null
  return supplier ?? { message: "That supplier no longer exists. Pick another." }
}
