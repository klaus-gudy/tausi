import type { PlaceZone } from "@/lib/dealers"
import type { Prisma } from "@/lib/generated/prisma/client"
import { placeKey } from "@/lib/place-key"
import { getPrisma } from "@/lib/prisma"
import { TANZANIA_PLACES } from "@/lib/tanzania-places"

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

/**
 * Select this on a warehouse or dealer for where it is. Only the district is
 * stored; its region and that region's zone come with it.
 */
export const PLACE = {
  district: {
    select: {
      key: true,
      regionKey: true,
      name: true,
      region: { select: { name: true, zone: { select: { name: true } } } },
    },
  },
} as const

/** The region and district keys the place pickers start from, for a place read with PLACE. */
export function placeKeys(place: { district: { key: string; regionKey: string } | null }) {
  return { regionKey: place.district?.regionKey ?? null, districtKey: place.district?.key ?? null }
}

/**
 * The district a form's place pickers chose, from the regionKey and
 * districtKey they submit. No region means no place; a region needs its district.
 */
export async function pickedDistrict(
  organizationId: string,
  formData: FormData
): Promise<{ districtId: string | null } | { message: string }> {
  const regionKey = String(formData.get("regionKey") ?? "").trim().slice(0, 100)
  const districtKey = String(formData.get("districtKey") ?? "").trim().slice(0, 100)
  if (!regionKey) return { districtId: null }
  if (!districtKey) return { message: "Pick the district too." }
  // A district is only found in its own region, so finding it checks both.
  const district = await getPrisma().district.findUnique({
    where: { organizationId_regionKey_key: { organizationId, regionKey, key: districtKey } },
    select: { id: true },
  })
  return district ? { districtId: district.id } : { message: "Pick a district in that region." }
}

/**
 * Select this on a salesperson for what they cover. Only the smallest place
 * picked is stored, so at most one of these is set.
 */
export const COVERAGE = {
  zone: { select: { key: true, name: true } },
  region: { select: { key: true, name: true, zone: { select: { key: true, name: true } } } },
  district: {
    select: {
      key: true,
      regionKey: true,
      name: true,
      region: { select: { name: true, zone: { select: { key: true, name: true } } } },
    },
  },
} as const

type Named = { key: string; name: string }

/**
 * What a salesperson covers, read with COVERAGE: the zone it's in, the finer
 * place within it if there is one ("Ilala, Dar es Salaam"), and the keys the
 * place pickers start from.
 */
export function coverage(covered: {
  zone: Named | null
  region: (Named & { zone: Named }) | null
  district: { key: string; regionKey: string; name: string; region: { name: string; zone: Named } } | null
}) {
  const { zone, region, district } = covered
  if (district) {
    return {
      zone: district.region.zone,
      place: `${district.name}, ${district.region.name}`,
      keys: { zoneKey: district.region.zone.key, regionKey: district.regionKey, districtKey: district.key },
    }
  }
  if (region) {
    return { zone: region.zone, place: region.name, keys: { zoneKey: region.zone.key, regionKey: region.key, districtKey: null } }
  }
  return { zone, place: null, keys: { zoneKey: zone?.key ?? null, regionKey: null, districtKey: null } }
}

/**
 * What a form's place pickers chose for coverage, as the one place to store:
 * the district if one was picked, else the region, else the zone. Nothing
 * picked covers nothing.
 */
export async function pickedCoverage(
  organizationId: string,
  formData: FormData
): Promise<{ zoneKey: string | null; regionKey: string | null; districtId: string | null } | { message: string }> {
  const read = (name: string) => String(formData.get(name) ?? "").trim().slice(0, 100)
  const zoneKey = read("zoneKey")
  const regionKey = read("regionKey")
  const districtKey = read("districtKey")
  const none = { zoneKey: null, regionKey: null, districtId: null }
  const prisma = getPrisma()

  if (regionKey && districtKey) {
    const district = await prisma.district.findUnique({
      where: { organizationId_regionKey_key: { organizationId, regionKey, key: districtKey } },
      select: { id: true },
    })
    return district ? { ...none, districtId: district.id } : { message: "Pick a district in that region." }
  }
  if (regionKey) {
    const region = await prisma.region.findUnique({
      where: { organizationId_key: { organizationId, key: regionKey } },
      select: { zoneKey: true },
    })
    if (!region || (zoneKey && region.zoneKey !== zoneKey)) return { message: "Pick a region in that zone." }
    return { ...none, regionKey }
  }
  if (zoneKey) {
    const zone = await prisma.zone.findUnique({ where: { organizationId_key: { organizationId, key: zoneKey } } })
    return zone ? { ...none, zoneKey } : { message: "Pick the zone from the list." }
  }
  return none
}
