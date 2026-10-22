import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftRight } from "lucide-react";

import { InitiateTransferDialog } from "./transfer-dialog";
import { TransferMenu } from "./transfer-menu";
import { LoadMore } from "@/components/load-more";
import { NoAccessState } from "@/components/no-access-state";
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
import { formatCount, formatDate, formatDay } from "@/lib/format";
import { stockOnHand } from "@/lib/inventory";
import { shownCount } from "@/lib/list-size";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { TRANSFER_STATUS_LABELS, transferNumber } from "@/lib/transfers";

export const metadata: Metadata = {
  title: "Transfers",
};

const PAGE_SIZE = 50;

const TABS = {
  open: ["initiated", "in_transit"],
  arrived: ["arrived"],
  cancelled: ["cancelled"],
} satisfies Record<string, StockTransferStatus[]>;

type Tab = keyof typeof TABS;

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
        <h1 className="text-2xl font-semibold tracking-tight">Transfers</h1>
        <p className="text-muted-foreground">
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
  const tab: Tab = params.tab === "arrived" || params.tab === "cancelled" ? params.tab : "open";
  const shown = shownCount(params.show, PAGE_SIZE);
  const canTransfer = member.permissions.has("stock.transfer");
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const [counts, transfers, products, onHand, salespeople] = await Promise.all([
    prisma.stockTransfer.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.stockTransfer.findMany({
      where: { organizationId, status: { in: TABS[tab] } },
      // Open transfers oldest first, so the ones waiting longest are on top.
      orderBy: tab === "open" ? { number: "asc" } : { number: "desc" },
      take: shown,
      select: {
        id: true,
        number: true,
        status: true,
        reference: true,
        note: true,
        initiatedOn: true,
        createdAt: true,
        dispatchedAt: true,
        arrivedAt: true,
        cancelledAt: true,
        salesperson: { select: { name: true, zone: { select: { name: true } } } },
        createdBy: { select: { name: true, email: true } },
        dispatchedBy: { select: { name: true, email: true } },
        arrivedBy: { select: { name: true, email: true } },
        cancelledBy: { select: { name: true, email: true } },
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
          select: { id: true, name: true, code: true },
        })
      : [],
    canTransfer ? stockOnHand(organizationId) : new Map<string, number>(),
    canTransfer
      ? prisma.salesperson.findMany({
          where: { organizationId, deactivatedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, zone: { select: { name: true } } },
        })
      : [],
  ]);
  const count = (statuses: StockTransferStatus[]) =>
    counts
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);
  const total = count(TABS[tab]);

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "open", label: "Open", count: count(TABS.open) },
        { value: "arrived", label: "Arrived", count: count(TABS.arrived) },
        { value: "cancelled", label: "Cancelled", count: count(TABS.cancelled) },
      ]}
      actions={
        canTransfer
          ? {
              open: (
                <InitiateTransferDialog
                  products={products.map((product) => ({
                    ...product,
                    onHand: onHand.get(product.id) ?? 0,
                  }))}
                  salespeople={salespeople.map((salesperson) => ({
                    id: salesperson.id,
                    name: salesperson.name,
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
                    <TableHead>Transfer</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead className="hidden md:table-cell">Products</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead>Status</TableHead>
                    {canTransfer && tab === "open" ? (
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((transfer) => {
                    const units = transfer.movements.reduce((sum, line) => sum - line.quantity, 0);
                    const name = transferNumber(transfer.number);
                    return (
                      <TableRow key={transfer.id} className="align-top">
                        <TableCell>
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDay(transfer.initiatedOn)}
                            {transfer.reference ? ` · ${transfer.reference}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{transfer.salesperson.name}</div>
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
                                {formatCount(-line.quantity)} × {line.product.name}
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
                            {TRANSFER_STATUS_LABELS[transfer.status]}
                          </Badge>
                          <Steps transfer={transfer} />
                        </TableCell>
                        {canTransfer && tab === "open" ? (
                          <TableCell>
                            <TransferMenu
                              id={transfer.id}
                              name={name}
                              status={transfer.status as "initiated" | "in_transit"}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <LoadMore shown={shown} total={total} pageSize={PAGE_SIZE} params={{ tab }} />
            </CardContent>
          </Card>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowLeftRight />
              </EmptyMedia>
              <EmptyTitle>
                {tab === "open"
                  ? "No open transfers"
                  : tab === "arrived"
                    ? "No arrived transfers yet"
                    : "No cancelled transfers"}
              </EmptyTitle>
              <EmptyDescription>
                {tab === "open"
                  ? "Transfers being picked or on the road show up here until they arrive."
                  : tab === "arrived"
                    ? "Transfers move here once they're marked arrived."
                    : "Transfers called off before they left the store."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>
    </UrlTabs>
  );
}

type Person = { name: string | null; email: string } | null;

/** Who did each step and when, under the status badge. */
function Steps({
  transfer,
}: {
  transfer: {
    createdAt: Date;
    dispatchedAt: Date | null;
    arrivedAt: Date | null;
    cancelledAt: Date | null;
    createdBy: Person;
    dispatchedBy: Person;
    arrivedBy: Person;
    cancelledBy: Person;
  };
}) {
  const who = (person: Person) => (person ? ` by ${person.name || person.email}` : "");
  const steps = [
    { label: "Initiated", at: transfer.createdAt, by: transfer.createdBy },
    { label: "Dispatched", at: transfer.dispatchedAt, by: transfer.dispatchedBy },
    { label: "Arrived", at: transfer.arrivedAt, by: transfer.arrivedBy },
    { label: "Cancelled", at: transfer.cancelledAt, by: transfer.cancelledBy },
  ];
  return (
    <ul className="mt-1 text-xs text-muted-foreground">
      {steps.map((step) =>
        step.at ? (
          <li key={step.label}>
            {step.label} {formatDate(step.at)}
            {who(step.by)}
          </li>
        ) : null
      )}
    </ul>
  );
}
