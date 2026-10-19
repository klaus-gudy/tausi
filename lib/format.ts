const count = new Intl.NumberFormat()

export function formatCount(value: number) {
  return count.format(value)
}

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

export function formatDate(value: Date) {
  return date.format(value)
}

// Calendar days (@db.Date) arrive as UTC midnight; format them in UTC so they
// don't shift to the previous day west of Greenwich.
const day = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })

export function formatDay(value: Date) {
  return day.format(value)
}

/** "+12" or "−3", with thousands separators. */
export function formatSigned(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${count.format(Math.abs(value))}`
}
