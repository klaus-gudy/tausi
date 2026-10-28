import assert from "node:assert/strict"
import { test } from "node:test"

import { TRANSFER_STATUS_LABELS, transferNumber } from "./transfers.ts"

test("transferNumber pads to four digits and keeps longer numbers whole", () => {
  assert.equal(transferNumber(7), "TR-0007")
  assert.equal(transferNumber(1234), "TR-1234")
  assert.equal(transferNumber(12345), "TR-12345")
})

test("every transfer status has a label", () => {
  assert.deepEqual(Object.keys(TRANSFER_STATUS_LABELS).sort(), ["arrived", "cancelled", "in_transit", "initiated"])
})
