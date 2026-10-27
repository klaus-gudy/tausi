const count = new Intl.NumberFormat()

export function formatCount(value: number) {
  return count.format(value)
}

// Moments are shown as a clock in Tanzania reads them, whatever zone the
// server or browser runs in.
const TANZANIA = "Africa/Dar_es_Salaam"

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: TANZANIA })

export function formatDate(value: Date) {
  return date.format(value)
}

const time = new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: TANZANIA })

/** "9:20 AM" in Tanzania. */
export function formatTime(value: Date) {
  return time.format(value)
}

// Calendar days (@db.Date) arrive as UTC midnight; format them in UTC so they
// don't shift to the previous day west of Greenwich.
const day = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })

export function formatDay(value: Date) {
  return day.format(value)
}

/** "+12" or "−3", with thousands separators. */
export function formatSigned(value: number) {
  let sign = ""
  if (value > 0) sign = "+"
  else if (value < 0) sign = "−"
  return `${sign}${count.format(Math.abs(value))}`
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

/** 1,284 / 12.9K / 4.2M, for headline figures and axis ticks. */
export function formatCompact(value: number) {
  return Math.abs(value) < 10_000 ? count.format(value) : compact.format(value)
}

/**
 * An amount in Tanzanian shillings, the currency prices are kept in: "TZS 6,500",
 * or "TZS 4.2M" with `short`.
 */
export function formatMoney(value: number, short = false) {
  return `TZS ${short ? formatCompact(value) : count.format(value)}`
}
