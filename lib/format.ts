const count = new Intl.NumberFormat()

export function formatCount(value: number) {
  return count.format(value)
}

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

export function formatDate(value: Date) {
  return date.format(value)
}
