import { getPrisma } from "@/lib/prisma"

// Housekeeping for rows that are only kept until they expire. Every statement
// is idempotent, so several app instances running it at once is harmless.

export async function cleanUpExpired() {
  const prisma = getPrisma()
  const now = new Date()
  const [sessions, invitations, rateLimits, tokens] = await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    // Kept as history; the status just says why they can't be used.
    prisma.invitation.updateMany({
      where: { status: "pending", expiresAt: { lte: now } },
      data: { status: "expired" },
    }),
    prisma.rateLimit.deleteMany({ where: { resetAt: { lte: now } } }),
    prisma.verificationToken.deleteMany({ where: { expiresAt: { lte: now } } }),
  ])
  return {
    sessions: sessions.count,
    invitations: invitations.count,
    rateLimits: rateLimits.count,
    verificationTokens: tokens.count,
  }
}

const HOUR = 60 * 60 * 1000
const started = Symbol.for("web-starter.cleanup")

/** Runs cleanUpExpired soon after start, then hourly, in this server process. */
export function scheduleCleanup() {
  // Once per process, even if dev reloads call register() again.
  const flags = globalThis as { [started]?: boolean }
  if (flags[started]) return
  flags[started] = true

  const run = () =>
    cleanUpExpired().then(
      (counts) => {
        if (Object.values(counts).some(Boolean)) console.info("[cleanup]", counts)
      },
      (error: unknown) => console.error("[cleanup] failed", error)
    )
  // unref: these timers never keep the process alive on their own.
  setTimeout(run, 60 * 1000).unref()
  setInterval(run, HOUR).unref()
}
