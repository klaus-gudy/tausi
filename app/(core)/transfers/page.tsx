import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftRight } from "lucide-react";

import { InitiateTransferDialog } from "./transfer-dialog";
import { TransferMenu } from "./transfer-menu";
import { TransferTimeline, type TimelineStep } from "./transfer-timeline";
import { NoAccessState } from "@/components/no-access-state";
import { ProductName } from "@/components/product-name";
import { TablePagination } from "@/components/table-pagination";
import { UrlTabs } from "@/components/url-tabs";
import { Badge } from "@/components/ui/badge";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import type { StockTransferStatus } from "@/lib/generated/prisma/client";
import { formatCount, formatDate, formatTime } from "@/lib/format";
import { activeWarehouses, stockByWarehouse } from "@/lib/inventory";
import { currentPage } from "@/lib/list-size";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { BY_NAME, SALESPERSON_PERSON, salespersonName } from "@/lib/salespeople";
import { TRANSFER_STATUS_LABELS, transferNumber } from "@/lib/transfers";

export const metadata: Metadata = {
  title: "Transfers",
};

const PAGE_SIZE = 25;

const TABS = {
  initiated: ["initiated"],
  in_transit: ["in_transit"],
  arrived: ["arrived"],
  cancelled: ["cancelled"],
} satisfies Record<string, StockTransferStatus[]>;

type Tab = keyof typeof TABS;

const EMPTY: Record<Tab, { title: string; description: string }> = {
  initiated: {
    title: "No transfers waiting to leave",
    description: "Transfers show up here once their stock is picked, until they're marked in transit.",
  },
  in_transit: {
    title: "Nothing in transit",
    description: "Transfers on the road to a salesperson show up here until they arrive.",
  },
  arrived: {
    title: "No arrived transfers yet",
    description: "Transfers move here once they're marked arrived.",
  },
  cancelled: {
    title: "No cancelled transfers",
    description: "Transfers called off before they left the store.",
  },
};

const STATUS_VARIANTS: Record<StockTransferStatus, "default" | "secondary" | "outline"> = {
  initiated: "outline",
  in_transit: "secondary",
  arrived: "default",
  cancelled: "outline",
};

export default function TransfersPage({ searchParams }: PageProps<"/transfers">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Transfers</h1>
        <p className="text-sm text-muted-foreground">
          Send stock from the store to salespeople and follow it until it arrives.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Transfers searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Transfers({ searchParams }: Pick<PageProps<"/transfers">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("stock.read")) return <NoAccessState reason="no-permission" />;

  const params = await searchParams;
  const tab: Tab = typeof params.tab === "string" && Object.hasOwn(TABS, params.tab) ? (params.tab as Tab) : "initiated";
  // Transfers still on their way can be moved along or cancelled.
  const isOpen = tab === "initiated" || tab === "in_transit";
  const canTransfer = member.permissions.has("stock.transfer");
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const counts = await prisma.stockTransfer.groupBy({
    by: ["status"],
    where: { organizationId },
    _count: { _all: true },
  });
  const count = (statuses: StockTransferStatus[]) =>
    counts
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);
  const total = count(TABS[tab]);
  const page = currentPage(params.page, total, PAGE_SIZE);

  const [transfers, products, warehouses, stock, salespeople] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: { organizationId, status: { in: TABS[tab] } },
      // Open transfers oldest first, so the ones waiting longest are on top.
      orderBy: isOpen ? { number: "asc" } : { number: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        reference: true,
        note: true,
        createdAt: true,
        dispatchedAt: true,
        arrivedAt: true,
        cancelledAt: true,
        acknowledgedAt: true,
        salesperson: { select: { ...SALESPERSON_PERSON, zone: { select: { name: true } } } },
        warehouse: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        dispatchedBy: { select: { name: true, email: true } },
        arrivedBy: { select: { name: true, email: true } },
        cancelledBy: { select: { name: true, email: true } },
        acknowledgedBy: { select: { name: true, email: true } },
        movements: {
          where: { type: "transferred" },
          orderBy: { product: { name: "asc" } },
          select: { id: true, quantity: true, product: { select: { name: true, size: true } } },
        },
      },
    }),
    canTransfer
      ? prisma.product.findMany({
          where: { organizationId, archivedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true, size: true },
        })
      : [],
    canTransfer ? activeWarehouses(organizationId) : [],
    canTransfer ? stockByWarehouse(organizationId) : {},
    canTransfer
      ? prisma.salesperson.findMany({
          where: { organizationId, deactivatedAt: null },
          orderBy: BY_NAME,
          select: { id: true, ...SALESPERSON_PERSON, zone: { select: { name: true } } },
        })
      : [],
  ]);
  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "initiated", label: "Initiated", count: count(TABS.initiated) },
        { value: "in_transit", label: "In transit", count: count(TABS.in_transit) },
        { value: "arrived", label: "Arrived", count: count(TABS.arrived) },
        { value: "cancelled", label: "Cancelled", count: count(TABS.cancelled) },
      ]}
      actions={
        canTransfer
          ? {
              initiated: (
                <InitiateTransferDialog
                  products={products.map((product) => ({ ...product, onHand: 0 }))}
                  warehouses={warehouses}
                  stock={stock}
                  salespeople={salespeople.map((salesperson) => ({
                    id: salesperson.id,
                    name: salespersonName(salesperson),
                    zone: salesperson.zone?.name ?? null,
                  }))}
                />
              ),
            }
          : undefined
      }
    >
      <TabsContent value={tab}>
        {transfers.length ? (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created at</TableHead>
                    <TableHead className="hidden sm:table-cell">Transfer</TableHead>
                    <TableHead className="hidden md:table-cell">From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="hidden md:table-cell">Products</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Initiated by</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((transfer) => {
                    const units = transfer.movements.reduce((sum, line) => sum - line.quantity, 0);
                    const name = transferNumber(transfer.number);
                    return (
                      <TableRow key={transfer.id} className="align-top">
                        <TableCell className="whitespace-nowrap">
                          <div>{formatDate(transfer.createdAt)}</div>
                          <div className="text-xs text-muted-foreground">{formatTime(transfer.createdAt)}</div>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap sm:table-cell">
                          <div className="font-medium">{name}</div>
                          {transfer.reference ? (
                            <div className="text-xs text-muted-foreground">{transfer.reference}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{transfer.warehouse.name}</TableCell>
                        <TableCell>
                          <div>{salespersonName(transfer.salesperson)}</div>
                          {transfer.salesperson.zone ? (
                            <div className="text-xs text-muted-foreground">
                              {transfer.salesperson.zone.name}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <ul className="text-sm">
                            {transfer.movements.map((line) => (
                              <li key={line.id}>
                                {formatCount(-line.quantity)} × <ProductName name={line.product.name} />
                                {line.product.size ? (
                                  <span className="text-muted-foreground"> {line.product.size}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          {transfer.note ? (
                            <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                              {transfer.note}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCount(units)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[transfer.status]}>
                            {transfer.acknowledgedAt
                              ? "Acknowledged"
                              : TRANSFER_STATUS_LABELS[transfer.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {transfer.createdBy?.name || transfer.createdBy?.email || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <TransferTimeline
                              name={name}
                              route={`${transfer.warehouse.name} to ${salespersonName(transfer.salesperson)}`}
                              steps={timeline(transfer)}
                            />
                            {canTransfer && isOpen ? (
                              <TransferMenu
                                id={transfer.id}
                                name={name}
                                status={transfer.status as "initiated" | "in_transit"}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                page={page}
                total={total}
                pageSize={PAGE_SIZE}
                params={tab === "initiated" ? {} : { tab }}
              />
            </CardContent>
          </Card>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowLeftRight />
              </EmptyMedia>
              <EmptyTitle>
                {EMPTY[tab].title}
              </EmptyTitle>
              <EmptyDescription>
                {EMPTY[tab].description}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>
    </UrlTabs>
  );
}

type Person = { name: string | null; email: string } | null;

/** A transfer's steps for its timeline: what happened, then what's still to come. */
function timeline(transfer: {
  createdAt: Date;
  dispatchedAt: Date | null;
  arrivedAt: Date | null;
  cancelledAt: Date | null;
  acknowledgedAt: Date | null;
  createdBy: Person;
  dispatchedBy: Person;
  arrivedBy: Person;
  cancelledBy: Person;
  acknowledgedBy: Person;
}): TimelineStep[] {
  const step = (label: string, at: Date | null, by: Person): TimelineStep => ({
    label,
    done: at ? { date: formatDate(at), time: formatTime(at), by: by ? by.name || by.email : null } : null,
  });
  const initiated = step("Initiated", transfer.createdAt, transfer.createdBy);
  // A cancelled transfer never left the store, so it has no later steps.
  if (transfer.cancelledAt) return [initiated, step("Cancelled", transfer.cancelledAt, transfer.cancelledBy)];
  return [
    initiated,
    step("Dispatched", transfer.dispatchedAt, transfer.dispatchedBy),
    step("Arrived", transfer.arrivedAt, transfer.arrivedBy),
    step("Acknowledged", transfer.acknowledgedAt, transfer.acknowledgedBy),
  ];
}
