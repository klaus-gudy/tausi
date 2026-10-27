import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react"

import { PageSizeSelect } from "@/components/page-size-select"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import { formatCount } from "@/lib/format"
import { PAGE_SIZES, pageWindow } from "@/lib/list-size"

/**
 * Numbered pages under a server-rendered table, kept in `?page=`, with the
 * rows per page in `?size=` (see pageSize). Says which rows are showing; with
 * a single page that's all there is to show.
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
  const href = (to: number, size = pageSize) => {
    const search = new URLSearchParams(params)
    if (size !== PAGE_SIZES[0]) search.set("size", String(size))
    if (to > 1) search.set("page", String(to))
    const query = search.toString()
    return query ? `?${query}` : "?"
  }

  return (
    <div className="flex flex-col items-center gap-2 pt-2 text-sm text-muted-foreground sm:flex-row sm:justify-between">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {/* Only worth offering once there's more than the smallest page. */}
        {total > PAGE_SIZES[0] ? (
          <PageSizeSelect
            value={pageSize}
            options={PAGE_SIZES.map((size) => ({ size, href: href(1, size) }))}
          />
        ) : null}
        <p className="tabular-nums">
          {last === 1
            ? `Showing all ${formatCount(total)}`
            : `Showing ${formatCount(first)}–${formatCount(Math.min(page * pageSize, total))} of ${formatCount(total)}`}
        </p>
      </div>
      {last > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PageLink href={href(1)} disabled={page === 1} label="Go to first page" icon>
                <ChevronsLeftIcon />
              </PageLink>
            </PaginationItem>
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
            <PaginationItem>
              <PageLink href={href(last)} disabled={page === last} label="Go to last page" icon>
                <ChevronsRightIcon />
              </PageLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}

/** First, Previous, Next or Last: a link, or a dimmed button at either end. */
function PageLink({
  href,
  disabled,
  label,
  icon = false,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  /** Square, for an arrow with no text. */
  icon?: boolean
  children: React.ReactNode
}) {
  const size = icon ? "icon" : "default"
  if (disabled) {
    return (
      <Button variant="ghost" size={size} disabled aria-label={label}>
        {children}
      </Button>
    )
  }
  return (
    <Button asChild variant="ghost" size={size}>
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  )
}
