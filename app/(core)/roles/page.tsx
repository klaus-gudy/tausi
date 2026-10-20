import type { Metadata } from "next";
import { connection } from "next/server";
import { Fragment, Suspense } from "react";
import { Check, Minus } from "lucide-react";

import { AddRoleDialog, type PermissionChoices } from "./role-dialog";
import { RoleMenu } from "./role-menu";
import { NoAccessState } from "@/components/no-access-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import { readActiveMember, SYSTEM_ROLES, type SystemRole } from "@/lib/membership";
import { groupPermissions } from "@/lib/permissions";
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
          What each role can do, part by part of the app. Give members a role on the Members page.
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
  const [roles, counts, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { OR: [{ organizationId: null }, { organizationId }] },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        organizationId: true,
        permissions: { select: { permissionKey: true } },
      },
    }),
    // System roles are shared, so count only this organization's members.
    prisma.membership.groupBy({ by: ["roleId"], where: { organizationId }, _count: true }),
    prisma.permission.findMany({ select: { key: true, description: true } }),
  ]);

  const modules = groupPermissions(permissions);
  const memberCounts = new Map(counts.map((row) => [row.roleId, row._count]));
  // System roles first, by rank, then the organization's own by age.
  const rank = (role: (typeof roles)[number]) =>
    role.organizationId ? SYSTEM_ROLES.length : SYSTEM_ROLES.indexOf(role.key as SystemRole);
  const ordered = roles
    .map((role) => ({ ...role, keys: new Set(role.permissions.map((grant) => grant.permissionKey)) }))
    .sort((a, b) => rank(a) - rank(b));
  const choices: PermissionChoices = { modules, grantable: [...member.permissions] };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Roles</CardTitle>
            <CardDescription>
              Built-in roles are the same in every organization. For something in between, add a
              role of your own or duplicate a built-in one.
            </CardDescription>
          </div>
          {canManage ? <AddRoleDialog choices={choices} /> : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Permissions</TableHead>
                {canManage ? (
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((role) => {
                const system = !role.organizationId;
                return (
                  <TableRow key={role.id}>
                    <TableCell className="whitespace-normal">
                      <div className="flex items-center gap-2 font-medium">
                        {role.name}
                        {system ? <Badge variant="secondary">Built-in</Badge> : null}
                        {role.id === member.role.id ? (
                          <span className="font-normal text-muted-foreground">(yours)</span>
                        ) : null}
                      </div>
                      {role.description ? (
                        <div className="text-xs text-muted-foreground">{role.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(memberCounts.get(role.id) ?? 0)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                      {formatCount(role.keys.size)} of {formatCount(permissions.length)}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        {/* The owner role is everything; there's nothing to copy from it. */}
                        {role.key === "owner" && system ? null : (
                          <RoleMenu
                            role={{
                              id: role.id,
                              name: role.name,
                              description: role.description,
                              permissions: [...role.keys],
                            }}
                            system={system}
                            choices={choices}
                          />
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions by module</CardTitle>
          <CardDescription>
            Viewing a module comes with anything else in it: a role that can add products can
            also see them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Permission</TableHead>
                {ordered.map((role) => (
                  <TableHead key={role.id} className="text-center">
                    {role.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((group) => (
                <Fragment key={group.key}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={ordered.length + 1} className="font-medium">
                      {group.label}
                    </TableCell>
                  </TableRow>
                  {group.permissions.map((permission) => (
                    <TableRow key={permission.key}>
                      <TableCell className="whitespace-normal pl-4">{permission.label}</TableCell>
                      {ordered.map((role) => (
                        <TableCell key={role.id} className="text-center">
                          {role.keys.has(permission.key) ? (
                            <Check className="mx-auto size-4 text-primary" aria-label="Yes" />
                          ) : (
                            <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="No" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
