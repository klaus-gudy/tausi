import type { LucideIcon } from "lucide-react"

/**
 * A panel grouping related fields in a long form, with an icon, a short
 * title and a line saying what goes in it.
 */
export function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="grid gap-0.5">
          <h3 className="text-sm leading-none font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
