import { PHASE_PRODUCTION_BUILD } from "next/constants"

// Runs once when a server instance starts.
export async function register() {
  // Background jobs need Node.js and a database, so not on the edge runtime
  // and not while `next build` prerenders.
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return

  const { scheduleCleanup } = await import("@/lib/cleanup")
  scheduleCleanup()
}
