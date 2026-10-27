import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { UserCheck } from "lucide-react";

import { AddSalespersonDialog } from "./salesperson-dialog";
import { SalespersonMenu } from "./salesperson-menu";
import { NoAccessState } from "@/components/no-access-state";
import { UrlTabs } from "@/components/url-tabs";
import { Badge } from "@/components/ui/badge";
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
import { heldStock } from "@/lib/deliveries";
import { formatCount } from "@/lib/format";
import { readActiveMember } from "@/lib/membership";
import { COVERAGE, coverage, readPlaces } from "@/lib/places";
import { getPrisma } from "@/lib/prisma";
import { BY_NAME, SALESPERSON_PERSON, salespersonName } from "@/lib/salespeople";

export const metadata: Metadata = {
  title: "Salespeople",
};

export default function SalespeoplePage({ searchParams }: PageProps<"/salespeople">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Salespeople</h1>
        <p className="text-sm text-muted-foreground">
          Who covers which zone, the stock they hold and what they supplied.
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
  // A new salesperson is invited as a member, so adding one takes both.
  const canAdd = canManage && member.permissions.has("members.invite");
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const [salespeople, activeCount, inactiveCount, onTheWay, held, supplied, places] = await Promise.all([
    prisma.salesperson.findMany({
      where: { organizationId, deactivatedAt: tab === "inactive" ? { not: null } : null },
      orderBy: BY_NAME,
      select: {
        id: true,
        notes: true,
        ...COVERAGE,
        ...SALESPERSON_PERSON,
      },
    }),
    prisma.salesperson.count({ where: { organizationId, deactivatedAt: null } }),
    prisma.salesperson.count({ where: { organizationId, deactivatedAt: { not: null } } }),
    // Units dispatched to each salesperson that they haven't acknowledged yet.
    prisma.$queryRaw<{ salesperson_id: string; units: bigint }[]>`
      SELECT t.salesperson_id, -SUM(m.quantity) AS units
      FROM stock_transfers t
      JOIN stock_movements m ON m.transfer_id = t.id AND m.type = 'transferred'
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.status IN ('in_transit', 'arrived')
        AND t.acknowledged_at IS NULL
      GROUP BY t.salesperson_id`,
    heldStock(organizationId),
    prisma.$queryRaw<{ salesperson_id: string; units: bigint }[]>`
      SELECT d.salesperson_id, SUM(l.quantity) AS units
      FROM deliveries d
      JOIN delivery_lines l ON l.delivery_id = d.id
      WHERE d.organization_id = ${organizationId}::uuid
      GROUP BY d.salesperson_id`,
    canManage ? readPlaces(organizationId) : [],
  ]);
  const sum = (rows: { salesperson_id: string; units: bigint }[], id: string) =>
    Number(rows.find((row) => row.salesperson_id === id)?.units ?? 0);
  const holding = (id: string) =>
    [...(held.get(id)?.values() ?? [])].reduce((total, units) => total + units, 0);

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "active", label: "Active", count: activeCount },
        { value: "inactive", label: "Inactive", count: inactiveCount },
      ]}
      actions={canAdd ? { active: <AddSalespersonDialog places={places} /> } : undefined}
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
                    <TableHead className="hidden sm:table-cell">Coverage</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">On the way</TableHead>
                    <TableHead className="text-right">Holding</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Supplied</TableHead>
                    {canManage ? (
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salespeople.map((salesperson) => {
                    const { membership } = salesperson;
                    const name = salespersonName(salesperson);
                    const covers = coverage(salesperson);
                    return (
                      <TableRow key={salesperson.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{name}</span>
                            {membership.status === "invited" ? <Badge variant="outline">Invited</Badge> : null}
                          </div>
                          {salesperson.notes ? (
                            <div className="max-w-xs truncate text-xs text-muted-foreground">
                              {salesperson.notes}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div>{membership.user.email}</div>
                          {membership.phone ? (
                            <div className="text-xs text-muted-foreground">{formatPhone(membership.phone)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {covers.place ? (
                            <>
                              <div>{covers.place}</div>
                              <div className="text-xs text-muted-foreground">{covers.zone?.name}</div>
                            </>
                          ) : (
                            <span className={covers.zone ? undefined : "text-muted-foreground"}>
                              {covers.zone?.name ?? "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          {formatCount(sum(onTheWay, salesperson.id))}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCount(holding(salesperson.id))}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {formatCount(sum(supplied, salesperson.id))}
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <SalespersonMenu
                              salesperson={{
                                id: salesperson.id,
                                name: membership.user.name ?? "",
                                email: membership.user.email,
                                phone: membership.phone,
                                ...covers.keys,
                              }}
                              places={places}
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
            {tab === "active" && canAdd ? (
              <EmptyContent>
                <AddSalespersonDialog places={places} />
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </TabsContent>
    </UrlTabs>
  );
}
