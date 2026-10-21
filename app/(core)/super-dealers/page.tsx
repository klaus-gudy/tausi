import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Store } from "lucide-react";

import { AddDealerDialog } from "./dealer-dialog";
import { DealerMenu } from "./dealer-menu";
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
import { byDealerName, dealerName, formatPhone } from "@/lib/dealers";
import { formatCount, formatDay } from "@/lib/format";
import { readActiveMember } from "@/lib/membership";
import { readPlaces } from "@/lib/places";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Super dealers",
};

export default function SuperDealersPage({ searchParams }: PageProps<"/super-dealers">) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Super dealers</h1>
        <p className="text-muted-foreground">
          The shops and distributors you issue stock to.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SuperDealers searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SuperDealers({
  searchParams,
}: Pick<PageProps<"/super-dealers">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("dealers.read")) return <NoAccessState reason="no-permission" />;

  const tab = (await searchParams).tab === "inactive" ? "inactive" : "active";
  const canManage = member.permissions.has("dealers.manage");
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const [dealers, activeCount, inactiveCount, issuedTotals, lastIssues, places] = await Promise.all([
    prisma.superDealer.findMany({
      where: { organizationId, deactivatedAt: tab === "inactive" ? { not: null } : null },
      select: {
        id: true,
        shopName: true,
        contactName: true,
        phone: true,
        email: true,
        regionKey: true,
        districtKey: true,
        address: true,
        region: { select: { name: true, zone: { select: { name: true } } } },
        district: { select: { name: true } },
      },
    }),
    prisma.superDealer.count({ where: { organizationId, deactivatedAt: null } }),
    prisma.superDealer.count({ where: { organizationId, deactivatedAt: { not: null } } }),
    // What each dealer holds; reversals of an issue net out of the sum.
    prisma.stockMovement.groupBy({
      by: ["superDealerId"],
      where: { organizationId, holder: "super_dealer" },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["superDealerId"],
      where: { organizationId, holder: "super_dealer", type: { in: ["issued", "distributed"] } },
      _max: { occurredOn: true },
    }),
    canManage ? readPlaces(organizationId) : [],
  ]);
  dealers.sort(byDealerName);
  const issued = new Map(issuedTotals.map((row) => [row.superDealerId, row._sum.quantity ?? 0]));
  const lastIssued = new Map(lastIssues.map((row) => [row.superDealerId, row._max.occurredOn]));

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "active", label: "Active", count: activeCount },
        { value: "inactive", label: "Inactive", count: inactiveCount },
      ]}
      actions={canManage ? { active: <AddDealerDialog places={places} /> } : undefined}
    >
      <TabsContent value={tab}>
        {dealers.length ? (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden sm:table-cell">Location</TableHead>
                    <TableHead className="text-right">Units issued</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Last issue</TableHead>
                    {canManage ? (
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealers.map((dealer) => {
                    const last = lastIssued.get(dealer.id);
                    const { region, district, ...editable } = dealer;
                    return (
                      <TableRow key={dealer.id}>
                        <TableCell>
                          <div className="font-medium">{dealerName(dealer)}</div>
                          {dealer.address ? (
                            <div className="text-xs text-muted-foreground">{dealer.address}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div>{dealer.shopName ? (dealer.contactName ?? "—") : null}</div>
                          <div className="text-xs text-muted-foreground">
                            {[dealer.phone && formatPhone(dealer.phone), dealer.email]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {region ? (
                            <>
                              <div>{[district?.name, region.name].filter(Boolean).join(", ")}</div>
                              <div className="text-xs text-muted-foreground">{region.zone.name}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(issued.get(dealer.id) ?? 0)}
                        </TableCell>
                        <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                          {last ? formatDay(last) : "Never"}
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <DealerMenu dealer={editable} places={places} inactive={tab === "inactive"} />
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
                <Store />
              </EmptyMedia>
              <EmptyTitle>
                {tab === "inactive" ? "No inactive dealers" : "No super dealers yet"}
              </EmptyTitle>
              <EmptyDescription>
                {tab === "inactive"
                  ? "Inactive dealers keep their history but can't be issued stock."
                  : "Add the shops and distributors you issue stock to."}
              </EmptyDescription>
            </EmptyHeader>
            {tab === "active" && canManage ? (
              <EmptyContent>
                <AddDealerDialog places={places} />
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </TabsContent>
    </UrlTabs>
  );
}
