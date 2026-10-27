import { cn } from "cn"

/**
 * A product's name kept to one line in a table: a long one ends in an
 * ellipsis, and hovering shows all of it.
 */
export function ProductName({ name, className }: { name: string; className?: string }) {
  return (
    <span title={name} className={cn("inline-block max-w-56 truncate align-bottom", className)}>
      {name}
    </span>
  )
}
