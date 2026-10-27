import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MapPinned } from "lucide-react";

import { NoAccessState } from "@/components/no-access-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import { readActiveMember } from "@/lib/membership";
import { COVERAGE, coverage } from "@/lib/places";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Zones",
};

export default function ZonesPage() {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Zones</h1>
        <p className="text-sm text-muted-foreground">
          Tanzania&apos;s sales zones, set up with your organization. Salespeople and dealers count
          in the zone their region or district is in.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Zones />
      </Suspense>
    </>
  );
}

async function Zones() {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("dealers.read")) return <NoAccessState reason="no-permission" />;

  const organizationId = member.organization.id;
  const prisma = getPrisma();
  const [zones, salespeople] = await Promise.all([
    // The zones come with the organization, so they're listed rather than added here.
    prisma.zone.findMany({
      where: { organizationId },
      orderBy: { position: "asc" },
      select: {
        key: true,
        name: true,
        regions: {
          orderBy: { name: "asc" },
          select: {
            name: true,
            // Dealers are placed by district, so they're counted through them.
            districts: {
              select: { _count: { select: { superDealers: { where: { deactivatedAt: null } } } } },
            },
          },
        },
      },
    }),
    // Salespeople cover a zone, a region or a district; each counts in its zone.
    prisma.salesperson.findMany({ where: { organizationId, deactivatedAt: null }, select: COVERAGE }),
  ]);

  if (!zones.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapPinned />
          </EmptyMedia>
          <EmptyTitle>No zones set up</EmptyTitle>
          <EmptyDescription>
            This organization was made without Tanzania&apos;s zones, regions and districts.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const salespeopleIn = new Map<string, number>();
  for (const salesperson of salespeople) {
    const zoneKey = coverage(salesperson).zone?.key;
    if (zoneKey) salespeopleIn.set(zoneKey, (salespeopleIn.get(zoneKey) ?? 0) + 1);
  }
  const rows = zones.map((zone) => ({
    ...zone,
    salespeople: salespeopleIn.get(zone.key) ?? 0,
    dealers: zone.regions
      .flatMap((region) => region.districts)
      .reduce((sum, district) => sum + district._count.superDealers, 0),
  }));
  const total = (pick: (row: (typeof rows)[number]) => number) =>
    rows.reduce((sum, row) => sum + pick(row), 0);

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead className="hidden md:table-cell">Regions</TableHead>
              <TableHead className="text-right">Salespeople</TableHead>
              <TableHead className="text-right">Super dealers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((zone) => (
              <TableRow key={zone.key} className="align-top">
                <TableCell>
                  <div className="font-medium">{zone.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {zone.regions.length} {zone.regions.length === 1 ? "region" : "regions"}
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-sm whitespace-normal md:table-cell">
                  {zone.regions.map((region) => region.name).join(", ")}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(zone.salespeople)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(zone.dealers)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>{rows.length} zones</TableCell>
              <TableCell className="hidden md:table-cell">
                {formatCount(total((row) => row.regions.length))} regions
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(total((row) => row.salespeople))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(total((row) => row.dealers))}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
