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
