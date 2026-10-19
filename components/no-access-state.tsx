import { Lock, Users } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/**
 * Shown instead of a page's content when the user has no active organization,
 * or their role doesn't include the permission the page needs.
 */
export function NoAccessState({ reason }: { reason: "no-organization" | "no-permission" }) {
  const noOrganization = reason === "no-organization"
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{noOrganization ? <Users /> : <Lock />}</EmptyMedia>
        <EmptyTitle>
          {noOrganization ? "You're not in an organization" : "You can't see this page"}
        </EmptyTitle>
        <EmptyDescription>
          {noOrganization
            ? "Ask an organization's owner or admin for an invitation link."
            : "Your role doesn't include it. Ask an owner or admin if you need access."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
