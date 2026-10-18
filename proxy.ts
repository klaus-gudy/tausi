import { NextResponse, type NextRequest } from "next/server"

// Optimistic check only: sends visitors without a session cookie to /login
// before anything renders. Whether the session is real is checked against the
// database by getCurrentUser() (pages) and readSession() (server actions).
// Kept free of app imports so it stays light; the name matches SESSION_COOKIE
// in lib/session.ts.

const PUBLIC_PATHS = ["/login", "/sign-up", "/invite"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
  if (isPublic || request.cookies.has("session")) return NextResponse.next()

  return NextResponse.redirect(new URL("/login", request.url))
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
}
