import { connection } from "next/server"

import { OrgSwitcherMenu } from "@/components/org-switcher-menu"
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { listOrganizations } from "@/lib/membership"
import { readSession } from "@/lib/session"

// The active organization, with a menu to switch between them, for the
// sidebar header. Reads the session, so render it inside
// <Suspense fallback={<OrgSwitcherSkeleton />}>.
export async function OrgSwitcher() {
  // Uncached on purpose: the list must be current right after a switch.
  // connection() keeps the query out of the prerendered shell; NavUser
  // handles signed-out visitors.
  await connection()
  const session = await readSession()
  if (!session) return <OrgSwitcherSkeleton />
  const organizations = await listOrganizations(session.userId)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <OrgSwitcherMenu
          organizations={organizations}
          activeId={session.activeOrganizationId}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function OrgSwitcherSkeleton() {
  return (
    <div className="flex h-12 items-center gap-2 p-2">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}
