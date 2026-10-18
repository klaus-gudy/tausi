import { cookies, headers } from "next/headers"

import { getPrisma } from "@/lib/prisma"
import { clientIp } from "@/lib/rate-limit"
import { createToken, hashToken } from "@/lib/tokens"

// Database sessions. The browser holds a random token in an httpOnly cookie;
// the sessions table holds its SHA-256 hash, so signing out anywhere (or
// deleting the row) ends the session immediately.

export const SESSION_COOKIE = "session"
const SESSION_DAYS = 30

export async function createSession(userId: string, activeOrganizationId: string | null) {
  const { token, tokenHash } = createToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  const requestHeaders = await headers()

  await getPrisma().session.create({
    data: {
      tokenHash,
      userId,
      activeOrganizationId,
      ipAddress: await clientIp(),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

/**
 * The signed-in session with its user and active organization, or null.
 * Uncached: server actions call it to authorize themselves. Components use
 * getCurrentUser() from lib/auth instead.
 */
export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await getPrisma().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, email: true, name: true, avatarUrl: true, deletedAt: true } },
      activeOrganization: { select: { id: true, slug: true, name: true, deletedAt: true } },
    },
  })
  if (!session || session.expiresAt <= new Date() || session.user.deletedAt) return null
  return session
}

export async function deleteSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await getPrisma().session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  cookieStore.delete(SESSION_COOKIE)
}
