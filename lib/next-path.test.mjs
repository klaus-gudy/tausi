import assert from "node:assert/strict"
import { test } from "node:test"

import { safeNextPath } from "./next-path.ts"

test("safeNextPath keeps paths inside the app", () => {
  for (const path of ["/", "/dashboard", "/invite/abc?x=1"]) assert.equal(safeNextPath(path), path)
})

test("safeNextPath drops other sites and non-strings", () => {
  for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "dashboard", "", null, undefined, 42, ["/"]]) {
    assert.equal(safeNextPath(bad), null, String(bad))
  }
})
