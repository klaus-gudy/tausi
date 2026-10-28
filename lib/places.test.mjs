import assert from "node:assert/strict"
import { test } from "node:test"

import { coverage, placeKeys } from "./places.ts"

const coast = { key: "coast", name: "Coast" }
const dar = { key: "dar", name: "Dar es Salaam", zone: coast }

test("placeKeys reads the region and district a place starts from", () => {
  assert.deepEqual(placeKeys({ district: { key: "ilala", regionKey: "dar" } }), { regionKey: "dar", districtKey: "ilala" })
  assert.deepEqual(placeKeys({ district: null }), { regionKey: null, districtKey: null })
})

test("coverage of a district names it with its region", () => {
  const district = { key: "ilala", regionKey: "dar", name: "Ilala", region: { name: "Dar es Salaam", zone: coast } }
  assert.deepEqual(coverage({ zone: null, region: null, district }), {
    zone: coast,
    place: "Ilala, Dar es Salaam",
    keys: { zoneKey: "coast", regionKey: "dar", districtKey: "ilala" },
  })
})

test("coverage of a region or a zone", () => {
  assert.deepEqual(coverage({ zone: null, region: dar, district: null }), {
    zone: coast,
    place: "Dar es Salaam",
    keys: { zoneKey: "coast", regionKey: "dar", districtKey: null },
  })
  assert.deepEqual(coverage({ zone: coast, region: null, district: null }), {
    zone: coast,
    place: null,
    keys: { zoneKey: "coast", regionKey: null, districtKey: null },
  })
  assert.deepEqual(coverage({ zone: null, region: null, district: null }).keys, { zoneKey: null, regionKey: null, districtKey: null })
})
