import assert from "node:assert/strict"
import { test } from "node:test"

import { isEmail } from "./email.ts"

test("isEmail accepts ordinary addresses", () => {
  for (const email of ["a@b.co", "first.last+tag@mail.example.co.tz", "x_y-z@sub.domain.org"]) {
    assert.equal(isEmail(email), true, email)
  }
})

test("isEmail rejects addresses with a missing or empty part", () => {
  for (const email of ["", "a", "a@b", "@b.co", "a@.b", "a@b.", "a@b..co", "a b@c.co", "a@b@c.co", "a@b .co"]) {
    assert.equal(isEmail(email), false, email)
  }
})

test("isEmail fails fast on input built to backtrack", () => {
  // The old pattern took seconds on 100k of these; this one stays linear.
  const hostile = `a@${".".repeat(200_000)} x`
  const started = performance.now()
  assert.equal(isEmail(hostile), false)
  assert.ok(performance.now() - started < 250, "took longer than 250 ms")
})
