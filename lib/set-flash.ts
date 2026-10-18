import { cookies } from "next/headers"

import { FLASH_COOKIE, type Flash } from "@/lib/flash"

// Call from server actions before redirecting. Deliberately not a server
// action itself, so it isn't exposed as an endpoint.
export async function setFlash(flash: Flash) {
  const cookieStore = await cookies()
  // Readable by the client on purpose; it only ever holds UI text.
  cookieStore.set(FLASH_COOKIE, JSON.stringify(flash), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
  })
}
