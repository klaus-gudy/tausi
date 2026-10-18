// A one-time toast message carried across a redirect in a short-lived cookie.
// Server actions write it with setFlash(); <FlashToaster /> shows and clears it.

export const FLASH_COOKIE = "flash"

export const flashTypes = ["success", "error", "info", "warning"] as const

export type Flash = {
  type: (typeof flashTypes)[number]
  message: string
}
