"use client"

import { useCallback, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { formatCount } from "@/lib/format"
import { MAX_SHOWN } from "@/lib/list-size"

/**
 * Infinite scroll for a server-rendered list: when the end of the list comes
 * into view, asks for the next page by raising `?show=`. The button does the
 * same for keyboards, or if scrolling doesn't trigger it.
 */
export function LoadMore({
  shown,
  total,
  pageSize,
  params = {},
}: {
  /** Rows asked for; may be more than there are. */
  shown: number
  total: number
  pageSize: number
  /** Other query params to keep, e.g. { q: "oud" }. */
  params?: Record<string, string>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const end = useRef<HTMLDivElement>(null)
  const visible = Math.min(shown, total)
  const more = visible < total && visible < MAX_SHOWN

  const loadMore = useCallback(() => {
    const search = new URLSearchParams(params)
    search.set("show", String(visible + pageSize))
    startTransition(() => router.replace(`?${search}`, { scroll: false }))
  }, [params, visible, pageSize, router])

  useEffect(() => {
    const node = end.current
    if (!more || pending || !node) return
    // Start loading a little before the end is reached.
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { rootMargin: "300px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [more, pending, loadMore])

  return (
    <div
      ref={end}
      className="flex flex-col items-center gap-2 py-2 text-sm text-muted-foreground"
    >
      {more ? (
        pending ? (
          <p className="flex items-center gap-2" role="status">
            <Spinner />
            Loading more…
          </p>
        ) : (
          <Button variant="outline" size="sm" onClick={loadMore}>
            Load more
          </Button>
        )
      ) : null}
      <p>
        {visible === total
          ? `Showing all ${formatCount(total)}`
          : `Showing ${formatCount(visible)} of ${formatCount(total)}`}
      </p>
    </div>
  )
}
