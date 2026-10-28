import assert from "node:assert/strict"
import { test } from "node:test"

import { isUuid, plural, readDay, readLines, readText, readWholeNumber, sumLines } from "./inventory.ts"

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"

function form(rows, withCost = false) {
  const data = new FormData()
  for (const row of rows) {
    data.append("productId", row[0])
    data.append("quantity", row[1])
    if (withCost) data.append("unitCost", row[2] ?? "")
  }
  return data
}

test("readText trims, cuts to max and turns empty into null", () => {
  assert.equal(readText("  hello "), "hello")
  assert.equal(readText("abcdef", 3), "abc")
  for (const empty of [null, "", "   "]) assert.equal(readText(empty), null)
})

test("readWholeNumber accepts whole numbers with commas up to a billion", () => {
  assert.equal(readWholeNumber("0"), 0)
  assert.equal(readWholeNumber(" 1,250 "), 1250)
  assert.equal(readWholeNumber("1000000000"), 1_000_000_000)
  for (const bad of [null, "", "-1", "1.5", "1e3", "abc", "1000000001"]) assert.equal(readWholeNumber(bad), null, String(bad))
})

test("readDay reads YYYY-MM-DD as UTC midnight and refuses bad or future days", () => {
  assert.equal(readDay("2026-01-31")?.toISOString(), "2026-01-31T00:00:00.000Z")
  const today = new Date().toISOString().slice(0, 10)
  assert.ok(readDay(today))
  for (const bad of [null, "", "2026-02-30", "2026-1-5", "31/01/2026", "2999-01-01"]) assert.equal(readDay(bad), null, String(bad))
})

test("isUuid matches uuids only", () => {
  assert.equal(isUuid(A), true)
  assert.equal(isUuid(A.toUpperCase()), true)
  for (const bad of ["", "abc", `${A}x`, A.replace(/-/g, "")]) assert.equal(isUuid(bad), false, bad)
})

test("readLines reads product lines and skips empty rows", () => {
  assert.deepEqual(readLines(form([[A, "5"], ["", ""], [B, "1,000"]]), false), [
    { productId: A, quantity: 5, unitCost: null },
    { productId: B, quantity: 1000, unitCost: null },
  ])
})

test("readLines reads unit costs only when asked, leaving a blank one null", () => {
  assert.deepEqual(readLines(form([[A, "2", "1500"], [B, "3", ""]], true), true), [
    { productId: A, quantity: 2, unitCost: 1500 },
    { productId: B, quantity: 3, unitCost: null },
  ])
  assert.deepEqual(readLines(form([[A, "2", "abc"]], true), false), [{ productId: A, quantity: 2, unitCost: null }])
})

test("readLines says what's wrong, naming the line when there are several", () => {
  assert.equal(readLines(form([["not-a-uuid", "2"]]), false), "Pick a product.")
  assert.equal(readLines(form([[A, "2"], [B, "0"]]), false), "Enter a quantity of at least 1 on line 2.")
  assert.equal(readLines(form([[A, "x"]]), false), "Enter a quantity of at least 1.")
  assert.equal(readLines(form([[A, "2", "1.5"]], true), true), "Enter the unit cost as a whole number.")
  assert.equal(readLines(form([["", ""]]), false), "Add at least one product.")
  assert.equal(readLines(new FormData(), false), "Add at least one product.")
  assert.equal(readLines(form(Array.from({ length: 51 }, () => [A, "1"])), false), "Record at most 50 products at a time.")
})

test("sumLines adds up the same product on several lines", () => {
  const lines = [
    { productId: A, quantity: 2, unitCost: null },
    { productId: B, quantity: 1, unitCost: null },
    { productId: A, quantity: 3, unitCost: null },
  ]
  assert.deepEqual([...sumLines(lines)], [
    [A, 5],
    [B, 1],
  ])
})

test("plural adds an s for anything but one and formats the count", () => {
  assert.equal(plural(1, "unit"), "1 unit")
  assert.equal(plural(0, "unit"), "0 units")
  assert.match(plural(1200, "unit"), /^1,200 units$/)
})
