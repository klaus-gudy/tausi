import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { History } from "lucide-react";

import { NoAccessState } from "@/components/no-access-state";
import { ProductName } from "@/components/product-name";
import { TablePagination } from "@/components/table-pagination";
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
import { formatDate, formatSigned, formatTime } from "@/lib/format";
import { currentPage } from "@/lib/list-size";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { SALESPERSON_PERSON, salespersonName } from "@/lib/salespeople";
import { transferNumber } from "@/lib/transfers";

export const metadata: Metadata = {
  title: "Movement history",
};

const PAGE_SIZE = 25;

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

  // The warehouses' side of each move; an issue's dealer side mirrors it.
  const where = { organizationId: member.organization.id, holder: "warehouse" as const };
  const prisma = getPrisma();
  const total = await prisma.stockMovement.count({ where });
  const page = currentPage((await searchParams).page, total, PAGE_SIZE);
  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      type: true,
      quantity: true,
      reference: true,
      note: true,
      createdAt: true,
      product: { select: { name: true, size: true } },
      warehouse: { select: { name: true } },
      superDealer: { select: { shopName: true, contactName: true } },
      receipt: { select: { supplierName: true, reference: true, note: true } },
      transfer: { select: { number: true, salesperson: { select: SALESPERSON_PERSON } } },
      reverses: { select: { type: true } },
      createdBy: { select: { name: true, email: true } },
      reversedBy: { select: { id: true } },
    },
  });

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
              <TableHead>Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="hidden md:table-cell">From</TableHead>
              <TableHead className="hidden md:table-cell">To</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="hidden lg:table-cell">Recorded by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => {
              const warehouse: Party = { name: movement.warehouse?.name ?? "—" };
              const other = counterpart(movement);
              // Stock coming in is from the other side to the warehouse; going out, the reverse.
              const [from, to] = movement.quantity > 0 ? [other, warehouse] : [warehouse, other];
              const details = [
                movement.reference ?? movement.receipt?.reference,
                movement.note ?? movement.receipt?.note,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <TableRow key={movement.id} className={movement.reversedBy ? "text-muted-foreground" : undefined}>
                  <TableCell className="whitespace-nowrap">
                    <div>{formatDate(movement.createdAt)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(movement.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_BADGES[movement.type] ?? "outline"}>{TYPE_LABELS[movement.type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProductName name={movement.product.name} className="font-medium" />
                      {movement.product.size ? (
                        <span className="text-muted-foreground">{movement.product.size}</span>
                      ) : null}
                      {movement.reversedBy ? <Badge variant="outline">Reversed</Badge> : null}
                    </div>
                    {details ? (
                      <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{details}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <PartyCell party={from} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <PartyCell party={to} />
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
        <TablePagination page={page} total={total} pageSize={PAGE_SIZE} />
      </CardContent>
    </Card>
  );
}

/** One side of a movement: a warehouse, supplier, salesperson or dealer. */
type Party = { name: string; detail?: string };

/** Who or what is on the other side of a warehouse movement. */
function counterpart(movement: {
  type: StockMovementType;
  superDealer: Parameters<typeof dealerName>[0] | null;
  transfer: { number: number; salesperson: Parameters<typeof salespersonName>[0] } | null;
  receipt: { supplierName: string | null } | null;
  reverses: { type: StockMovementType } | null;
}): Party {
  if (movement.superDealer) return { name: dealerName(movement.superDealer), detail: "Super dealer" };
  if (movement.transfer) {
    return { name: salespersonName(movement.transfer.salesperson), detail: transferNumber(movement.transfer.number) };
  }
  if (movement.receipt) return { name: movement.receipt.supplierName ?? "Unnamed supplier", detail: "Supplier" };
  // A count's difference, or undoing one, has no one on the other side.
  const type = movement.type === "reversal" ? movement.reverses?.type : movement.type;
  return { name: type === "adjustment" ? "Stock count" : "—" };
}

function PartyCell({ party }: { party: Party }) {
  return (
    <>
      <div>{party.name}</div>
      {party.detail ? <div className="text-xs text-muted-foreground">{party.detail}</div> : null}
    </>
  );
}
