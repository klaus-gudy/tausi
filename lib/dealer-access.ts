import type { Prisma } from "@/lib/generated/prisma/client"
import type { ActiveMember } from "@/lib/membership"
import { getPrisma } from "@/lib/prisma"

// Which super dealers a member may see and work with. dealers.read_all opens
// every one; anyone else sees only the dealers in the zone, region or district
// their salesperson record covers, and none if they cover nowhere.

/** The districts whose dealers `member` may see, or null for every district. */
export async function coveredDistricts(
  member: ActiveMember
): Promise<Prisma.DistrictWhereInput | null> {
  if (member.permissions.has("dealers.read_all")) return null
  const salesperson = await getPrisma().salesperson.findFirst({
    where: { membershipId: member.membershipId, deactivatedAt: null },
    select: { zoneKey: true, regionKey: true, districtId: true },
  })
  if (salesperson?.districtId) return { id: salesperson.districtId }
  if (salesperson?.regionKey) return { regionKey: salesperson.regionKey }
  if (salesperson?.zoneKey) return { region: { zoneKey: salesperson.zoneKey } }
  return { id: { in: [] } }
}

/** A where-clause for the organization's super dealers `member` may see. */
export async function dealerScope(member: ActiveMember): Promise<Prisma.SuperDealerWhereInput> {
  const districts = await coveredDistricts(member)
  return { organizationId: member.organization.id, ...(districts ? { district: districts } : {}) }
}

/**
 * Whether a dealer placed in `districtId` would be one `member` may see, so
 * they don't add or move a dealer out of their own reach.
 */
export async function canPlaceDealer(member: ActiveMember, districtId: string | null) {
  const districts = await coveredDistricts(member)
  if (!districts) return true
  if (!districtId) return false
  const count = await getPrisma().district.count({
    where: { AND: [{ id: districtId, organizationId: member.organization.id }, districts] },
  })
  return count > 0
}
