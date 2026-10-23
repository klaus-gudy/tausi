"use client"

import { Children, useEffect, useLayoutEffect, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"

/**
 * Badges that wrap onto at most two lines; whatever doesn't fit is folded
 * into a "+N more" badge at the end. Measured in the browser, so the server
 * render is clipped to two lines until then.
 */
export function BadgeOverflow({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children)
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(items.length)
  const [width, setWidth] = useState(0)

  // A new width can fit more or fewer, so start again from all of them.
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let last = -1
    // Only the width matters: dropping a badge can change the height.
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === last) return
      last = element.clientWidth
      setWidth(last)
      setShown(items.length)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [items.length])

  // One fewer at a time until everything, "+N more" included, is on two lines.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || shown === 0) return
    const lines = new Set([...element.children].map((child) => (child as HTMLElement).offsetTop))
    if (lines.size > 2) setShown(shown - 1)
  }, [shown, width])

  const hidden = items.length - shown
  return (
    <div ref={ref} className="flex max-h-11 flex-wrap gap-1 overflow-hidden">
      {items.slice(0, shown)}
      {hidden ? (
        <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
          +{hidden} more
        </Badge>
      ) : null}
    </div>
  )
}
