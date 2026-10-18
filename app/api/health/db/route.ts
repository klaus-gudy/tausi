import { connection } from "next/server"

import { query } from "@/lib/db"

// Readiness probe: reports whether the database answers and which schema
// connections use. Kept apart from /api/health so liveness never depends on it.
export async function GET() {
  await connection()
  try {
    const { rows } = await query<{ schema: string }>(
      "select current_schema() as schema"
    )
    return Response.json({ status: "ok", schema: rows[0].schema })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ status: "error", message }, { status: 503 })
  }
}
