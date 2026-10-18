import { defineConfig } from "prisma/config"

// The Prisma CLI (generate, migrate, studio) reads its connection from the same
// DB_* variables as the app. Inside docker compose they are already in the
// environment; on the host they come from .env.
try {
  process.loadEnvFile()
} catch {
  // No .env file, e.g. during the docker build: rely on the environment.
}

function databaseUrl() {
  const { DB_HOST = "localhost", DB_PORT = "5432", DB_NAME = "", DB_USER = "", DB_PASSWORD = "" } =
    process.env
  const auth = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}`
  const schema = encodeURIComponent(process.env.DB_SCHEMA || "public")
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${encodeURIComponent(DB_NAME)}?schema=${schema}`
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl() },
})
