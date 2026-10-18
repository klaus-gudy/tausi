"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

import { FLASH_COOKIE, flashTypes, type Flash } from "@/lib/flash"

function readFlash(): Flash | null {
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${FLASH_COOKIE}=`))
  if (!entry) return null

  document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0`
  try {
    const flash = JSON.parse(
      decodeURIComponent(entry.slice(FLASH_COOKIE.length + 1))
    )
    return flashTypes.includes(flash?.type) && typeof flash.message === "string"
      ? flash
      : null
  } catch {
    return null
  }
}

function showFlash() {
  const flash = readFlash()
  if (flash) toast[flash.type](flash.message, { id: "flash" })
}

// Shows the flash message left by a server action, once, after it redirects.
export function FlashToaster() {
  const pathname = usePathname()

  useEffect(showFlash, [pathname])

  // A redirect back to the same page (a rejected form) leaves the pathname
  // unchanged, so also watch for the cookie being set.
  useEffect(() => {
    if (!("cookieStore" in window)) return
    const onChange = (event: CookieChangeEvent) => {
      if (event.changed.some((cookie) => cookie.name === FLASH_COOKIE)) showFlash()
    }
    window.cookieStore.addEventListener("change", onChange)
    return () => window.cookieStore.removeEventListener("change", onChange)
  }, [])

  return null
}
