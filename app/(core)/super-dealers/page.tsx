import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { Store } from "lucide-react";

import { AddDealerDialog } from "./dealer-dialog";
import { DealerMenu } from "./dealer-menu";
import { NoAccessState } from "@/components/no-access-state";
import { Badge } from "@/components/ui/badge";
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
import { dealerScope } from "@/lib/dealer-access";
import { byDealerName, dealerName, formatPhone } from "@/lib/dealers";
import { formatCount, formatDay } from "@/lib/format";
import { readActiveMember } from "@/lib/membership";
import { PLACE, placeKeys, readPlaces } from "@/lib/places";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Super dealers",
};

export default function SuperDealersPage({ searchParams }: PageProps<"/super-dealers">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Super dealers</h1>
        <p className="text-sm text-muted-foreground">
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
  // Without dealers.read_all, only the dealers where they work.
  const scope = await dealerScope(member);
  const coversAll = member.permissions.has("dealers.read_all");

  const prisma = getPrisma();
  const [dealers, activeCount, inactiveCount, issuedTotals, lastIssues, delivered, places] = await Promise.all([
    prisma.superDealer.findMany({
      where: { ...scope, deactivatedAt: tab === "inactive" ? { not: null } : null },
      select: {
        id: true,
        shopName: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        tin: true,
        businessLicence: true,
        signedAt: true,
        ...PLACE,
      },
    }),
    prisma.superDealer.count({ where: { ...scope, deactivatedAt: null } }),
    prisma.superDealer.count({ where: { ...scope, deactivatedAt: { not: null } } }),
    // What each dealer holds; reversals of an issue net out of the sum.
    prisma.stockMovement.groupBy({
      by: ["superDealerId"],
      where: { organizationId, holder: "super_dealer" },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["superDealerId"],
      where: { organizationId, holder: "super_dealer", type: "issued" },
      _max: { occurredOn: true },
    }),
    // What salespeople supplied each dealer, and when last.
    prisma.$queryRaw<{ super_dealer_id: string; units: bigint; last: Date }[]>`
      SELECT d.super_dealer_id, SUM(l.quantity) AS units, MAX(d.delivered_on) AS last
      FROM deliveries d
      JOIN delivery_lines l ON l.delivery_id = d.id
      WHERE d.organization_id = ${organizationId}::uuid
      GROUP BY d.super_dealer_id`,
    canManage ? readPlaces(organizationId) : [],
  ]);
  dealers.sort(byDealerName);
  const issued = new Map(issuedTotals.map((row) => [row.superDealerId, row._sum.quantity ?? 0]));
  const lastIssued = new Map(lastIssues.map((row) => [row.superDealerId, row._max.occurredOn]));
  // Stock reaches a dealer straight from the store or through a salesperson.
  for (const row of delivered) {
    issued.set(row.super_dealer_id, (issued.get(row.super_dealer_id) ?? 0) + Number(row.units));
    const last = lastIssued.get(row.super_dealer_id);
    if (!last || row.last > last) lastIssued.set(row.super_dealer_id, row.last);
  }

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "active", label: "Active", count: activeCount },
        { value: "inactive", label: "Inactive", count: inactiveCount },
      ]}
      actions={
        // Field onboarding (/super-dealers/onboard) is left out of the page for now.
        canManage ? { active: <AddDealerDialog places={places} /> } : undefined
      }
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
                    <TableHead className="text-right">Units supplied</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Last supplied</TableHead>
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
                    const { district, signedAt, ...rest } = dealer;
                    const region = district?.region;
                    const editable = { ...rest, ...placeKeys(dealer) };
                    return (
                      <TableRow key={dealer.id}>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/super-dealers/${dealer.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {dealerName(dealer)}
                            </Link>
                            {signedAt ? <Badge variant="outline">Signed</Badge> : null}
                          </div>
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
                  : coversAll
                    ? "Add the shops and distributors you issue stock to."
                    : "Dealers in the zone, region or district you cover show here."}
              </EmptyDescription>
            </EmptyHeader>
            {tab === "active" && canManage ? (
              <EmptyContent className="flex-row justify-center">
                <AddDealerDialog places={places} />
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </TabsContent>
    </UrlTabs>
  );
}
