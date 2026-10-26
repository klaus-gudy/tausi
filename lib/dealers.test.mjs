import assert from "node:assert/strict"
import { test } from "node:test"

import { byDealerName, dealerName, formatPhone, normalizePhone, normalizeTin } from "./dealers.ts"

test("normalizePhone stores Tanzanian numbers however they're typed", () => {
  for (const typed of ["0754 123 456", "0754-123-456", "(0754) 123.456", "255754123456", "+255 754 123 456", "00255754123456"]) {
    assert.equal(normalizePhone(typed), "+255754123456", typed)
  }
  assert.equal(normalizePhone("022 211 0000"), "+255222110000")
})

test("normalizePhone keeps other countries' numbers with their + code", () => {
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958")
  assert.equal(normalizePhone("+1 (415) 555-0100"), "+14155550100")
})

test("normalizePhone rejects what isn't a phone number", () => {
  for (const typed of ["", "12345", "0054 123 456", "+255 754 123", "+255 754 123 4567", "754123456", "+0123456789", "phone"]) {
    assert.equal(normalizePhone(typed), null, typed)
  }
})

test("formatPhone groups Tanzanian mobiles and landlines", () => {
  assert.equal(formatPhone("+255754123456"), "+255 754 123 456")
  assert.equal(formatPhone("+255622123456"), "+255 622 123 456")
  assert.equal(formatPhone("+255222110000"), "+255 22 211 0000")
  assert.equal(formatPhone("+442079460958"), "+442079460958")
})

test("normalizeTin stores nine digits as 123-456-789", () => {
  for (const typed of ["123456789", "123-456-789", "123 456 789", " 123-456 789 "]) {
    assert.equal(normalizeTin(typed), "123-456-789", typed)
  }
  for (const typed of ["", "12345678", "1234567890", "12345678a", "123.456.789"]) {
    assert.equal(normalizeTin(typed), null, typed)
  }
})

test("dealerName prefers the shop name, then the contact", () => {
  assert.equal(dealerName({ shopName: "Mama Shop", contactName: "Asha" }), "Mama Shop")
  assert.equal(dealerName({ shopName: null, contactName: "Asha" }), "Asha")
  assert.equal(dealerName({ shopName: null, contactName: null }), "Unnamed dealer")
})

test("byDealerName sorts by the shown name, ignoring case", () => {
  const dealers = [
    { shopName: "zuri Store", contactName: null },
    { shopName: null, contactName: "Baraka" },
    { shopName: "Amani", contactName: "Zawadi" },
  ]
  assert.deepEqual(dealers.toSorted(byDealerName).map(dealerName), ["Amani", "Baraka", "zuri Store"])
})
