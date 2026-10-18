import { headers } from "next/headers"

import { getPrisma } from "@/lib/prisma"

// Fixed-window rate limiting backed by the rate_limits table, so limits hold
// across restarts and across several app instances.

/**
 * The visitor's IP address, from the first X-Forwarded-For entry. Only
 * trustworthy behind a proxy that sets the header (and strips any the client
 * sent); without one, clients can put anything there.
 */
export async function clientIp() {
  const requestHeaders = await headers()
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null
}

/**
 * Counts one attempt against `key` and says whether it's within `limit`
 * attempts per `windowSeconds`. One atomic statement, so concurrent requests
 * can't both slip under the limit.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const [row] = await getPrisma().$queryRaw<{ count: number; reset_at: Date }[]>`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}::double precision))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now()
        THEN now() + make_interval(secs => ${windowSeconds}::double precision)
        ELSE rate_limits.reset_at END
    RETURNING count, reset_at`
  const retryAfterSeconds = Math.max(1, Math.ceil((row.reset_at.getTime() - Date.now()) / 1000))
  return { allowed: row.count <= limit, retryAfterSeconds }
}

/** "Too many attempts. Try again in 12 minutes." */
export function tooManyAttempts(retryAfterSeconds: number) {
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return `Too many attempts. Try again in ${minutes === 1 ? "a minute" : `${minutes} minutes`}.`
}
