import { PrismaPg } from "@prisma/adapter-pg"

import { getPool } from "@/lib/db"
import { PrismaClient } from "@/lib/generated/prisma/client"

// Prisma runs on the same pg pool as query(), so both share one set of
// connections and the DB_SCHEMA search_path. Regenerate the client after
// editing prisma/schema.prisma with `npm run db:generate`.

function createPrisma() {
  const adapter = new PrismaPg(getPool(), { schema: process.env.DB_SCHEMA || "public" })
  return new PrismaClient({ adapter })
}

// Reuse the client across hot reloads in development, like the pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function getPrisma() {
  globalForPrisma.prisma ??= createPrisma()
  return globalForPrisma.prisma
}
