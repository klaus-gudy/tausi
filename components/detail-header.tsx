import { Card, CardContent } from "@/components/ui/card"

/**
 * The card at the top of a page opened from a list (one with a back link):
 * the record's name, any badges next to it, a line about it below, and its
 * actions on the right.
 */
export function DetailHeader({
  title,
  badges,
  description,
  actions,
}: {
  title: React.ReactNode
  badges?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {badges}
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  )
}
