"use client"

import { useTransition } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"

import { switchOrganization } from "@/app/(core)/organizations/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar"

type Organization = { id: string; name: string; roleName: string }

function OrgMark({ name }: { name: string }) {
  return (
    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </div>
  )
}

export function OrgSwitcherMenu({
  organizations,
  activeId,
}: {
  organizations: Organization[]
  activeId: string | null
}) {
  const { isMobile } = useSidebar()
  const [pending, startTransition] = useTransition()
  const active = organizations.find((org) => org.id === activeId)

  function select(id: string) {
    if (id === activeId) return
    startTransition(async () => {
      const result = await switchOrganization(id)
      if (!result.success) toast.error(result.message)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          disabled={pending}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <OrgMark name={active?.name ?? "?"} />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {active?.name ?? "No organization"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {active ? active.roleName : "Pick one below"}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56"
        align="start"
        side={isMobile ? "bottom" : "right"}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} onSelect={() => select(org.id)} className="gap-2">
            <span className="truncate">{org.name}</span>
            {org.id === activeId ? <Check className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
