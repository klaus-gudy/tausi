import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { UserCheck } from "lucide-react";

import { AddSalespersonDialog } from "./salesperson-dialog";
import { SalespersonMenu } from "./salesperson-menu";
import { NoAccessState } from "@/components/no-access-state";
import { UrlTabs } from "@/components/url-tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { formatPhone } from "@/lib/dealers";
import { formatCount } from "@/lib/format";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Salespeople",
};

export default function SalespeoplePage({ searchParams }: PageProps<"/salespeople">) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Salespeople</h1>
        <p className="text-muted-foreground">
          Who covers which zone, and the stock sent to them.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Salespeople searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Salespeople({
  searchParams,
}: Pick<PageProps<"/salespeople">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("salespeople.read")) return <NoAccessState reason="no-permission" />;

  const tab = (await searchParams).tab === "inactive" ? "inactive" : "active";
  const canManage = member.permissions.has("salespeople.manage");
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const [salespeople, activeCount, inactiveCount, sent, zones] = await Promise.all([
    prisma.salesperson.findMany({
      where: { organizationId, deactivatedAt: tab === "inactive" ? { not: null } : null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        zoneKey: true,
        notes: true,
        zone: { select: { name: true } },
      },
    }),
    prisma.salesperson.count({ where: { organizationId, deactivatedAt: null } }),
    prisma.salesperson.count({ where: { organizationId, deactivatedAt: { not: null } } }),
    // Units on the way to and delivered to each salesperson. Cancelled
    // transfers are left out; their stock went back on hand.
    prisma.$queryRaw<{ salesperson_id: string; status: "in_transit" | "arrived"; units: bigint }[]>`
      SELECT t.salesperson_id, t.status, -SUM(m.quantity) AS units
      FROM stock_transfers t
      JOIN stock_movements m ON m.transfer_id = t.id
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.status IN ('in_transit', 'arrived')
      GROUP BY t.salesperson_id, t.status`,
    canManage ? prisma.zone.findMany({ orderBy: { position: "asc" }, select: { key: true, name: true } }) : [],
  ]);
  const units = (id: string, status: "in_transit" | "arrived") =>
    Number(sent.find((row) => row.salesperson_id === id && row.status === status)?.units ?? 0);

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "active", label: "Active", count: activeCount },
        { value: "inactive", label: "Inactive", count: inactiveCount },
      ]}
      actions={canManage ? { active: <AddSalespersonDialog zones={zones} /> } : undefined}
    >
      <TabsContent value={tab}>
        {salespeople.length ? (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salesperson</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden sm:table-cell">Zone</TableHead>
                    <TableHead className="text-right">In transit</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    {canManage ? (
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salespeople.map((salesperson) => {
                    const { zone, ...editable } = salesperson;
                    return (
                      <TableRow key={salesperson.id}>
                        <TableCell>
                          <div className="font-medium">{salesperson.name}</div>
                          {salesperson.notes ? (
                            <div className="max-w-xs truncate text-xs text-muted-foreground">
                              {salesperson.notes}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {[salesperson.phone && formatPhone(salesperson.phone), salesperson.email]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {zone?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(units(salesperson.id, "in_transit"))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(units(salesperson.id, "arrived"))}
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <SalespersonMenu
                              salesperson={editable}
                              zones={zones}
                              inactive={tab === "inactive"}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserCheck />
              </EmptyMedia>
              <EmptyTitle>
                {tab === "inactive" ? "No inactive salespeople" : "No salespeople yet"}
              </EmptyTitle>
              <EmptyDescription>
                {tab === "inactive"
                  ? "Inactive salespeople keep their history but can't be sent stock."
                  : "Add the field staff the store sends stock to."}
              </EmptyDescription>
            </EmptyHeader>
            {tab === "active" && canManage ? (
              <EmptyContent>
                <AddSalespersonDialog zones={zones} />
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </TabsContent>
    </UrlTabs>
  );
}
