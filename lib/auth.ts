import { redirect } from "next/navigation"

import { readSession } from "@/lib/session"

export type CurrentUser = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  organization: { id: string; slug: string; name: string } | null
}

/**
 * The signed-in user for rendering, or a redirect to /login. Reads the
 * request, so call it behind a <Suspense> boundary, never at the top of a
 * layout. Server actions re-check with readSession() instead of trusting this.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  "use cache: private"

  const session = await readSession()
  if (!session) redirect("/login")

  const { user, activeOrganization: org } = session
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    organization:
      org && !org.deletedAt ? { id: org.id, slug: org.slug, name: org.name } : null,
  }
}
