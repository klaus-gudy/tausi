"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { CountBadge } from "@/components/count-badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Tab = { value: string; label: string; count?: number }

/**
 * Tabs whose selection lives in the URL (?tab=), so reloads, pagination and
 * shared links open on the same tab. The first tab is the default and has no
 * param. `actions` puts a button next to the tab list for the active tab.
 */
export function UrlTabs({
  tabs,
  defaultValue,
  actions,
  className,
  children,
}: {
  tabs: Tab[]
  defaultValue: string
  actions?: Partial<Record<string, React.ReactNode>>
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(defaultValue)

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        setValue(next)
        // Switching tabs starts that tab from page 1.
        const query = next === tabs[0]?.value ? "" : `?tab=${next}`
        router.replace(`${pathname}${query}`, { scroll: false })
      }}
      className={className}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="h-9">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="px-2.5">
              {tab.label}
              {tab.count !== undefined && <CountBadge count={tab.count} />}
            </TabsTrigger>
          ))}
        </TabsList>
        {actions?.[value]}
      </div>
      {children}
    </Tabs>
  )
}
