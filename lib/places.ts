import type { PlaceZone } from "@/lib/dealers"
import { getPrisma } from "@/lib/prisma"

/** Every zone with its regions and their districts, for the dealer form. */
export async function readPlaces(): Promise<PlaceZone[]> {
  return getPrisma().zone.findMany({
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
