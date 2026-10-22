// Shared by the super dealers and stock pages, and safe in client components.

/** What a dealer is called in lists: the shop name, else the contact name. */
export function dealerName(dealer: { shopName: string | null; contactName: string | null }) {
  return dealer.shopName ?? dealer.contactName ?? "Unnamed dealer"
}

/** Sorts dealers by the name they're shown under. */
export function byDealerName<T extends { shopName: string | null; contactName: string | null }>(
  a: T,
  b: T
) {
  return dealerName(a).localeCompare(dealerName(b), "en", { sensitivity: "base" })
}

/**
 * A phone number as stored: "+255754123456". Tanzanian numbers may be typed
 * the local way ("0754 123 456") or with the country code, with or without
 * spaces, dashes and brackets; other countries need their "+" code. Null when
 * it isn't a phone number.
 */
export function normalizePhone(value: string) {
  const digits = value.replace(/[\s\-().]/g, "")
  if (/^0[1-9]\d{8}$/.test(digits)) return `+255${digits.slice(1)}`
  if (/^(\+|00)?255[1-9]\d{8}$/.test(digits)) return `+255${digits.slice(-9)}`
  if (/^\+255/.test(digits)) return null
  if (/^\+[1-9]\d{6,14}$/.test(digits)) return digits
  return null
}

/**
 * Tanzanian numbers grouped the usual way: mobiles "+255 754 123 456",
 * landlines "+255 22 211 0000". Others as stored.
 */
export function formatPhone(phone: string) {
  const mobile = /^\+255([67]\d{2})(\d{3})(\d{3})$/.exec(phone)
  if (mobile) return `+255 ${mobile[1]} ${mobile[2]} ${mobile[3]}`
  const landline = /^\+255(\d{2})(\d{3})(\d{4})$/.exec(phone)
  return landline ? `+255 ${landline[1]} ${landline[2]} ${landline[3]}` : phone
}

export type PlaceRegion = {
  key: string
  name: string
  districts: { key: string; name: string }[]
}

export type PlaceZone = { key: string; name: string; regions: PlaceRegion[] }

/**
 * A TRA Taxpayer Identification Number as stored: "123-456-789". It may be
 * typed with or without dashes or spaces. Null when it isn't nine digits.
 */
export function normalizeTin(value: string) {
  const digits = value.replace(/[\s-]/g, "")
  return /^\d{9}$/.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : null
}
