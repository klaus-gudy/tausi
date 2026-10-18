import { NavUserMenu } from "@/components/nav-user-menu"
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"

// The signed-in user for the sidebar footer, with a menu to log out. Reads
// the session, so render it inside <Suspense fallback={<NavUserSkeleton />}>.
export async function NavUser() {
  const user = await getCurrentUser()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <NavUserMenu
          user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

// Not SidebarMenuSkeleton: its random width can't be in a prerendered fallback.
export function NavUserSkeleton() {
  return (
    <div className="flex h-12 items-center gap-2 p-2">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}
