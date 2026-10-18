"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * A list that shows `step` items at first and reveals `step` more with each
 * "Load more" click. The items are rendered by the server; this only decides
 * how many are on screen.
 */
export function ShowMoreList({
  items,
  step = 10,
  className,
}: {
  items: React.ReactNode[]
  step?: number
  className?: string
}) {
  const [shown, setShown] = useState(step)
  const left = items.length - shown

  return (
    <div className="grid gap-4">
      <ol className={className}>{items.slice(0, shown)}</ol>
      {left > 0 && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShown((current) => current + step)}
          >
            <ChevronDown data-icon="inline-start" />
            Load more ({left} left)
          </Button>
        </div>
      )}
    </div>
  )
}
