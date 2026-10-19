import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Package } from "lucide-react";

import { AddProductDialog } from "./product-dialog";
import { ProductMenu } from "./product-menu";
import { NoAccessState } from "@/components/no-access-state";
import { UrlTabs } from "@/components/url-tabs";
import { Badge } from "@/components/ui/badge";
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
import { formatCount } from "@/lib/format";
import { stockOnHand } from "@/lib/inventory";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Products",
};

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          What you stock, its unit and price, and how much is on hand.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Products searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Products({ searchParams }: Pick<PageProps<"/products">, "searchParams">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("products.read")) return <NoAccessState reason="no-permission" />;

  const tab = (await searchParams).tab === "archived" ? "archived" : "active";
  const canManage = member.permissions.has("products.manage");
  const organizationId = member.organization.id;

  const prisma = getPrisma();
  const [products, activeCount, archivedCount, onHand] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, archivedAt: tab === "archived" ? { not: null } : null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        price: true,
        reorderLevel: true,
        description: true,
      },
    }),
    prisma.product.count({ where: { organizationId, archivedAt: null } }),
    prisma.product.count({ where: { organizationId, archivedAt: { not: null } } }),
    stockOnHand(organizationId),
  ]);

  return (
    <UrlTabs
      defaultValue={tab}
      tabs={[
        { value: "active", label: "Active", count: activeCount },
        { value: "archived", label: "Archived", count: archivedCount },
      ]}
      actions={canManage ? { active: <AddProductDialog /> } : undefined}
    >
      <TabsContent value={tab}>
        {products.length ? (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden sm:table-cell">Unit</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    {canManage ? (
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const quantity = onHand.get(product.id) ?? 0;
                    const low = product.reorderLevel !== null && quantity <= product.reorderLevel;
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">{product.sku}</div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {product.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(product.price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {low && tab === "active" ? (
                            <Badge variant="destructive" className="mr-2">
                              Low
                            </Badge>
                          ) : null}
                          {formatCount(quantity)}
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <ProductMenu product={product} archived={tab === "archived"} />
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
                <Package />
              </EmptyMedia>
              <EmptyTitle>
                {tab === "archived" ? "No archived products" : "No products yet"}
              </EmptyTitle>
              <EmptyDescription>
                {tab === "archived"
                  ? "Archived products keep their stock history but can't be received or issued."
                  : "Add the products you stock, then record stock as it arrives."}
              </EmptyDescription>
            </EmptyHeader>
            {tab === "active" && canManage ? (
              <EmptyContent>
                <AddProductDialog />
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </TabsContent>
    </UrlTabs>
  );
}
