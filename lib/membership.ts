import { getPrisma } from "@/lib/prisma"
import { readSession } from "@/lib/session"

// Who the signed-in user is inside their active organization, and what their
// role lets them do. Uncached: server actions call it on every request to
// authorize themselves, and pages call it behind <Suspense>.

export const SYSTEM_ROLES = ["owner", "admin", "member", "viewer"] as const
export type SystemRole = (typeof SYSTEM_ROLES)[number]

export type ActiveMember = {
  userId: string
  membershipId: string
  organization: { id: string; name: string; slug: string }
  role: { id: string; key: string; name: string }
  permissions: Set<string>
}

export async function readActiveMember(): Promise<ActiveMember | null> {
  const session = await readSession()
  const organizationId = session?.activeOrganizationId
  if (!session || !organizationId) return null

  const membership = await getPrisma().membership.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.userId } },
    select: {
      id: true,
      status: true,
      organization: {
        select: { id: true, name: true, slug: true, deletedAt: true },
      },
      role: {
        select: { id: true, key: true, name: true, permissions: { select: { permissionKey: true } } },
      },
    },
  })
  if (!membership || membership.status !== "active" || membership.organization.deletedAt) {
    return null
  }

  const { organization, role } = membership
  return {
    userId: session.userId,
    membershipId: membership.id,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    role: { id: role.id, key: role.key, name: role.name },
    permissions: new Set(role.permissions.map((grant) => grant.permissionKey)),
  }
}

/** The organizations the user can switch to, by name. */
export async function listOrganizations(userId: string) {
  const memberships = await getPrisma().membership.findMany({
    where: { userId, status: "active", organization: { deletedAt: null } },
    orderBy: { organization: { name: "asc" } },
    select: {
      organization: { select: { id: true, name: true } },
      role: { select: { name: true } },
    },
  })
  return memberships.map(({ organization, role }) => ({ ...organization, roleName: role.name }))
}

/**
 * Roles a member may be given in this organization: the system roles plus
 * its own. Only owners can hand out the owner role.
 */
export async function assignableRoles(member: ActiveMember) {
  const roles = await getPrisma().role.findMany({
    where: { OR: [{ organizationId: null }, { organizationId: member.organization.id }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, key: true, name: true, organizationId: true },
  })
  // System roles were seeded together, so order them by rank, not by date.
  const rank = (key: string, custom: boolean) =>
    custom ? SYSTEM_ROLES.length : SYSTEM_ROLES.indexOf(key as SystemRole)
  return roles
    .filter((role) => role.key !== "owner" || member.role.key === "owner")
    .sort((a, b) => rank(a.key, !!a.organizationId) - rank(b.key, !!b.organizationId))
}
