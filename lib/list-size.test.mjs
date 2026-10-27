import assert from "node:assert/strict"
import { test } from "node:test"

import { currentPage, pageNumber, pageSize, pageWindow } from "./list-size.ts"

test("pageNumber reads ?page= and falls back to the first page", () => {
  assert.equal(pageNumber(undefined), 1)
  assert.equal(pageNumber("3"), 3)
  for (const bad of ["0", "-2", "2.5", "abc", ["2", "3"]]) assert.equal(pageNumber(bad), 1, String(bad))
})

test("pageSize reads ?size= and falls back to 10 rows", () => {
  assert.equal(pageSize(undefined), 10)
  assert.equal(pageSize("50"), 50)
  for (const bad of ["0", "30", "1000", "abc", ["25", "50"]]) assert.equal(pageSize(bad), 10, String(bad))
})

test("currentPage keeps the page within the pages there are", () => {
  assert.equal(currentPage("2", 60, 25), 2)
  assert.equal(currentPage("9", 60, 25), 3)
  assert.equal(currentPage("4", 0, 25), 1)
  assert.equal(currentPage(undefined, 60, 25), 1)
})

test("pageWindow keeps the ends and the pages around the current one", () => {
  assert.deepEqual(pageWindow(1, 1), [1])
  assert.deepEqual(pageWindow(1, 5), [1, 2, "gap", 5])
  assert.deepEqual(pageWindow(5, 20), [1, "gap", 4, 5, 6, "gap", 20])
  assert.deepEqual(pageWindow(20, 20), [1, "gap", 19, 20])
})

test("pageWindow shows a lone left-out page instead of a gap", () => {
  assert.deepEqual(pageWindow(4, 7), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(pageWindow(3, 4), [1, 2, 3, 4])
})
