import type * as React from "react"
import { cn } from "cn"

/**
 * When the page's content area (the `main` container, see the dashboard
 * layout) is narrower than 56rem, a table gives way to a stack of cards, one
 * per row. Pair it with the table wrapped in `hidden @4xl/main:block`.
 *
 * Cards are kept compact so a phone screen shows many rows: one line per
 * header line and per field, with long text cut off.
 */
export function MobileCards({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn(
        "grid gap-2 @xl/main:grid-cols-2 @4xl/main:hidden",
        className
      )}
      {...props}
    />
  )
}

export function MobileCard({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("grid gap-2 rounded-lg border p-3 text-sm", className)}
      {...props}
    />
  )
}

/**
 * The row's name, with an optional badge beside it, on the left; its headline
 * figure or status on the right. Each line is cut off if too long.
 */
export function MobileCardHeader({
  title,
  badge,
  description,
  aside,
}: {
  title: React.ReactNode
  /** Shown beside the title, which is shortened first to make room. */
  badge?: React.ReactNode
  description?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid min-w-0 gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{title}</span>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        {description && (
          <div className="truncate text-muted-foreground">{description}</div>
        )}
      </div>
      {aside && <div className="shrink-0 text-right">{aside}</div>}
    </div>
  )
}

export function MobileCardFields({
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return <dl className={cn("grid gap-1", className)} {...props} />
}

/** One line: the label on the left, its value on the right, cut off if long. */
export function MobileCardField({
  label,
  className,
  children,
}: {
  label: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn("flex min-w-0 items-center justify-between gap-3", className)}
    >
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  )
}

export function MobileCardActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-1 border-t pt-2",
        className
      )}
      {...props}
    />
  )
}
