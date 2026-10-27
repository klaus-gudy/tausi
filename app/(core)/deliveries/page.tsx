import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Package, Truck, UserX } from "lucide-react";

import { AcknowledgeButton } from "./acknowledge-button";
import { RecordDeliveryDialog } from "./delivery-dialog";
import type { StockProduct } from "../stock/stock-dialogs";
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
import { byDealerName, dealerName } from "@/lib/dealers";
import { deliveryNumber, heldStock, readOwnSalesperson } from "@/lib/deliveries";
import { formatCount, formatDate, formatDay, formatTime } from "@/lib/format";
import { currentPage } from "@/lib/list-size";
import { readActiveMember, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { SALESPERSON_PERSON, salespersonName } from "@/lib/salespeople";
import { TRANSFER_STATUS_LABELS, transferNumber } from "@/lib/transfers";

export const metadata: Metadata = {
  title: "Deliveries",
};

const PAGE_SIZE = 25;

export default function DeliveriesPage({ searchParams }: PageProps<"/deliveries">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Stock salespeople receive from the store and supply to super dealers.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Deliveries searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Tab = "incoming" | "stock" | "distributed";

async function Deliveries({ searchParams }: Pick<PageProps<"/deliveries">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  const canRecord = member.permissions.has("deliveries.record");
  const canReadAll = member.permissions.has("deliveries.read");
  if (!canRecord && !canReadAll) return <NoAccessState reason="no-permission" />;

  const own = canRecord ? await readOwnSalesperson(member) : null;
  const params = await searchParams;

  if (!own && !canReadAll) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserX />
          </EmptyMedia>
          <EmptyTitle>You&apos;re not set up as a salesperson</EmptyTitle>
          <EmptyDescription>
            Ask an admin to link your login to your salesperson record under Salespeople.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  // Only a salesperson has stock coming to them and in hand; others just see what was distributed.
  if (!own) return <DeliveryList member={member} salespersonId={null} pageParam={params.page} />;

  const tab: Tab = params.tab === "stock" || params.tab === "distributed" ? params.tab : "incoming";
  const organizationId = member.organization.id;
  const salespersonId = canReadAll ? null : own.id;
  const prisma = getPrisma();
  const [incoming, held, distributed, dealers] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: {
        organizationId,
        salespersonId: own.id,
        status: { in: ["initiated", "in_transit", "arrived"] },
        acknowledgedAt: null,
      },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        dispatchedAt: true,
        movements: {
          where: { type: "transferred" },
          orderBy: { product: { name: "asc" } },
          select: { id: true, quantity: true, product: { select: { name: true, size: true } } },
        },
      },
    }),
    heldStock(organizationId, own.id),
    prisma.delivery.count({ where: { organizationId, ...(salespersonId ? { salespersonId } : {}) } }),
    tab === "stock"
      ? prisma.superDealer.findMany({
          where: { organizationId, deactivatedAt: null },
          select: {
            id: true,
            shopName: true,
            contactName: true,
            region: { select: { name: true } },
            district: { select: { name: true } },
          },
        })
      : [],
  ]);
  const holding = held.get(own.id) ?? new Map<string, number>();
  const products =
    tab === "stock" && holding.size
      ? await prisma.product.findMany({
          where: { id: { in: [...holding.keys()] } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true, size: true },
        })
      : [];
  const withYou = products.map((product) => ({ ...product, onHand: holding.get(product.id) ?? 0 }));

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "incoming", label: "Incoming", count: incoming.length },
        { value: "stock", label: "Stock in hand", count: holding.size },
        { value: "distributed", label: "Distributed", count: distributed },
      ]}
      actions={
        withYou.length
          ? {
              stock: (
                <RecordDeliveryDialog
                  products={withYou}
                  dealers={dealers.sort(byDealerName).map((dealer) => ({
                    id: dealer.id,
                    name: dealerName(dealer),
                    place: dealer.region
                      ? [dealer.district?.name, dealer.region.name].filter(Boolean).join(", ")
                      : null,
                  }))}
                />
              ),
            }
          : undefined
      }
    >
      <TabsContent value={tab}>
        {tab === "incoming" ? <Incoming transfers={incoming} /> : null}
        {tab === "stock" ? <StockInHand products={withYou} /> : null}
        {tab === "distributed" ? (
          <DeliveryList
            member={member}
            salespersonId={salespersonId}
            pageParam={params.page}
            params={{ tab: "distributed" }}
          />
        ) : null}
      </TabsContent>
    </UrlTabs>
  );
}

/** Transfers on their way to the signed-in salesperson, to acknowledge once they have them. */
function Incoming({
  transfers,
}: {
  transfers: {
    id: string;
    number: number;
    status: StockTransferStatus;
    createdAt: Date;
    dispatchedAt: Date | null;
    movements: { id: string; quantity: number; product: { name: string; size: string | null } }[];
  }[];
}) {
  if (!transfers.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Truck />
          </EmptyMedia>
          <EmptyTitle>Nothing on its way to you</EmptyTitle>
          <EmptyDescription>Transfers the store sends you show up here until you acknowledge them.</EmptyDescription>
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
              <TableHead>Created at</TableHead>
              <TableHead>Transfer</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer) => {
              const name = transferNumber(transfer.number);
              return (
                <TableRow key={transfer.id} className="align-top">
                  <TableCell className="whitespace-nowrap">
                    <div>{formatDate(transfer.createdAt)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(transfer.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{name}</div>
                  </TableCell>
                  <TableCell>
                    <ProductList lines={transfer.movements.map((line) => ({ ...line, quantity: -line.quantity }))} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={transfer.status === "initiated" ? "outline" : "secondary"}>
                      {TRANSFER_STATUS_LABELS[transfer.status]}
                    </Badge>
                    {transfer.dispatchedAt ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Dispatched {formatDate(transfer.dispatchedAt)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {transfer.status === "arrived" ? (
                      <AcknowledgeButton id={transfer.id} name={name} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {transfer.status === "initiated" ? "Still at the store" : "On its way"}
                      </span>
                    )}
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

/** What the signed-in salesperson received and hasn't supplied yet. */
function StockInHand({ products }: { products: StockProduct[] }) {
  if (!products.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyTitle>You hold no stock</EmptyTitle>
          <EmptyDescription>Acknowledge a transfer when it reaches you, then supply dealers from it.</EmptyDescription>
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
              <TableHead className="hidden sm:table-cell">Size</TableHead>
              <TableHead className="text-right">With you</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <ProductName name={product.name} className="block font-medium" />
                  <div className="text-xs text-muted-foreground">{product.code}</div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {product.size ?? "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCount(product.onHand)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Deliveries newest first: everyone's, or one salesperson's. */
async function DeliveryList({
  member,
  salespersonId,
  pageParam,
  params,
}: {
  member: ActiveMember;
  salespersonId: string | null;
  /** The raw `?page=`. */
  pageParam: string | string[] | undefined;
  /** Other query params the page links keep. */
  params?: Record<string, string>;
}) {
  const where = {
    organizationId: member.organization.id,
    ...(salespersonId ? { salespersonId } : {}),
  };
  const prisma = getPrisma();
  const total = await prisma.delivery.count({ where });
  const page = currentPage(pageParam, total, PAGE_SIZE);
  const deliveries = await prisma.delivery.findMany({
    where,
    orderBy: [{ deliveredOn: "desc" }, { number: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      number: true,
      deliveredOn: true,
      reference: true,
      note: true,
      salesperson: { select: SALESPERSON_PERSON },
      superDealer: { select: { shopName: true, contactName: true } },
      lines: {
        orderBy: { product: { name: "asc" } },
        select: { id: true, quantity: true, product: { select: { name: true, size: true } } },
      },
    },
  });

  if (!deliveries.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Truck />
          </EmptyMedia>
          <EmptyTitle>No deliveries yet</EmptyTitle>
          <EmptyDescription>
            Stock salespeople supply to super dealers shows up here, newest first.
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
              <TableHead>Delivered on</TableHead>
              <TableHead>Delivery</TableHead>
              {salespersonId ? null : <TableHead>Salesperson</TableHead>}
              <TableHead>Super dealer</TableHead>
              <TableHead className="hidden md:table-cell">Products</TableHead>
              <TableHead className="text-right">Units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((delivery) => (
              <TableRow key={delivery.id} className="align-top">
                <TableCell className="whitespace-nowrap">{formatDay(delivery.deliveredOn)}</TableCell>
                <TableCell>
                  <div className="font-medium">{deliveryNumber(delivery.number)}</div>
                  {delivery.reference ? (
                    <div className="text-xs text-muted-foreground">{delivery.reference}</div>
                  ) : null}
                </TableCell>
                {salespersonId ? null : <TableCell>{salespersonName(delivery.salesperson)}</TableCell>}
                <TableCell>{dealerName(delivery.superDealer)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <ProductList lines={delivery.lines} />
                  {delivery.note ? (
                    <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                      {delivery.note}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCount(delivery.lines.reduce((sum, line) => sum + line.quantity, 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination page={page} total={total} pageSize={PAGE_SIZE} params={params} />
      </CardContent>
    </Card>
  );
}

function ProductList({
  lines,
}: {
  lines: { id: string; quantity: number; product: { name: string; size: string | null } }[];
}) {
  return (
    <ul className="text-sm">
      {lines.map((line) => (
        <li key={line.id}>
          {formatCount(line.quantity)} × <ProductName name={line.product.name} />
          {line.product.size ? <span className="text-muted-foreground"> {line.product.size}</span> : null}
        </li>
      ))}
    </ul>
  );
}
