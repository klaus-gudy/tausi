// Where to go after signing in, from a "next" value in the URL or a form (set
// when an invitation link sent someone to log in). Only paths inside this app
// are allowed, so the value can't send people to another site.
export function safeNextPath(value: unknown) {
  if (typeof value !== "string") return null
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : null
}
