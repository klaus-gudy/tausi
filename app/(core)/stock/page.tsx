import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftRight, Package } from "lucide-react";

import { MovementMenu } from "./movement-menu";
import { AdjustStockDialog, IssueStockDialog, ReceiveStockDialog } from "./stock-dialogs";
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
import type { StockMovementType } from "@/lib/generated/prisma/client";
import { formatCount, formatDay, formatSigned } from "@/lib/format";
import { stockOnHand } from "@/lib/inventory";
import { shownCount } from "@/lib/list-size";
import { readActiveMember, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Stock in & out",
};

const PAGE_SIZE = 50;

// How the reverse dialog names a movement: "Reverse the issue of 10 Rice?"
const TYPE_NOUNS: Record<StockMovementType, string> = {
  received: "receipt",
  issued: "issue",
  adjustment: "adjustment",
  reversal: "reversal",
};

const TYPE_LABELS: Record<StockMovementType, string> = {
  received: "Received",
  issued: "Issued",
  adjustment: "Adjustment",
  reversal: "Reversal",
};

export default function StockPage({ searchParams }: PageProps<"/stock">) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stock in &amp; out</h1>
        <p className="text-muted-foreground">
          Record stock received from suppliers and issued to super dealers.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Stock searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Stock({ searchParams }: Pick<PageProps<"/stock">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("stock.read")) return <NoAccessState reason="no-permission" />;

  const params = await searchParams;
  const tab = params.tab === "movements" ? "movements" : "on-hand";
  const organizationId = member.organization.id;
  const { permissions } = member;

  const prisma = getPrisma();
  const [products, dealers, onHand, movementCount] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unit: true, reorderLevel: true },
    }),
    permissions.has("stock.issue")
      ? prisma.superDealer.findMany({
          where: { organizationId, deactivatedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, region: true },
        })
      : [],
    stockOnHand(organizationId),
    prisma.stockMovement.count({ where: { organizationId } }),
  ]);
  const stockProducts = products.map((product) => ({
    ...product,
    onHand: onHand.get(product.id) ?? 0,
  }));

  return (
    <>
      {products.length ? (
        <div className="flex flex-wrap gap-2">
          {permissions.has("stock.receive") ? <ReceiveStockDialog products={stockProducts} /> : null}
          {permissions.has("stock.issue") ? (
            <IssueStockDialog products={stockProducts} dealers={dealers} />
          ) : null}
          {permissions.has("stock.adjust") ? <AdjustStockDialog products={stockProducts} /> : null}
        </div>
      ) : null}
      <UrlTabs
        defaultValue={tab}
        tabs={[
          { value: "on-hand", label: "On hand" },
          { value: "movements", label: "Movements", count: movementCount },
        ]}
      >
        <TabsContent value={tab}>
          {tab === "on-hand" ? (
            <OnHand products={stockProducts} />
          ) : (
            <Movements
              member={member}
              shown={shownCount(params.show, PAGE_SIZE)}
              total={movementCount}
            />
          )}
        </TabsContent>
      </UrlTabs>
    </>
  );
}

function OnHand({
  products,
}: {
  products: { id: string; name: string; sku: string; unit: string; reorderLevel: number | null; onHand: number }[];
}) {
  if (!products.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyTitle>No products yet</EmptyTitle>
          <EmptyDescription>
            Add products under Products first, then record stock as it arrives.
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
              <TableHead>Product</TableHead>
              <TableHead className="hidden sm:table-cell">Unit</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Reorder level</TableHead>
              <TableHead className="text-right">On hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const low = product.reorderLevel !== null && product.onHand <= product.reorderLevel;
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.sku}</div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {product.unit}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {product.reorderLevel === null ? "—" : formatCount(product.reorderLevel)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {low ? (
                      <Badge variant="destructive" className="mr-2">
                        Low
                      </Badge>
                    ) : null}
                    {formatCount(product.onHand)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

async function Movements({
  member,
  shown,
  total,
}: {
  member: ActiveMember;
  shown: number;
  total: number;
}) {
  if (!total) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArrowLeftRight />
          </EmptyMedia>
          <EmptyTitle>No stock movements yet</EmptyTitle>
          <EmptyDescription>
            Every receipt, issue and correction shows up here, newest first.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const canReverse = member.permissions.has("stock.adjust");
  const movements = await getPrisma().stockMovement.findMany({
    where: { organizationId: member.organization.id },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: shown,
    select: {
      id: true,
      type: true,
      quantity: true,
      unitCost: true,
      supplier: true,
      reference: true,
      note: true,
      occurredOn: true,
      product: { select: { name: true, unit: true } },
      superDealer: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
      reversedBy: { select: { id: true } },
    },
  });

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
              {canReverse ? (
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => {
              const counterpart =
                movement.superDealer?.name ?? movement.supplier ?? (movement.type === "adjustment" ? "Stock count" : "—");
              const details = [movement.reference, movement.note].filter(Boolean).join(" · ");
              const summary = `the ${TYPE_NOUNS[movement.type]} of ${formatCount(Math.abs(movement.quantity))} ${movement.product.name}`;
              return (
                <TableRow key={movement.id} className={movement.reversedBy ? "text-muted-foreground" : undefined}>
                  <TableCell className="whitespace-nowrap">{formatDay(movement.occurredOn)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={movement.type === "received" ? "default" : movement.type === "issued" ? "secondary" : "outline"}>
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
                        {formatCount(movement.unitCost)} per {movement.product.unit}
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
                  {canReverse ? (
                    <TableCell>
                      {movement.type !== "reversal" && !movement.reversedBy ? (
                        <MovementMenu movementId={movement.id} summary={summary} />
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <LoadMore shown={shown} total={total} pageSize={PAGE_SIZE} params={{ tab: "movements" }} />
      </CardContent>
    </Card>
  );
}
