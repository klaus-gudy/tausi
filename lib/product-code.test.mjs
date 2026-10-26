import assert from "node:assert/strict"
import { test } from "node:test"

import { productCode, uniqueProductCode } from "./product-code.ts"

test("productCode builds a readable code from the name and size", () => {
  assert.equal(productCode("Sunflower oil", "1L"), "SUNFLOWER-OIL-1L")
  assert.equal(productCode("Rice", null), "RICE")
  assert.equal(productCode("Rice"), "RICE")
  assert.equal(productCode("Crème brûlée", "250 g"), "CREME-BRULEE-250-G")
  assert.equal(productCode("  --Pads!! (Premium) ", "9 × 340mm"), "PADS-PREMIUM-9-340MM")
})

test("productCode is empty when there are no letters or digits", () => {
  assert.equal(productCode("!!!", " "), "")
})

test("productCode keeps to 40 characters without a trailing dash", () => {
  // The cut at 40 lands just after the dash before "B".
  const code = productCode(`${"A".repeat(39)} B`)
  assert.equal(code, "A".repeat(39))
  assert.ok(productCode("word ".repeat(20)).length <= 40)
})

test("uniqueProductCode adds the first free number", () => {
  assert.equal(uniqueProductCode("RICE", new Set()), "RICE")
  assert.equal(uniqueProductCode("RICE", new Set(["RICE"])), "RICE-2")
  assert.equal(uniqueProductCode("RICE", new Set(["RICE", "RICE-2", "RICE-3"])), "RICE-4")
})

test("uniqueProductCode shortens long codes to fit the number", () => {
  const long = "A".repeat(40)
  assert.equal(uniqueProductCode(long, new Set([long])), `${"A".repeat(38)}-2`)
  // Shortening that ends on a dash drops it rather than doubling up.
  const dashed = `${"A".repeat(37)}-BB`
  assert.equal(uniqueProductCode(dashed, new Set([dashed])), `${"A".repeat(37)}-2`)
})
