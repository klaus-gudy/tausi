import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Truck, UserX } from "lucide-react";

import { AcknowledgeButton } from "./acknowledge-button";
import { RecordDeliveryDialog } from "./delivery-dialog";
import { NoAccessState } from "@/components/no-access-state";
import { TablePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { byDealerName, dealerName } from "@/lib/dealers";
import { deliveryNumber, heldStock, readOwnSalesperson } from "@/lib/deliveries";
import { formatCount, formatDate, formatDay, formatTime } from "@/lib/format";
import { currentPage } from "@/lib/list-size";
import { readActiveMember, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
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

async function Deliveries({ searchParams }: Pick<PageProps<"/deliveries">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  const canRecord = member.permissions.has("deliveries.record");
  const canReadAll = member.permissions.has("deliveries.read");
  if (!canRecord && !canReadAll) return <NoAccessState reason="no-permission" />;

  const own = canRecord ? await readOwnSalesperson(member) : null;
  const { page } = await searchParams;

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

  return (
    <>
      {own ? <OwnStock member={member} salesperson={own} /> : null}
      <DeliveryList member={member} salespersonId={canReadAll ? null : own!.id} pageParam={page} />
    </>
  );
}

/** The signed-in salesperson's transfers to acknowledge, and what they hold. */
async function OwnStock({
  member,
  salesperson,
}: {
  member: ActiveMember;
  salesperson: { id: string; name: string };
}) {
  const organizationId = member.organization.id;
  const prisma = getPrisma();
  const [incoming, held, dealers] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: {
        organizationId,
        salespersonId: salesperson.id,
        status: { in: ["initiated", "in_transit", "arrived"] },
        acknowledgedAt: null,
      },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        status: true,
        reference: true,
        createdAt: true,
        dispatchedAt: true,
        movements: {
          where: { type: "transferred" },
          orderBy: { product: { name: "asc" } },
          select: { id: true, quantity: true, product: { select: { name: true, size: true } } },
        },
      },
    }),
    heldStock(organizationId, salesperson.id),
    prisma.superDealer.findMany({
      where: { organizationId, deactivatedAt: null },
      select: {
        id: true,
        shopName: true,
        contactName: true,
        region: { select: { name: true } },
        district: { select: { name: true } },
      },
    }),
  ]);
  const holding = held.get(salesperson.id) ?? new Map<string, number>();
  const products = holding.size
    ? await prisma.product.findMany({
        where: { id: { in: [...holding.keys()] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, size: true },
      })
    : [];
  const withYou = products.map((product) => ({ ...product, onHand: holding.get(product.id) ?? 0 }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Coming to you</CardTitle>
          <CardDescription>
            Acknowledge each transfer once you have the stock in hand. Only then can you supply it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {incoming.length ? (
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
                {incoming.map((transfer) => {
                  const name = transferNumber(transfer.number);
                  return (
                    <TableRow key={transfer.id} className="align-top">
                      <TableCell className="whitespace-nowrap">
                        <div>{formatDate(transfer.createdAt)}</div>
                        <div className="text-xs text-muted-foreground">{formatTime(transfer.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        {transfer.reference ? (
                          <div className="text-xs text-muted-foreground">{transfer.reference}</div>
                        ) : null}
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
                        {transfer.status === "initiated" ? (
                          <span className="text-xs text-muted-foreground">Still at the store</span>
                        ) : (
                          <AcknowledgeButton id={transfer.id} name={name} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing on its way to you.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock with you</CardTitle>
          <CardDescription>What you received and haven&apos;t supplied yet.</CardDescription>
          {withYou.length ? (
            <CardAction>
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
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {withYou.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Size</TableHead>
                  <TableHead className="text-right">With you</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withYou.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
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
          ) : (
            <p className="text-sm text-muted-foreground">
              You hold no stock. Acknowledge a transfer when it reaches you.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Deliveries newest first: everyone's, or one salesperson's. */
async function DeliveryList({
  member,
  salespersonId,
  pageParam,
}: {
  member: ActiveMember;
  salespersonId: string | null;
  /** The raw `?page=`. */
  pageParam: string | string[] | undefined;
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
      salesperson: { select: { name: true } },
      superDealer: { select: { shopName: true, contactName: true } },
      lines: {
        orderBy: { product: { name: "asc" } },
        select: { id: true, quantity: true, product: { select: { name: true, size: true } } },
      },
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{salespersonId ? "Your deliveries" : "All deliveries"}</CardTitle>
      </CardHeader>
      <CardContent>
        {deliveries.length ? (
          <>
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
                    {salespersonId ? null : <TableCell>{delivery.salesperson.name}</TableCell>}
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
            <TablePagination page={page} total={total} pageSize={PAGE_SIZE} />
          </>
        ) : (
          <Empty>
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
        )}
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
          {formatCount(line.quantity)} × {line.product.name}
          {line.product.size ? <span className="text-muted-foreground"> {line.product.size}</span> : null}
        </li>
      ))}
    </ul>
  );
}
