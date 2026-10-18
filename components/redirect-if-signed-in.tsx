import { redirect } from "next/navigation"

import { safeNextPath } from "@/lib/next-path"
import { readSession } from "@/lib/session"

// For the login and sign-up pages: someone already signed in goes on to where
// they were headed, or the dashboard. Checks the session in the database, not
// just the cookie, so a stale cookie can't bounce between here and /login.
// Reads the request, so render it inside <Suspense>.
export async function RedirectIfSignedIn({ next }: { next: unknown }) {
  if (await readSession()) redirect(safeNextPath(next) ?? "/dashboard")
  return null
}
