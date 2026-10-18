import { Pool } from "pg"

// One Postgres pool per server process. Connection settings come from the
// DB_* variables in .env; every connection uses DB_SCHEMA as its search_path,
// so queries can name tables without a schema prefix.

function env(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable ${name}`)
  }
  return value
}

function createPool() {
  const schema = env("DB_SCHEMA", "public")
  return new Pool({
    host: env("DB_HOST", "localhost"),
    port: Number(env("DB_PORT", "5432")),
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME"),
    // Quoted so mixed-case or reserved schema names work as written.
    options: `-c search_path="${schema.replaceAll('"', '""')}"`,
    max: Number(env("DB_POOL_MAX", "10")),
  })
}

// Reuse the pool across hot reloads in development instead of leaking one per edit.
const globalForDb = globalThis as unknown as { dbPool?: Pool }

export function getPool() {
  globalForDb.dbPool ??= createPool()
  return globalForDb.dbPool
}

export function query<Row extends object = Record<string, unknown>>(
  text: string,
  params?: unknown[]
) {
  return getPool().query<Row>(text, params)
}
