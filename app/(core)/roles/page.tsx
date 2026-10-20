import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Plus, ShieldCheck } from "lucide-react";

import { readPermissionChoices } from "./data";
import { NoAccessState } from "@/components/no-access-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Roles & permissions",
};

export default function RolesPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
        <p className="text-muted-foreground">
          Open a role to see and set what it can do. Give members a role on the Members page.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Roles />
      </Suspense>
    </>
  );
}

async function Roles() {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("members.read")) return <NoAccessState reason="no-permission" />;

  const canManage = member.permissions.has("roles.manage");
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const [roles, counts, { modules }] = await Promise.all([
    prisma.role.findMany({
      where: { OR: [{ organizationId: null, key: "owner" }, { organizationId }] },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        permissions: { select: { permissionKey: true } },
      },
    }),
    // Owner is shared, so count only this organization's members.
    prisma.membership.groupBy({ by: ["roleId"], where: { organizationId }, _count: true }),
    readPermissionChoices(member),
  ]);

  const memberCounts = new Map(counts.map((row) => [row.roleId, row._count]));
  const total = modules.reduce((sum, group) => sum + group.permissions.length, 0);

  // Owner first, then the organization's own by name.
  const ordered = [...roles].sort((a, b) => Number(!!a.organizationId) - Number(!!b.organizationId));

  return (
    <>
      {canManage ? (
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/roles/new">
              <Plus data-icon="inline-start" />
              New role
            </Link>
          </Button>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((role) => {
          const keys = new Set(role.permissions.map((grant) => grant.permissionKey));
          const touched = modules.filter((group) => group.permissions.some((p) => keys.has(p.key)));
          const members = memberCounts.get(role.id) ?? 0;
          const description = role.description ?? (role.organizationId ? "No description" : "Can do everything");
          return (
            <Link
              key={role.id}
              href={`/roles/${role.id}`}
              className="min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full gap-3 transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="truncate">{role.name}</CardTitle>
                  <CardDescription className="truncate" title={description}>
                    {description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex flex-wrap gap-1">
                  {touched.length ? (
                    touched.map((group) => (
                      <Badge key={group.key} variant="outline" className="h-5 px-1.5 text-[11px]">
                        {group.label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No permissions yet</span>
                  )}
                </CardContent>
                <CardFooter className="justify-between gap-2 py-2 text-xs text-muted-foreground tabular-nums">
                  <span>{members === 1 ? "1 member" : `${formatCount(members)} members`}</span>
                  <span>
                    {formatCount(keys.size)} of {formatCount(total)} permissions
                  </span>
                </CardFooter>
              </Card>
            </Link>
          );
        })}
      </div>
      {ordered.length === 1 ? (
        <Empty className="flex-none border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheck />
            </EmptyMedia>
            <EmptyTitle>Only the owner role so far</EmptyTitle>
            <EmptyDescription>
              Add roles for the people you work with, like a storekeeper or a sales rep, and pick
              what each can do.
            </EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button asChild>
                <Link href="/roles/new">
                  <Plus data-icon="inline-start" />
                  New role
                </Link>
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}
    </>
  );
}
