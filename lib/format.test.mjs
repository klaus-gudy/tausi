import assert from "node:assert/strict"
import { test } from "node:test"

import { formatCompact, formatCount, formatDay, formatMoney, formatSigned } from "./format.ts"

// Counts use the runtime's locale, so expectations are built with it too.
const count = (value) => new Intl.NumberFormat().format(value)

test("formatCount adds the locale's thousands separators", () => {
  assert.equal(formatCount(1284), count(1284))
})

test("formatSigned marks gains and losses but not zero", () => {
  assert.equal(formatSigned(12), "+12")
  assert.equal(formatSigned(-3), "−3")
  assert.equal(formatSigned(0), "0")
  assert.equal(formatSigned(-12_345), `−${count(12_345)}`)
})

test("formatCompact shortens figures from ten thousand up", () => {
  assert.equal(formatCompact(9_999), count(9_999))
  assert.equal(formatCompact(12_900), "12.9K")
  assert.equal(formatCompact(4_200_000), "4.2M")
  assert.equal(formatCompact(-12_900), "-12.9K")
})

test("formatMoney prices in shillings, in full or short", () => {
  assert.equal(formatMoney(6_500), `TZS ${count(6_500)}`)
  assert.equal(formatMoney(4_200_000, true), "TZS 4.2M")
})

test("formatDay shows calendar days as stored, whatever the time zone", () => {
  // @db.Date values arrive as UTC midnight.
  assert.equal(formatDay(new Date("2026-03-01T00:00:00Z")), "Mar 1, 2026")
})
