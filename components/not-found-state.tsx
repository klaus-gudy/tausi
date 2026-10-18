import Link from "next/link"
import { LayoutDashboard, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/** Shown for a page or record that doesn't exist, with a way back. */
export function NotFoundState({ className }: { className?: string }) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <p className="text-6xl font-semibold tracking-tight text-muted-foreground/40">
          404
        </p>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>
          This page doesn&apos;t exist, or what it showed has been removed.
          Check the address, or head back to your overview.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/">
            <LayoutDashboard data-icon="inline-start" />
            Go to overview
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
