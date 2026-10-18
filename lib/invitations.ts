import type { Prisma } from "@/lib/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { hashToken } from "@/lib/tokens"

/**
 * The invitation behind a link's token, if it can still be accepted: pending,
 * not expired, and for an organization that still exists.
 */
export async function findOpenInvitation(token: string) {
  const invitation = await getPrisma().invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
      roleId: true,
      role: { select: { name: true } },
      organization: { select: { id: true, name: true, deletedAt: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  })
  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt <= new Date() ||
    invitation.organization.deletedAt
  ) {
    return null
  }
  return invitation
}

/** The token in an invitation path ("/invite/<token>"), or null for any other path. */
export function invitationToken(path: string | null | undefined) {
  if (!path?.startsWith("/invite/")) return null
  try {
    return decodeURIComponent(path.slice("/invite/".length)) || null
  } catch {
    return null
  }
}

/**
 * Accepts an invitation for a user: marks it used and gives them the invited
 * role. Run inside a transaction. False if someone used the link first.
 */
export async function claimInvitation(
  tx: Prisma.TransactionClient,
  invitation: { id: string; roleId: string; organization: { id: string } },
  userId: string
) {
  // Claim the invitation first, so a link can't be used twice at once.
  const { count } = await tx.invitation.updateMany({
    where: { id: invitation.id, status: "pending", expiresAt: { gt: new Date() } },
    data: { status: "accepted", acceptedAt: new Date(), acceptedById: userId },
  })
  if (!count) return false

  const organizationId = invitation.organization.id
  const existing = await tx.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { id: true },
  })
  if (!existing) {
    await tx.membership.create({ data: { organizationId, userId, roleId: invitation.roleId } })
  }
  // Following the link sent to the address proves they own it.
  await tx.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  })
  return true
}
