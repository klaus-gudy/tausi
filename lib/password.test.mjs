import assert from "node:assert/strict"
import { test } from "node:test"

import { hashPassword, verifyNothing, verifyPassword } from "./password.ts"

test("hashPassword stores the scheme, cost and a fresh salt", async () => {
  const first = await hashPassword("correct horse")
  const second = await hashPassword("correct horse")
  assert.match(first, /^scrypt\$32768\$8\$1\$[^$]+\$[^$]+$/)
  assert.notEqual(first, second)
})

test("verifyPassword accepts the right password and rejects others", async () => {
  const stored = await hashPassword("correct horse")
  assert.equal(await verifyPassword("correct horse", stored), true)
  assert.equal(await verifyPassword("Correct horse", stored), false)
  assert.equal(await verifyPassword("", stored), false)
})

test("verifyPassword treats differently composed Unicode as the same password", async () => {
  const stored = await hashPassword("café")
  assert.equal(await verifyPassword("café", stored), true)
})

test("verifyPassword rejects malformed stored hashes", async () => {
  for (const stored of ["", "plain", "bcrypt$1$2$3$c2FsdA==$aGFzaA==", "scrypt$32768$8$1$$"]) {
    assert.equal(await verifyPassword("anything", stored), false, stored)
  }
})

test("verifyNothing always fails", async () => {
  assert.equal(await verifyNothing("not-a-real-password"), false)
})
