import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { History } from "lucide-react";

import { LoadMore } from "@/components/load-more";
import { NoAccessState } from "@/components/no-access-state";
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
import type { StockMovementType } from "@/lib/generated/prisma/client";
import { dealerName } from "@/lib/dealers";
import { formatCount, formatDay, formatSigned } from "@/lib/format";
import { shownCount } from "@/lib/list-size";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { transferNumber } from "@/lib/transfers";

export const metadata: Metadata = {
  title: "Movement history",
};

const PAGE_SIZE = 50;

// Stock coming in stands out, stock going out is quieter, the rest is plain.
const TYPE_BADGES: Partial<Record<StockMovementType, "default" | "secondary">> = {
  received: "default",
  issued: "secondary",
  transferred: "secondary",
};

const TYPE_LABELS: Record<StockMovementType, string> = {
  received: "Received",
  issued: "Issued",
  adjustment: "Adjustment",
  reversal: "Reversal",
  transferred: "Transferred",
};

export default function MovementHistoryPage({ searchParams }: PageProps<"/movement-history">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Movement history</h1>
        <p className="text-sm text-muted-foreground">
          Every stock movement in and out of the warehouses, newest first.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Movements searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Movements({ searchParams }: Pick<PageProps<"/movement-history">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("stock.read")) return <NoAccessState reason="no-permission" />;

  const shown = shownCount((await searchParams).show, PAGE_SIZE);
  // The warehouses' side of each move; an issue's dealer side mirrors it.
  const where = { organizationId: member.organization.id, holder: "warehouse" as const };
  const prisma = getPrisma();
  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: shown,
      select: {
        id: true,
        type: true,
        quantity: true,
        unitCost: true,
        reference: true,
        note: true,
        occurredOn: true,
        product: { select: { name: true } },
        warehouse: { select: { name: true } },
        superDealer: { select: { shopName: true, contactName: true } },
        receipt: { select: { supplierName: true, reference: true, note: true } },
        transfer: { select: { number: true, salesperson: { select: { name: true } } } },
        createdBy: { select: { name: true, email: true } },
        reversedBy: { select: { id: true } },
      },
    }),
  ]);

  if (!total) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>No stock movements yet</EmptyTitle>
          <EmptyDescription>
            Every receipt and transfer shows up here, newest first.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Movement</TableHead>
              <TableHead className="hidden md:table-cell">From / to</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="hidden lg:table-cell">Recorded by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => {
              const counterpart =
                (movement.superDealer && dealerName(movement.superDealer)) ??
                (movement.transfer && `${movement.transfer.salesperson.name} · ${transferNumber(movement.transfer.number)}`) ??
                movement.receipt?.supplierName ??
                (movement.type === "adjustment" ? "Stock count" : "—");
              const details = [
                movement.warehouse?.name,
                movement.reference ?? movement.receipt?.reference,
                movement.note ?? movement.receipt?.note,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <TableRow key={movement.id} className={movement.reversedBy ? "text-muted-foreground" : undefined}>
                  <TableCell className="whitespace-nowrap">{formatDay(movement.occurredOn)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={TYPE_BADGES[movement.type] ?? "outline"}>
                        {TYPE_LABELS[movement.type]}
                      </Badge>
                      <span className="font-medium">{movement.product.name}</span>
                      {movement.reversedBy ? <Badge variant="outline">Reversed</Badge> : null}
                    </div>
                    {details ? (
                      <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{details}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {counterpart}
                    {movement.unitCost !== null ? (
                      <div className="text-xs text-muted-foreground">
                        {formatCount(movement.unitCost)} each
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${movement.quantity > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}`}
                  >
                    {formatSigned(movement.quantity)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {movement.createdBy?.name || movement.createdBy?.email || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <LoadMore shown={shown} total={total} pageSize={PAGE_SIZE} />
      </CardContent>
    </Card>
  );
}
