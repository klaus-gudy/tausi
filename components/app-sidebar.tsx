"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRight,
  History,
  LayoutDashboard,
  MapPinned,
  Package,
  PackagePlus,
  ShieldCheck,
  Store,
  Truck,
  UserCheck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

// Each item names the permission its page needs, or several when any of them
// opens it, so members only see what their role opens. Pages still check it
// themselves; hiding is a courtesy. The pages that are still to come use their
// module's read permission.
const navGroups: {
  label: string
  items: { title: string; href: string; icon: LucideIcon; permission?: string | string[] }[]
}[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inventory",
    items: [
      { title: "Goods received", href: "/goods-received", icon: PackagePlus, permission: "stock.read" },
      { title: "Transfers", href: "/transfers", icon: ArrowLeftRight, permission: "stock.read" },
      { title: "Movement history", href: "/movement-history", icon: History, permission: "stock.read" },
    ],
  },
  {
    label: "Field sales",
    items: [
      {
        title: "Deliveries",
        href: "/deliveries",
        icon: Truck,
        permission: ["deliveries.read", "deliveries.record"],
      },
      { title: "Salespeople", href: "/salespeople", icon: UserCheck, permission: "salespeople.read" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { title: "Products", href: "/products", icon: Package, permission: "products.read" },
      { title: "Super dealers", href: "/super-dealers", icon: Store, permission: "dealers.read" },
      { title: "Zones", href: "/zones", icon: MapPinned, permission: "dealers.read" },
      { title: "Warehouses", href: "/warehouses", icon: Warehouse, permission: "warehouses.read" },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Members", href: "/members", icon: Users, permission: "members.read" },
      { title: "Roles & permissions", href: "/roles", icon: ShieldCheck, permission: "members.read" },
    ],
  },
]

export function AppSidebar({
  header,
  nav,
  footer,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  /** Server-rendered organization switcher; see OrgSwitcher. */
  header?: React.ReactNode
  /** Server-rendered links the member may open; see NavMain. */
  nav?: React.ReactNode
  /** Server-rendered user menu; see NavUser. */
  footer?: React.ReactNode
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>{header}</SidebarHeader>
      <SidebarContent>{nav}</SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

/** The nav groups, without the items `permissions` doesn't open. */
export function SidebarNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname()
  const held = new Set(permissions)
  return navGroups.map((group) => {
    const items = group.items.filter(
      (item) => !item.permission || [item.permission].flat().some((key) => held.has(key))
    )
    if (!items.length) return null
    return (
      <SidebarGroup key={group.label}>
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
        <SidebarGroupContent>
          {/* A sliver between items, so a hovered one never runs into the active one. */}
          <SidebarMenu className="gap-0.5">
            {items.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.title}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  })
}

// Fixed widths, not SidebarMenuSkeleton: its random width can't be in a
// prerendered fallback.
const SKELETON_WIDTHS = ["w-2/3", "w-1/2", "w-3/4", "w-3/5", "w-1/2", "w-2/3"]

/** Stands in for the nav while the member's permissions load. */
export function SidebarNavSkeleton() {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {SKELETON_WIDTHS.map((width, index) => (
          <SidebarMenuItem key={index} className="flex h-8 items-center gap-2 px-2">
            <Skeleton className="size-4 shrink-0 rounded-md" />
            <Skeleton className={`h-4 ${width} group-data-[collapsible=icon]:hidden`} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
