import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleAlert, Minus } from "lucide-react";

import { SupplyChart } from "./supply-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import {
  readFieldStock,
  readSalespeopleSupply,
  readStoreStock,
  readStuckTransfers,
  readSupply,
  TREND_WEEKS,
  WINDOW_DAYS,
  windowStart,
} from "@/lib/dashboard";
import { dealerName } from "@/lib/dealers";
import { heldStock, readOwnSalesperson } from "@/lib/deliveries";
import { formatCompact, formatCount, formatDay, formatMoney } from "@/lib/format";
import { readActiveMember, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { TRANSFER_STATUS_LABELS, transferNumber } from "@/lib/transfers";

export const metadata: Metadata = {
  title: "Dashboard",
};

// A product is running low when it lasts fewer days than this at its recent pace.
const LOW_DAYS = 14;
const URGENT_DAYS = 7;

export default function DashboardPage() {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <Suspense fallback={<Skeleton className="mt-1 h-5 w-64" />}>
          <Welcome />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Metrics />
      </Suspense>
    </>
  );
}

async function Welcome() {
  const user = await getCurrentUser();
  return (
    <p className="text-sm text-muted-foreground">
      Welcome back{user.name ? `, ${user.name}` : ""}.
      {user.organization ? ` You're in ${user.organization.name}.` : null}
    </p>
  );
}

/** What the member's role lets them see: the business, their own field work, or both. */
async function Metrics() {
  await connection();
  const member = await readActiveMember();
  if (!member) return null;
  const own = member.permissions.has("deliveries.record") ? await readOwnSalesperson(member) : null;
  const business = member.permissions.has("stock.read");

  return (
    <>
      {own ? <OwnMetrics member={member} salesperson={own} /> : null}
      {business ? <BusinessMetrics member={member} /> : null}
    </>
  );
}

async function BusinessMetrics({ member }: { member: ActiveMember }) {
  const organizationId = member.organization.id;
  const showSalespeople = member.permissions.has("salespeople.read");
  const prisma = getPrisma();
  const [store, supply, field, stuck, bySalesperson, salespeople, newDealers] = await Promise.all([
    readStoreStock(organizationId),
    readSupply(organizationId),
    readFieldStock(organizationId),
    readStuckTransfers(organizationId),
    showSalespeople ? readSalespeopleSupply(organizationId) : new Map(),
    showSalespeople
      ? prisma.salesperson.findMany({
          where: { organizationId, deactivatedAt: null },
          select: { id: true, name: true },
        })
      : [],
    prisma.superDealer.count({
      where: { organizationId, createdAt: { gte: windowStart() } },
    }),
  ]);
  const held = showSalespeople ? await heldStock(organizationId) : new Map<string, Map<string, number>>();

  const low = store.products
    .filter((product) => product.daysLeft !== null && product.daysLeft < LOW_DAYS)
    .sort((a, b) => a.daysLeft! - b.daysLeft!)
    .slice(0, 6);
  const quiet = supply.quietDealerIds.slice(0, 6);
  const quietDealers = quiet.length
    ? await prisma.superDealer.findMany({
        where: { id: { in: quiet.map((dealer) => dealer.id) } },
        select: { id: true, shopName: true, contactName: true },
      })
    : [];
  const leaderboard = salespeople
    .map((salesperson) => ({
      ...salesperson,
      supplied: bySalesperson.get(salesperson.id) ?? { units: 0, value: 0, dealers: 0 },
      holding: [...(held.get(salesperson.id)?.values() ?? [])].reduce((sum, units) => sum + units, 0),
    }))
    .sort((a, b) => b.supplied.value - a.supplied.value || b.holding - a.holding);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stock value in store"
          value={formatMoney(store.value, true)}
          detail={`${formatCompact(store.units)} units · ${store.outOfStock} ${store.outOfStock === 1 ? "product" : "products"} out of stock`}
        />
        <StatTile
          label={`Supplied to dealers, last ${WINDOW_DAYS} days`}
          value={formatMoney(supply.value, true)}
          delta={change(supply.value, supply.previousValue)}
          detail={`${formatCompact(supply.units)} units`}
        />
        <StatTile
          label="Stock with salespeople"
          value={formatMoney(field.heldValue, true)}
          detail={`${formatCompact(field.heldUnits)} units held · ${formatCompact(field.onTheWay)} on the way`}
        />
        <StatTile
          label={`Dealers supplied, last ${WINDOW_DAYS} days`}
          value={`${formatCount(supply.suppliedDealers)} of ${formatCount(supply.activeDealers)}`}
          detail={`${formatCount(newDealers)} new in the last ${WINDOW_DAYS} days`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supplied to dealers per week</CardTitle>
          <CardDescription>
            Value at today&apos;s selling prices over the last {TREND_WEEKS} weeks, from the store and
            through salespeople.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupplyChart weeks={supply.trend} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Running low</CardTitle>
            <CardDescription>
              Products that last under {LOW_DAYS} days at the last {WINDOW_DAYS} days&apos; pace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {low.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Out per day</TableHead>
                    <TableHead className="text-right">Lasts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {low.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <span className="font-medium">{product.name}</span>
                        {product.size ? <span className="text-muted-foreground"> {product.size}</span> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(product.onHand)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {product.perDay < 10 ? product.perDay.toFixed(1) : formatCount(Math.round(product.perDay))}
                      </TableCell>
                      <TableCell className="text-right">
                        <DaysLeft days={product.daysLeft!} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Every product that moved lately has at least {LOW_DAYS} days of stock.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transfers waiting</CardTitle>
            <CardDescription>
              Picked over a day ago and not dispatched, or dispatched over two days ago and not
              acknowledged.
            </CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/transfers">All transfers</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {stuck.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Waiting</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stuck.slice(0, 6).map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">{transferNumber(transfer.number)}</TableCell>
                      <TableCell>{transfer.salesperson.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {TRANSFER_STATUS_LABELS[transfer.status]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {transfer.days} {transfer.days === 1 ? "day" : "days"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No transfers are held up.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {showSalespeople ? (
          <Card>
            <CardHeader>
              <CardTitle>Salespeople, last {WINDOW_DAYS} days</CardTitle>
              <CardDescription>What each supplied to dealers, and what they still hold.</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Salesperson</TableHead>
                      <TableHead className="text-right">Supplied</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Dealers</TableHead>
                      <TableHead className="text-right">Holding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((salesperson) => (
                      <TableRow key={salesperson.id}>
                        <TableCell className="font-medium">{salesperson.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(salesperson.supplied.value, true)}
                          <div className="text-xs text-muted-foreground">
                            {formatCount(salesperson.supplied.units)} units
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {formatCount(salesperson.supplied.dealers)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(salesperson.holding)} units
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No active salespeople yet.</p>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Dealers gone quiet</CardTitle>
            <CardDescription>
              Supplied before, but nothing in the last {WINDOW_DAYS} days. Worth a visit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {quiet.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="text-right">Last supplied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quiet.map((row) => {
                    const dealer = quietDealers.find((dealer) => dealer.id === row.id);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/super-dealers/${row.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {dealer ? dealerName(dealer) : "Dealer"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDay(row.lastDay)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Every dealer supplied before got stock in the last {WINDOW_DAYS} days.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** For a signed-in salesperson: their own stock and work. */
async function OwnMetrics({
  member,
  salesperson,
}: {
  member: ActiveMember;
  salesperson: { id: string; name: string };
}) {
  const organizationId = member.organization.id;
  const prisma = getPrisma();
  const since = windowStart();
  const [held, toAcknowledge, delivered, products] = await Promise.all([
    heldStock(organizationId, salesperson.id),
    prisma.stockTransfer.count({
      where: { salespersonId: salesperson.id, status: { in: ["in_transit", "arrived"] }, acknowledgedAt: null },
    }),
    prisma.deliveryLine.findMany({
      where: { delivery: { salespersonId: salesperson.id, deliveredOn: { gte: since } } },
      select: { quantity: true, product: { select: { sellingPrice: true } }, delivery: { select: { superDealerId: true } } },
    }),
    prisma.product.findMany({ where: { organizationId }, select: { id: true, sellingPrice: true } }),
  ]);
  const price = new Map(products.map((product) => [product.id, product.sellingPrice]));
  const holding = [...(held.get(salesperson.id) ?? new Map<string, number>())];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stock with you"
          value={formatMoney(holding.reduce((sum, [id, units]) => sum + units * (price.get(id) ?? 0), 0), true)}
          detail={`${formatCount(holding.reduce((sum, [, units]) => sum + units, 0))} units`}
        />
        <StatTile
          label={`You supplied, last ${WINDOW_DAYS} days`}
          value={formatMoney(delivered.reduce((sum, line) => sum + line.quantity * line.product.sellingPrice, 0), true)}
          detail={`${formatCount(delivered.reduce((sum, line) => sum + line.quantity, 0))} units to ${new Set(delivered.map((line) => line.delivery.superDealerId)).size} dealers`}
        />
        <StatTile
          label="Transfers to acknowledge"
          value={formatCount(toAcknowledge)}
          detail={toAcknowledge ? "Acknowledge them under Deliveries once you have the stock." : "Nothing waiting for you."}
        />
      </div>
      <div>
        <Button asChild variant="outline">
          <Link href="/deliveries">Go to deliveries</Link>
        </Button>
      </div>
    </>
  );
}

/** Percentage change, or null when there's nothing to compare with. */
function change(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** A headline number: label, value, optional change and a detail line. */
function StatTile({
  label,
  value,
  delta,
  detail,
}: {
  label: string;
  value: string;
  /** Percent change vs the 30 days before; up is good. */
  delta?: number | null;
  detail?: string;
}) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold">{value}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1 text-sm">
        {delta !== undefined && delta !== null ? <Trend delta={delta} /> : null}
        {detail ? <div className="text-muted-foreground">{detail}</div> : null}
      </CardContent>
    </Card>
  );
}

const TRENDS = {
  up: { className: "text-emerald-700 dark:text-emerald-400", Icon: ArrowUpRight },
  down: { className: "text-destructive", Icon: ArrowDownRight },
  flat: { className: "text-muted-foreground", Icon: Minus },
};

/** "+12% vs the 30 days before", with an arrow and colour for the direction. */
function Trend({ delta }: { delta: number }) {
  let trend = TRENDS.flat;
  if (delta > 0) trend = TRENDS.up;
  else if (delta < 0) trend = TRENDS.down;
  return (
    <div className={`flex items-center gap-1 ${trend.className}`}>
      <trend.Icon className="size-4" />
      <span>
        {delta > 0 ? "+" : ""}
        {delta}% vs the {WINDOW_DAYS} days before
      </span>
    </div>
  );
}

/** Days of stock left, flagged with an icon and words as well as colour. */
function DaysLeft({ days }: { days: number }) {
  const whole = Math.floor(days);
  const unit = whole === 1 ? "day" : "days";
  const shown = days < 1 ? "Under a day" : `${whole} ${unit}`;
  if (days < URGENT_DAYS) {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <CircleAlert className="size-4" />
        {days <= 0 ? "Out of stock" : shown}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-4" />
      {shown}
    </span>
  );
}
