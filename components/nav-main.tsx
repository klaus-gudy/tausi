import { connection } from "next/server"

import { SidebarNav } from "@/components/app-sidebar"
import { readActiveMember } from "@/lib/membership"

// The sidebar's links, limited to what the member's role opens. Reads the
// session, so render it inside <Suspense fallback={<SidebarNavSkeleton />}>.
export async function NavMain() {
  // connection() keeps the query out of the prerendered shell, as in OrgSwitcher.
  await connection()
  const member = await readActiveMember()
  // Without an organization only the links that need no permission show.
  return <SidebarNav permissions={member ? [...member.permissions] : []} />
}
