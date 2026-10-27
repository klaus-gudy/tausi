/** The most rows a list loads, however far someone scrolls. */
export const MAX_SHOWN = 500

/**
 * How many rows a list shows, from its `?show=` param: a whole number of
 * pages, at least one page and at most MAX_SHOWN. Lists load more as you
 * scroll by raising it (see LoadMore).
 */
export function shownCount(param: string | string[] | undefined, pageSize: number) {
  const requested = Number(param)
  if (!Number.isInteger(requested) || requested <= pageSize) return pageSize
  return Math.min(Math.ceil(requested / pageSize) * pageSize, MAX_SHOWN)
}

/** The page a paged list is on, from its `?page=` param: 1 unless a whole number above 1. */
export function pageNumber(param: string | string[] | undefined) {
  const page = Number(param)
  return Number.isInteger(page) && page > 1 ? page : 1
}

/** The page a list of `total` rows shows: its `?page=`, or the last page when that's past the end. */
export function currentPage(param: string | string[] | undefined, total: number, pageSize: number) {
  return Math.min(pageNumber(param), Math.max(1, Math.ceil(total / pageSize)))
}

/**
 * The page numbers to link to, with "gap" where some are left out: always the
 * first and last, and the ones either side of `page`. 1 … 4 5 6 … 20.
 */
export function pageWindow(page: number, last: number): (number | "gap")[] {
  const kept = [...new Set([1, page - 1, page, page + 1, last])]
    .filter((n) => n >= 1 && n <= last)
    .sort((a, b) => a - b)
  const pages: (number | "gap")[] = []
  for (const n of kept) {
    const previous = pages.at(-1)
    // A single left-out page is shown rather than hidden behind a gap.
    if (typeof previous === "number" && n - previous === 2) pages.push(n - 1)
    else if (typeof previous === "number" && n - previous > 2) pages.push("gap")
    pages.push(n)
  }
  return pages
}
