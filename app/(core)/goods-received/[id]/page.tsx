import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { MovementMenu } from "../../stock/movement-menu";
import { BackLink } from "../back-link";
import { receiptLines } from "../receipts";
import { DetailHeader } from "@/components/detail-header";
import { NoAccessState } from "@/components/no-access-state";
import { NotFoundState } from "@/components/not-found-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCount, formatDate, formatDay } from "@/lib/format";
import { isUuid } from "@/lib/inventory";
import { readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Receipt",
};

export default function ReceiptPage({ params }: PageProps<"/goods-received/[id]">) {
  return (
    <>
      <BackLink />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Receipt params={params} />
      </Suspense>
    </>
  );
}

async function Receipt({ params }: Pick<PageProps<"/goods-received/[id]">, "params">) {
  await connection();
  const member = await readActiveMember();
  if (!member) return <NoAccessState reason="no-organization" />;
  if (!member.permissions.has("stock.read")) return <NoAccessState reason="no-permission" />;

  const { id } = await params;
  const receipt = isUuid(id)
    ? await getPrisma().stockReceipt.findFirst({
        where: { id, organizationId: member.organization.id },
        select: {
          supplierName: true,
          reference: true,
          note: true,
          receivedOn: true,
          createdAt: true,
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
      })
    : null;
  if (!receipt) return <NotFoundState />;

  const { lines, units, value } = receiptLines(receipt.stockMovements);
  const canReverse = member.permissions.has("stock.adjust");
  const details: [string, string][] = [
    ["Received on", formatDay(receipt.receivedOn)],
    ["Warehouse", receipt.warehouse.name],
    ["Delivery note / invoice", receipt.reference ?? "—"],
    ["Recorded by", receipt.receivedBy?.name || receipt.receivedBy?.email || "—"],
    ["Recorded on", formatDate(receipt.createdAt)],
  ];

  return (
    <>
      <DetailHeader
        title={receipt.supplierName ? `Receipt from ${receipt.supplierName}` : "Receipt"}
        description={
          <>
            {formatCount(units)} {units === 1 ? "unit" : "units"} of {lines.length}{" "}
            {lines.length === 1 ? "product" : "products"} into {receipt.warehouse.name}
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([label, text]) => (
              <div key={label} className="grid gap-1">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{text}</dd>
              </div>
            ))}
            {receipt.note ? (
              <div className="grid gap-1 sm:col-span-2 lg:col-span-3">
                <dt className="text-muted-foreground">Note</dt>
                <dd className="whitespace-pre-line">{receipt.note}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Products received</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">Size</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Unit cost</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                {canReverse ? (
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id} className={line.reversed ? "text-muted-foreground" : undefined}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{line.product.name}</span>
                      {line.reversed ? <Badge variant="outline">Reversed</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{line.product.code}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{line.product.size ?? "—"}</TableCell>
                  <TableCell className={`text-right tabular-nums ${line.reversed ? "line-through" : ""}`}>
                    {formatCount(line.quantity)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {line.unitCost === null ? "—" : formatCount(line.unitCost)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${line.reversed ? "line-through" : ""}`}>
                    {line.unitCost === null ? "—" : formatCount(line.quantity * line.unitCost)}
                  </TableCell>
                  {canReverse ? (
                    <TableCell>
                      {line.reversed ? null : (
                        <MovementMenu
                          movementId={line.id}
                          summary={`the receipt of ${formatCount(line.quantity)} ${line.product.name}`}
                        />
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-medium tabular-nums">{formatCount(units)}</TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-medium tabular-nums">
                  {value === null ? "—" : formatCount(value)}
                </TableCell>
                {canReverse ? <TableCell /> : null}
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
