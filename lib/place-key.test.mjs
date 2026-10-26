import assert from "node:assert/strict"
import { test } from "node:test"

import { placeKey } from "./place-key.ts"
import { TANZANIA_PLACES } from "./tanzania-places.ts"

test("placeKey slugs a name", () => {
  assert.equal(placeKey("Dar es Salaam"), "dar-es-salaam")
  assert.equal(placeKey("Nyang'hwale"), "nyang-hwale")
  assert.equal(placeKey("  Mjini Magharibi "), "mjini-magharibi")
  assert.equal(placeKey("Kigoma-Ujiji (Town)"), "kigoma-ujiji-town")
  assert.equal(placeKey("!!!"), "")
})

test("every seeded region and district gets its own key", () => {
  // Regions are unique in an organization, districts within their region.
  const regions = TANZANIA_PLACES.flatMap((zone) => zone.regions)
  const regionKeys = regions.map((region) => placeKey(region.name))
  assert.equal(new Set(regionKeys).size, regionKeys.length)
  for (const region of regions) {
    const keys = region.districts.map(placeKey)
    assert.ok(keys.every(Boolean), region.name)
    assert.equal(new Set(keys).size, keys.length, region.name)
  }
})
