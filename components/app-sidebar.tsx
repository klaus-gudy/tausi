"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  History,
  LayoutDashboard,
  MapPinned,
  Package,
  PackagePlus,
  Store,
  Truck,
  UserCheck,
  Users,
  Warehouse,
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

const navGroups = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inventory",
    items: [
      { title: "Stock on hand", href: "/stock-on-hand", icon: Boxes },
      { title: "Goods received", href: "/goods-received", icon: PackagePlus },
      { title: "Transfers", href: "/transfers", icon: ArrowLeftRight },
      { title: "Stock counts", href: "/stock-counts", icon: ClipboardCheck },
      { title: "Movement history", href: "/movement-history", icon: History },
    ],
  },
  {
    label: "Field sales",
    items: [
      { title: "Deliveries", href: "/deliveries", icon: Truck },
      { title: "Salespeople", href: "/salespeople", icon: UserCheck },
    ],
  },
  {
    label: "Dealers",
    items: [
      { title: "Super dealers", href: "/super-dealers", icon: Store },
      { title: "Zones", href: "/zones", icon: MapPinned },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { title: "Products", href: "/products", icon: Package },
      { title: "Warehouses", href: "/warehouses", icon: Warehouse },
    ],
  },
  {
    label: "Settings",
    items: [{ title: "Members & roles", href: "/members", icon: Users }],
  },
]

export function AppSidebar({
  header,
  footer,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  /** Server-rendered organization switcher; see OrgSwitcher. */
  header?: React.ReactNode
  /** Server-rendered user menu; see NavUser. */
  footer?: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>{header}</SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
        ))}
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
