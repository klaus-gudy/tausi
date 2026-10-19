import type { LucideIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/** A menu page that exists in the sidebar but isn't built yet. */
export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string
  /** What the page will be for, in one line. */
  description: string
  icon: LucideIcon
}) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>Coming soon</EmptyTitle>
          <EmptyDescription>This page is being built.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  )
}
