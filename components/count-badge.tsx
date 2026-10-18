import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Round count bubble; fits two digits, shows "99+" beyond that. */
export function CountBadge({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  const label = count > 99 ? "99+" : String(count)
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-[18px] min-w-[18px] justify-center rounded-full px-0.5 text-[10px] leading-none tabular-nums",
        className
      )}
    >
      {label}
    </Badge>
  )
}
