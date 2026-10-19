// Shared by the warehouses page and its form, and safe in client components.

/** What a warehouse's capacity is estimated in; the same list is checked in the database. */
export const CAPACITY_UNITS = [
  { value: "units", label: "Units", short: "units" },
  { value: "cartons", label: "Cartons", short: "cartons" },
  { value: "pallets", label: "Pallets", short: "pallets" },
  { value: "tonnes", label: "Tonnes", short: "t" },
  { value: "sqm", label: "Square metres", short: "m²" },
] as const

export type CapacityUnit = (typeof CAPACITY_UNITS)[number]["value"]

export function isCapacityUnit(value: string): value is CapacityUnit {
  return CAPACITY_UNITS.some((unit) => unit.value === value)
}

const count = new Intl.NumberFormat()

/** "12,000 cartons", "450 m²". */
export function formatCapacity(capacity: number, unit: string) {
  const short = CAPACITY_UNITS.find((option) => option.value === unit)?.short ?? unit
  return `${count.format(capacity)} ${short}`
}
