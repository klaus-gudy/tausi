import type { PlaceZone } from "@/lib/dealers"
import type { Prisma } from "@/lib/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { TANZANIA_PLACES } from "@/lib/tanzania-places"

/** "Dar es Salaam" -> "dar-es-salaam", "Nyang'hwale" -> "nyang-hwale". */
export function placeKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Gives a new organization Tanzania's zones, regions and districts, so its
 * dealers can be placed straight away. Run inside the transaction that
 * creates the organization.
 */
export async function seedPlaces(tx: Prisma.TransactionClient, organizationId: string) {
  const zones = TANZANIA_PLACES.map((zone, index) => ({
    organizationId,
    key: zone.key,
    name: zone.name,
    position: index + 1,
  }))
  const regions = TANZANIA_PLACES.flatMap((zone) =>
    zone.regions.map((region) => ({
      organizationId,
      zoneKey: zone.key,
      key: placeKey(region.name),
      name: region.name,
    }))
  )
  const districts = TANZANIA_PLACES.flatMap((zone) =>
    zone.regions.flatMap((region) =>
      region.districts.map((name) => ({
        organizationId,
        regionKey: placeKey(region.name),
        key: placeKey(name),
        name,
      }))
    )
  )
  await tx.zone.createMany({ data: zones })
  await tx.region.createMany({ data: regions })
  await tx.district.createMany({ data: districts })
}

/** The organization's zones with their regions and districts, for the dealer form. */
export async function readPlaces(organizationId: string): Promise<PlaceZone[]> {
  return getPrisma().zone.findMany({
    where: { organizationId },
    orderBy: { position: "asc" },
    select: {
      key: true,
      name: true,
      regions: {
        orderBy: { name: "asc" },
        select: {
          key: true,
          name: true,
          districts: { orderBy: { name: "asc" }, select: { key: true, name: true } },
        },
      },
    },
  })
}
