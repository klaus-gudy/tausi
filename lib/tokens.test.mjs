import assert from "node:assert/strict"
import { test } from "node:test"

import { createToken, hashToken } from "./tokens.ts"

test("hashToken is a stable sha256 hex digest", () => {
  assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  assert.equal(hashToken("abc"), hashToken("abc"))
})

test("createToken returns a random url-safe token with its hash", () => {
  const { token, tokenHash } = createToken()
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(tokenHash, hashToken(token))
  assert.notEqual(createToken().token, token)
})
