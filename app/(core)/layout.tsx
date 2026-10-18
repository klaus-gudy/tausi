import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { NavUser, NavUserSkeleton } from "@/components/nav-user";
import { OrgSwitcher, OrgSwitcherSkeleton } from "@/components/org-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function CoreLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        header={
          <Suspense fallback={<OrgSwitcherSkeleton />}>
            <OrgSwitcher />
          </Suspense>
        }
        footer={
          // Also the guard for every page in this group: NavUser redirects to
          // /login when the session is missing or no longer valid.
          <Suspense fallback={<NavUserSkeleton />}>
            <NavUser />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
