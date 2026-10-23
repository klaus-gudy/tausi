import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Warehouse } from "lucide-react";

import { AddWarehouseDialog, type Keeper } from "./warehouse-dialog";
import { WarehouseMenu } from "./warehouse-menu";
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
import { readActiveMember } from "@/lib/membership";
import { readPlaces } from "@/lib/places";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Warehouses",
};

export default function WarehousesPage({ searchParams }: PageProps<"/warehouses">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Warehouses</h1>
        <p className="text-sm text-muted-foreground">
          The places stock is kept, where they are and who looks after them.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Warehouses searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Warehouses({
  searchParams,
}: Pick<PageProps<"/warehouses">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("warehouses.read")) return <NoAccessState reason="no-permission" />;

  const tab = (await searchParams).tab === "inactive" ? "inactive" : "active";
  const canManage = member.permissions.has("warehouses.manage");
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const [warehouses, activeCount, inactiveCount, places, memberships] = await Promise.all([
    prisma.warehouse.findMany({
      where: { organizationId, deactivatedAt: tab === "inactive" ? { not: null } : null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        regionKey: true,
        districtKey: true,
        address: true,
        contactName: true,
        phone: true,
        region: { select: { name: true, zone: { select: { name: true } } } },
        district: { select: { name: true } },
      },
    }),
    prisma.warehouse.count({ where: { organizationId, deactivatedAt: null } }),
    prisma.warehouse.count({ where: { organizationId, deactivatedAt: { not: null } } }),
    canManage ? readPlaces(organizationId) : [],
    // Who can be picked as a storekeeper.
    canManage
      ? prisma.membership.findMany({
          where: { organizationId, status: "active" },
          select: {
            id: true,
            name: true,
            phone: true,
            user: { select: { name: true, email: true } },
            role: { select: { name: true } },
          },
        })
      : [],
  ]);
  const keepers: Keeper[] = memberships
    .map((row) => ({
      id: row.id,
      name: row.name || row.user.name || row.user.email,
      phone: row.phone,
      role: row.role.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "active", label: "Active", count: activeCount },
        { value: "inactive", label: "Inactive", count: inactiveCount },
      ]}
      actions={canManage ? { active: <AddWarehouseDialog places={places} keepers={keepers} /> } : undefined}
    >
      <TabsContent value={tab}>
        {warehouses.length ? (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="hidden sm:table-cell">Location</TableHead>
                    <TableHead className="hidden md:table-cell">Storekeeper</TableHead>
                    {canManage ? (
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.map((warehouse) => {
                    const { region, district, ...editable } = warehouse;
                    return (
                      <TableRow key={warehouse.id}>
                        <TableCell>
                          <div className="font-medium">{warehouse.name}</div>
                          {warehouse.address ? (
                            <div className="text-xs text-muted-foreground">{warehouse.address}</div>
                          ) : null}
                          {/* On phones the location column is hidden, so show it here. */}
                          {region ? (
                            <div className="text-xs text-muted-foreground sm:hidden">
                              {[district?.name, region.name].filter(Boolean).join(", ")}
                            </div>
                          ) : null}
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
                        <TableCell className="hidden md:table-cell">
                          {warehouse.contactName || warehouse.phone ? (
                            <>
                              <div>{warehouse.contactName ?? "—"}</div>
                              {warehouse.phone ? (
                                <div className="text-xs text-muted-foreground">
                                  {formatPhone(warehouse.phone)}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <WarehouseMenu
                              warehouse={editable}
                              places={places}
                              keepers={keepers}
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
                <Warehouse />
              </EmptyMedia>
              <EmptyTitle>
                {tab === "inactive" ? "No inactive warehouses" : "No warehouses yet"}
              </EmptyTitle>
              <EmptyDescription>
                {tab === "inactive"
                  ? "Deactivated warehouses are kept here for the record."
                  : "Add the stores and depots where you keep stock."}
              </EmptyDescription>
            </EmptyHeader>
            {tab === "active" && canManage ? (
              <EmptyContent>
                <AddWarehouseDialog places={places} keepers={keepers} />
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </TabsContent>
    </UrlTabs>
  );
}
