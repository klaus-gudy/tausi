import assert from "node:assert/strict"
import { test } from "node:test"

import { MAX_SUPPLIER_NAME, normalizeSupplierName } from "./suppliers.ts"

test("normalizeSupplierName collapses spacing and turns empty into null", () => {
  assert.equal(normalizeSupplierName("  Bidco   Tanzania "), "Bidco Tanzania")
  assert.equal(normalizeSupplierName("x".repeat(300)).length, MAX_SUPPLIER_NAME)
  for (const empty of [null, "", "   "]) assert.equal(normalizeSupplierName(empty), null)
})
