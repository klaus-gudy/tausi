"use client"

import { useTransition } from "react"
import { ChevronsUpDown, LogOut } from "lucide-react"

import { signOut } from "@/app/(auth)/actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar"

type User = {
  name: string | null
  email: string
  avatarUrl: string | null
  /** The role in the active organization, if there is one. */
  roleName: string | null
}

function initials(name: string | null, email: string) {
  const words = (name || email).split(/[\s@.]+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("")
}

function UserSummary({ user }: { user: User }) {
  return (
    <>
      <Avatar className="size-8 rounded-lg">
        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
        <AvatarFallback className="rounded-lg">{initials(user.name, user.email)}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{user.name || user.email}</span>
          {user.roleName ? (
            <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
              {user.roleName}
            </Badge>
          ) : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </div>
    </>
  )
}

export function NavUserMenu({ user }: { user: User }) {
  const { isMobile } = useSidebar()
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          disabled={pending}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <UserSummary user={user} />
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56"
        align="end"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5">
            <UserSummary user={user} />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
