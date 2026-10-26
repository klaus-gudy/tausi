// Kept apart from lib/places.ts, which needs the database, so anything can
// make a key from a name.

/** "Dar es Salaam" -> "dar-es-salaam", "Nyang'hwale" -> "nyang-hwale". */
export function placeKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
