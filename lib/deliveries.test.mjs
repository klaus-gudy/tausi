import assert from "node:assert/strict"
import { test } from "node:test"

import { deliveryNumber } from "./deliveries.ts"

test("deliveryNumber pads to four digits and keeps longer numbers whole", () => {
  assert.equal(deliveryNumber(7), "DL-0007")
  assert.equal(deliveryNumber(12345), "DL-12345")
})
