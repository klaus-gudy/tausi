import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PackagePlus } from "lucide-react";

import { ReceiveStockDialog } from "../stock/stock-dialogs";
import { receiptLines } from "./receipts";
import { LoadMore } from "@/components/load-more";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCount, formatDay } from "@/lib/format";
import { activeWarehouses, stockOnHand } from "@/lib/inventory";
import { shownCount } from "@/lib/list-size";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Goods received",
};

const PAGE_SIZE = 50;

export default function GoodsReceivedPage({ searchParams }: PageProps<"/goods-received">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Goods received</h1>
        <p className="text-sm text-muted-foreground">
          Every delivery from a supplier: what came in, at what cost, and where it was put.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Receipts searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Receipts({ searchParams }: Pick<PageProps<"/goods-received">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("stock.read")) return <NoAccessState reason="no-permission" />;

  const shown = shownCount((await searchParams).show, PAGE_SIZE);
  const organizationId = member.organization.id;
  const canReceive = member.permissions.has("stock.receive");

  const prisma = getPrisma();
  const [total, receipts, products, warehouses, onHand] = await Promise.all([
    prisma.stockReceipt.count({ where: { organizationId } }),
    prisma.stockReceipt.findMany({
      where: { organizationId },
      orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }],
      take: shown,
      select: {
        id: true,
        supplierName: true,
        reference: true,
        receivedOn: true,
        warehouse: { select: { name: true } },
        receivedBy: { select: { name: true, email: true } },
        stockMovements: {
          where: { type: "received" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            quantity: true,
            unitCost: true,
            product: { select: { name: true, code: true, size: true } },
            reversedBy: { select: { id: true } },
          },
        },
      },
    }),
    canReceive
      ? prisma.product.findMany({
          where: { organizationId, archivedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true, size: true },
        })
      : [],
    canReceive ? activeWarehouses(organizationId) : [],
    canReceive ? stockOnHand(organizationId) : new Map<string, number>(),
  ]);

  return (
    <>
      {canReceive && products.length ? (
        <div className="flex justify-end">
          <ReceiveStockDialog
            products={products.map((product) => ({ ...product, onHand: onHand.get(product.id) ?? 0 }))}
            warehouses={warehouses}
          />
        </div>
      ) : null}
      {total ? (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="hidden md:table-cell">Products</TableHead>
                  <TableHead className="hidden sm:table-cell">Warehouse</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Value</TableHead>
                  <TableHead className="hidden lg:table-cell">Recorded by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => {
                  const { lines, units, value } = receiptLines(receipt.stockMovements);
                  const href = `/goods-received/${receipt.id}`;
                  return (
                    <TableRow key={receipt.id} className="relative">
                      <TableCell className="whitespace-nowrap">
                        <Link href={href} className="after:absolute after:inset-0">
                          {formatDay(receipt.receivedOn)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{receipt.supplierName ?? "No supplier given"}</div>
                        {receipt.reference ? (
                          <div className="text-xs text-muted-foreground">{receipt.reference}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden max-w-xs whitespace-normal md:table-cell">
                        <div className="line-clamp-2">
                          {lines.map((line) => `${line.product.name} × ${formatCount(line.quantity)}`).join(", ")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lines.length} {lines.length === 1 ? "product" : "products"}
                          {lines.some((line) => line.reversed) ? " · some reversed" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{receipt.warehouse.name}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCount(units)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">
                        {value === null ? "—" : formatCount(value)}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {receipt.receivedBy?.name || receipt.receivedBy?.email || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <LoadMore shown={shown} total={total} pageSize={PAGE_SIZE} />
          </CardContent>
        </Card>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackagePlus />
            </EmptyMedia>
            <EmptyTitle>No goods received yet</EmptyTitle>
            <EmptyDescription>
              {products.length || !canReceive
                ? "Each delivery you receive is kept here with its products, quantities and costs."
                : "Add products under Products first, then receive stock as it arrives."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
