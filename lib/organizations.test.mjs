import assert from "node:assert/strict"
import { test } from "node:test"

import { MAX_ORGANIZATION_NAME, normalizeOrganizationName, uniqueSlug } from "./organizations.ts"

test("normalizeOrganizationName collapses spacing and cuts long names", () => {
  assert.equal(normalizeOrganizationName("  Acme   Inc. "), "Acme Inc.")
  assert.equal(normalizeOrganizationName("x".repeat(150)).length, MAX_ORGANIZATION_NAME)
})

test("uniqueSlug is a readable base plus a random suffix", () => {
  assert.match(uniqueSlug("Acme Inc."), /^acme-inc-[0-9a-f]{6}$/)
  assert.match(uniqueSlug("Café Ñandú"), /^cafe-nandu-[0-9a-f]{6}$/)
  assert.match(uniqueSlug("!!!"), /^workspace-[0-9a-f]{6}$/)
  assert.ok(uniqueSlug("x".repeat(100)).length <= 47)
  assert.notEqual(uniqueSlug("Acme"), uniqueSlug("Acme"))
})
