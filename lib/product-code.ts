// Product codes are made from the name so anyone can read them:
// "Sunflower oil 1L" becomes "SUNFLOWER-OIL-1L". Shared by the add-product
// form, which previews it, and the action, which saves it.

const MAX_LENGTH = 40

/** The code for a product name, or "" when the name has no letters or digits. */
export function productCode(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, "")
}

/** `code`, or `code-2`, `code-3`… whichever `taken` (upper-cased codes) doesn't hold. */
export function uniqueProductCode(code: string, taken: Set<string>) {
  if (!taken.has(code)) return code
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const candidate = `${code.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}
