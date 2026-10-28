import assert from "node:assert/strict"
import { test } from "node:test"

import { groupPermissions, PERMISSION_MODULES, withReadKeys } from "./permissions.ts"

test("every permission key is listed once and every read key belongs to its module", () => {
  const keys = PERMISSION_MODULES.flatMap((group) => group.permissions.map((permission) => permission.key))
  assert.equal(new Set(keys).size, keys.length)
  for (const group of PERMISSION_MODULES) {
    if (group.read) assert.ok(group.permissions.some((p) => p.key === group.read), group.key)
  }
})

test("groupPermissions keeps only existing keys, in catalogue order, and drops empty modules", () => {
  const modules = groupPermissions([
    { key: "warehouses.read", description: null },
    { key: "products.manage", description: null },
  ])
  assert.deepEqual(
    modules.map((group) => [group.key, group.permissions.map((p) => p.key)]),
    [
      ["products", ["products.manage"]],
      ["warehouses", ["warehouses.read"]],
    ]
  )
})

test("groupPermissions puts unknown keys under Other, labelled by description", () => {
  const modules = groupPermissions([
    { key: "reports.view", description: "View reports" },
    { key: "mystery", description: null },
  ])
  assert.equal(modules.length, 1)
  assert.equal(modules[0].key, "other")
  assert.deepEqual(modules[0].permissions, [
    { key: "reports.view", label: "View reports" },
    { key: "mystery", label: "mystery" },
  ])
})

test("withReadKeys adds the read key of every module touched", () => {
  assert.deepEqual([...withReadKeys(["products.manage", "dealers.onboard"])].sort(), [
    "dealers.onboard",
    "dealers.read",
    "products.manage",
    "products.read",
  ])
  assert.deepEqual([...withReadKeys(["unknown"])], ["unknown"])
  assert.deepEqual([...withReadKeys([])], [])
})
