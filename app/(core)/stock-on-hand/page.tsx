import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Package, UserCheck } from "lucide-react";

import {
  MobileCard,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards";
import { NoAccessState } from "@/components/no-access-state";
import { ProductName } from "@/components/product-name";
import { UrlTabs } from "@/components/url-tabs";
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
import { TabsContent } from "@/components/ui/tabs";
import { heldStock } from "@/lib/deliveries";
import { formatCount } from "@/lib/format";
import { stockByWarehouse, stockInTransit } from "@/lib/inventory";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { BY_NAME, SALESPERSON_PERSON, salespersonName } from "@/lib/salespeople";

export const metadata: Metadata = {
  title: "Stock on hand",
};

type Product = { id: string; name: string; code: string; size: string | null };
type Warehouse = { id: string; name: string; inactive: boolean };

export default function StockOnHandPage({ searchParams }: PageProps<"/stock-on-hand">) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Stock on hand</h1>
        <p className="text-sm text-muted-foreground">
          How much of each product is in each warehouse and with each salesperson.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <StockOnHand searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function StockOnHand({ searchParams }: Pick<PageProps<"/stock-on-hand">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("stock.read")) return <NoAccessState reason="no-permission" />;

  const canSeeSalespeople = member.permissions.has("salespeople.read");
  const tab = canSeeSalespeople && (await searchParams).tab === "salespeople" ? "salespeople" : "products";
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const [allProducts, allWarehouses, salespeople, inWarehouses, inTransit, held] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, size: true, archivedAt: true },
    }),
    prisma.warehouse.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, deactivatedAt: true },
    }),
    canSeeSalespeople
      ? prisma.salesperson
          .findMany({
            where: { organizationId },
            orderBy: BY_NAME,
            select: { id: true, ...SALESPERSON_PERSON },
          })
          .then((rows) => rows.map((row) => ({ id: row.id, name: salespersonName(row) })))
      : [],
    stockByWarehouse(organizationId),
    stockInTransit(organizationId),
    heldStock(organizationId),
  ]);

  // What all salespeople hold together, per product.
  const withSalespeople = new Map<string, number>();
  for (const products of held.values()) {
    for (const [productId, units] of products) {
      withSalespeople.set(productId, (withSalespeople.get(productId) ?? 0) + units);
    }
  }
  const inWarehouse = (warehouseId: string, productId: string) => inWarehouses[warehouseId]?.[productId] ?? 0;
  // Inactive warehouses and archived products only show while they still hold stock.
  const warehouses: Warehouse[] = allWarehouses
    .filter(
      (warehouse) =>
        !warehouse.deactivatedAt || Object.values(inWarehouses[warehouse.id] ?? {}).some(Boolean)
    )
    .map((warehouse) => ({ id: warehouse.id, name: warehouse.name, inactive: !!warehouse.deactivatedAt }));
  const rows = allProducts
    .map((product) => {
      const warehouseUnits = warehouses.map((warehouse) => inWarehouse(warehouse.id, product.id));
      const transit = inTransit.get(product.id) ?? 0;
      const field = withSalespeople.get(product.id) ?? 0;
      const total = warehouseUnits.reduce((sum, units) => sum + units, 0) + transit + field;
      return { product, warehouseUnits, transit, field, total };
    })
    .filter((row) => !row.product.archivedAt || row.total);

  const holders = salespeople
    .map((salesperson) => ({
      ...salesperson,
      products: allProducts
        .map((product) => ({ product, units: held.get(salesperson.id)?.get(product.id) ?? 0 }))
        .filter((line) => line.units),
    }))
    .filter((holder) => holder.products.length);

  const tabs = [{ value: "products", label: "By product" }];
  if (canSeeSalespeople) tabs.push({ value: "salespeople", label: "By salesperson" });

  return (
    <UrlTabs defaultValue={tab} tabs={tabs}>
      <TabsContent value={tab}>
        {tab === "products" ? (
          <ByProduct rows={rows} warehouses={warehouses} />
        ) : (
          <BySalesperson holders={holders} />
        )}
      </TabsContent>
    </UrlTabs>
  );
}

function ByProduct({
  rows,
  warehouses,
}: {
  rows: { product: Product; warehouseUnits: number[]; transit: number; field: number; total: number }[];
  warehouses: Warehouse[];
}) {
  if (!rows.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyTitle>No products yet</EmptyTitle>
          <EmptyDescription>
            Add products under Products first, then receive stock under Goods received.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const sum = (pick: (row: (typeof rows)[number]) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  return (
    <Card>
      <CardContent>
        <MobileCards>
          {rows.map(({ product, warehouseUnits, transit, field, total }) => (
            <MobileCard key={product.id}>
              <MobileCardHeader
                title={product.name}
                description={[product.code, product.size].filter(Boolean).join(" · ")}
                aside={<span className="font-medium tabular-nums">{formatCount(total)}</span>}
              />
              <MobileCardFields>
                {warehouses.map((warehouse, index) => (
                  <MobileCardField key={warehouse.id} label={`${warehouse.name}${warehouse.inactive ? " (inactive)" : ""}`}>
                    <Units units={warehouseUnits[index]} />
                  </MobileCardField>
                ))}
                <MobileCardField label="In transit">
                  <Units units={transit} />
                </MobileCardField>
                <MobileCardField label="With salespeople">
                  <Units units={field} />
                </MobileCardField>
              </MobileCardFields>
            </MobileCard>
          ))}
        </MobileCards>
        {/* The table's totals row, for the cards. */}
        <p className="pt-3 text-sm text-muted-foreground @4xl/main:hidden">
          All products: <span className="font-medium text-foreground tabular-nums">{formatCount(sum((row) => row.total))}</span> units
        </p>
        <Table className="hidden @4xl/main:table">
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              {warehouses.map((warehouse) => (
                <TableHead key={warehouse.id} className="hidden text-right md:table-cell">
                  {warehouse.name}
                  {warehouse.inactive ? " (inactive)" : ""}
                </TableHead>
              ))}
              <TableHead className="hidden text-right lg:table-cell">In transit</TableHead>
              <TableHead className="hidden text-right lg:table-cell">With salespeople</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ product, warehouseUnits, transit, field, total }) => (
              <TableRow key={product.id}>
                <TableCell>
                  <ProductName name={product.name} className="block font-medium" />
                  <div className="text-xs text-muted-foreground">
                    {product.code}
                    {product.size ? ` · ${product.size}` : ""}
                  </div>
                </TableCell>
                {warehouseUnits.map((units, index) => (
                  <UnitsCell key={warehouses[index].id} units={units} className="hidden md:table-cell" />
                ))}
                <UnitsCell units={transit} className="hidden lg:table-cell" />
                <UnitsCell units={field} className="hidden lg:table-cell" />
                <TableCell className="text-right font-medium tabular-nums">{formatCount(total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">All products</TableCell>
              {warehouses.map((warehouse, index) => (
                <UnitsCell
                  key={warehouse.id}
                  units={sum((row) => row.warehouseUnits[index])}
                  className="hidden md:table-cell"
                />
              ))}
              <UnitsCell units={sum((row) => row.transit)} className="hidden lg:table-cell" />
              <UnitsCell units={sum((row) => row.field)} className="hidden lg:table-cell" />
              <TableCell className="text-right font-medium tabular-nums">
                {formatCount(sum((row) => row.total))}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

/** A count; nothing held reads as a quiet dash. */
function Units({ units }: { units: number }) {
  return units ? <span className="tabular-nums">{formatCount(units)}</span> : <span className="text-muted-foreground">—</span>;
}

/** A right-aligned count; nothing held reads as a quiet dash. */
function UnitsCell({ units, className }: { units: number; className?: string }) {
  return (
    <TableCell className={`text-right tabular-nums ${units ? "" : "text-muted-foreground"} ${className ?? ""}`}>
      {units ? formatCount(units) : "—"}
    </TableCell>
  );
}

function BySalesperson({
  holders,
}: {
  holders: { id: string; name: string; products: { product: Product; units: number }[] }[];
}) {
  if (!holders.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserCheck />
          </EmptyMedia>
          <EmptyTitle>No salesperson holds stock</EmptyTitle>
          <EmptyDescription>
            Stock shows here once a salesperson acknowledges a transfer, until they supply it to dealers.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardContent>
        <MobileCards>
          {holders.map((holder) => (
            <MobileCard key={holder.id}>
              <MobileCardHeader
                title={holder.name}
                aside={
                  <span className="font-medium tabular-nums">
                    {formatCount(holder.products.reduce((total, { units }) => total + units, 0))} units
                  </span>
                }
              />
              <MobileCardFields>
                {holder.products.map(({ product, units }) => (
                  <MobileCardField key={product.id} label={[product.name, product.size].filter(Boolean).join(" · ")}>
                    <span className="tabular-nums">{formatCount(units)}</span>
                  </MobileCardField>
                ))}
              </MobileCardFields>
            </MobileCard>
          ))}
        </MobileCards>
        <Table className="hidden @4xl/main:table">
          <TableHeader>
            <TableRow>
              <TableHead>Salesperson</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holders.flatMap((holder) =>
              holder.products.map(({ product, units }, index) => (
                <TableRow key={`${holder.id}-${product.id}`}>
                  <TableCell className="font-medium">{index === 0 ? holder.name : null}</TableCell>
                  <TableCell>
                    <ProductName name={product.name} />
                    {product.size ? <span className="text-muted-foreground"> · {product.size}</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(units)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
