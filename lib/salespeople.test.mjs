import assert from "node:assert/strict"
import { test } from "node:test"

import { salespersonName } from "./salespeople.ts"

test("salespersonName uses the name, else the email", () => {
  assert.equal(salespersonName({ membership: { user: { name: "Asha", email: "asha@example.com" } } }), "Asha")
  for (const name of [null, ""]) {
    assert.equal(salespersonName({ membership: { user: { name, email: "asha@example.com" } } }), "asha@example.com")
  }
})
