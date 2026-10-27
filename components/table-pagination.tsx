import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import { formatCount } from "@/lib/format"
import { pageWindow } from "@/lib/list-size"

/**
 * Numbered pages under a server-rendered table, kept in `?page=`. Says which
 * rows are showing; with a single page that's all there is to show.
 */
export function TablePagination({
  page,
  total,
  pageSize,
  params = {},
}: {
  page: number
  total: number
  pageSize: number
  /** Other query params to keep, e.g. { tab: "arrived" }. */
  params?: Record<string, string>
}) {
  const last = Math.max(1, Math.ceil(total / pageSize))
  const first = (page - 1) * pageSize + 1
  const href = (to: number) => {
    const search = new URLSearchParams(params)
    if (to > 1) search.set("page", String(to))
    const query = search.toString()
    return query ? `?${query}` : "?"
  }

  return (
    <div className="flex flex-col items-center gap-2 pt-2 text-sm text-muted-foreground sm:flex-row sm:justify-between">
      <p className="tabular-nums">
        {last === 1
          ? `Showing all ${formatCount(total)}`
          : `Showing ${formatCount(first)}–${formatCount(Math.min(page * pageSize, total))} of ${formatCount(total)}`}
      </p>
      {last > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PageLink href={href(page - 1)} disabled={page === 1} label="Go to previous page">
                <ChevronLeftIcon data-icon="inline-start" />
                <span className="hidden sm:block">Previous</span>
              </PageLink>
            </PaginationItem>
            {pageWindow(page, last).map((entry, index) =>
              entry === "gap" ? (
                <PaginationItem key={`gap-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={entry}>
                  <Button asChild variant={entry === page ? "outline" : "ghost"} size="icon">
                    <Link href={href(entry)} aria-current={entry === page ? "page" : undefined}>
                      {entry}
                    </Link>
                  </Button>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PageLink href={href(page + 1)} disabled={page === last} label="Go to next page">
                <span className="hidden sm:block">Next</span>
                <ChevronRightIcon data-icon="inline-end" />
              </PageLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}

/** Previous or Next: a link, or a dimmed button at either end. */
function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <Button variant="ghost" disabled aria-label={label}>
        {children}
      </Button>
    )
  }
  return (
    <Button asChild variant="ghost">
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  )
}
