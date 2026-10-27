import type { Prisma } from "@/lib/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { syncSalesperson } from "@/lib/salespeople"
import { createToken, hashToken } from "@/lib/tokens"

const INVITATION_DAYS = 7

/**
 * Adds someone to an organization as an invited member and returns the link
 * that lets them join. Their user is made now if they have none, with the
 * name given here and no password; the membership holds their role and phone.
 * Inviting the same address again updates them and replaces the earlier link.
 * Run inside a transaction, after checking they aren't a member already.
 * No email is sent yet: whoever invites passes the link on.
 */
export async function createInvitation(
  tx: Prisma.TransactionClient,
  data: {
    organizationId: string
    email: string
    name: string | null
    phone: string | null
    roleId: string
    invitedById: string
  }
) {
  const { organizationId, email, name, phone, roleId, invitedById } = data
  const existing = await tx.user.findUnique({
    where: { email },
    select: { id: true, authAccounts: { select: { id: true }, take: 1 } },
  })
  let userId = existing?.id
  if (!userId) {
    userId = (await tx.user.create({ data: { email, name }, select: { id: true } })).id
  } else if (!existing?.authAccounts.length && name) {
    // Nobody has signed in as them yet, so the latest name given is theirs.
    await tx.user.update({ where: { id: userId }, data: { name } })
  }

  const membership = await tx.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { id: true, status: true },
  })
  if (membership && membership.status !== "invited") throw new Error(`${email} is already a member.`)
  const membershipId = membership
    ? (await tx.membership.update({
        where: { id: membership.id },
        data: { roleId, phone, invitedById },
        select: { id: true },
      })).id
    : (await tx.membership.create({
        data: { organizationId, userId, roleId, phone, invitedById, status: "invited" },
        select: { id: true },
      })).id
  // Invited with the Salesperson role, they're a salesperson from now on.
  await syncSalesperson(tx, membershipId)

  const { token, tokenHash } = createToken()
  await tx.invitation.updateMany({
    where: { organizationId, email, status: "pending" },
    data: { status: "revoked" },
  })
  await tx.invitation.create({
    data: {
      organizationId,
      email,
      tokenHash,
      invitedById,
      expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
    },
  })
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invite/${token}`
  return { membershipId, link }
}

/**
 * The invitation behind a link's token, if it can still be accepted: pending,
 * not expired, for an organization that still exists and a member still
 * waiting to join. Comes with that member's role and the name they were given.
 */
export async function findOpenInvitation(token: string) {
  const prisma = getPrisma()
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
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
  const membership = await prisma.membership.findFirst({
    where: { organizationId: invitation.organization.id, status: "invited", user: { email: invitation.email } },
    select: { id: true, role: { select: { name: true } }, user: { select: { name: true } } },
  })
  if (!membership) return null
  return { ...invitation, membershipId: membership.id, role: membership.role, name: membership.user.name }
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
 * Accepts an invitation for its user: marks it used and makes their invited
 * membership active. Run inside a transaction. False if someone used the link first.
 */
export async function claimInvitation(
  tx: Prisma.TransactionClient,
  invitation: { id: string; membershipId: string },
  userId: string
) {
  // Claim the invitation first, so a link can't be used twice at once.
  const { count } = await tx.invitation.updateMany({
    where: { id: invitation.id, status: "pending", expiresAt: { gt: new Date() } },
    data: { status: "accepted", acceptedAt: new Date(), acceptedById: userId },
  })
  if (!count) return false

  const { count: joined } = await tx.membership.updateMany({
    where: { id: invitation.membershipId, userId, status: "invited" },
    data: { status: "active", joinedAt: new Date() },
  })
  // Throwing undoes the claim: the member was removed or joined some other way.
  if (!joined) throw new Error("The invited membership is gone.")

  // Following the link sent to the address proves they own it.
  await tx.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  })
  return true
}
