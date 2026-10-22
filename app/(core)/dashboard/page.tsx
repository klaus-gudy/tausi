import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CircleAlert,
  LayoutDashboard,
  Minus,
  PackagePlus,
  Store,
  Truck,
  UserPlus,
} from "lucide-react";

import { SupplyChart } from "./supply-chart";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  readStoreActivity,
  readStoreStock,
  readStuckTransfers,
  readSupply,
  TREND_WEEKS,
  WINDOW_DAYS,
  windowStart,
} from "@/lib/dashboard";
import { dealerName } from "@/lib/dealers";
import { deliveryNumber, heldStock, readOwnSalesperson } from "@/lib/deliveries";
import { formatCompact, formatCount, formatDay, formatMoney } from "@/lib/format";
import { readActiveMember, type ActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";
import { TRANSFER_STATUS_LABELS, transferNumber } from "@/lib/transfers";

export const metadata: Metadata = {
  title: "Dashboard",
};

type StoreStock = Awaited<ReturnType<typeof readStoreStock>>;
type StuckTransfers = Awaited<ReturnType<typeof readStuckTransfers>>;

// A product is running low when it lasts fewer days than this at its recent pace.
const LOW_DAYS = 14;
const URGENT_DAYS = 7;

export default function DashboardPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
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
  await connection();
  const [user, member] = await Promise.all([getCurrentUser(), readActiveMember()]);
  return (
    <p className="text-muted-foreground">
      Welcome back{user.name ? `, ${user.name}` : ""}.
      {member
        ? ` You're in ${member.organization.name} as ${article(member.role.name)} ${member.role.name}.`
        : user.organization
          ? ` You're in ${user.organization.name}.`
          : null}
    </p>
  );
}

/**
 * Each role gets the dashboard its permissions call for, so custom roles work
 * too: a salesperson sees their own stock and deliveries, a storekeeper the
 * store and what it sends out, and those who can see deliveries the whole
 * business, supply to dealers included.
 */
async function Metrics() {
  await connection();
  const member = await readActiveMember();
  if (!member) return null;
  const { permissions } = member;
  const own = permissions.has("deliveries.record") ? await readOwnSalesperson(member) : null;
  const business = permissions.has("stock.read") && permissions.has("deliveries.read");
  const store = permissions.has("stock.read") && !business;

  return (
    <>
      <QuickActions member={member} recordsDeliveries={!!own} />
      {own ? <OwnMetrics member={member} salesperson={own} /> : null}
      {business ? <BusinessMetrics member={member} /> : null}
      {store ? <StoreMetrics member={member} /> : null}
      {!own && !business && !store ? (
        <NothingToShow unlinked={permissions.has("deliveries.record")} />
      ) : null}
    </>
  );
}

/** Shortcuts to the work the role does most. */
function QuickActions({ member, recordsDeliveries }: { member: ActiveMember; recordsDeliveries: boolean }) {
  const { permissions } = member;
  const actions = [
    recordsDeliveries && { label: "Record a delivery", href: "/deliveries", icon: Truck },
    permissions.has("stock.receive") && { label: "Receive stock", href: "/stock", icon: PackagePlus },
    permissions.has("stock.transfer") && { label: "Send stock to a salesperson", href: "/transfers", icon: ArrowLeftRight },
    permissions.has("dealers.onboard") && { label: "Onboard a dealer", href: "/super-dealers/onboard", icon: Store },
    permissions.has("members.invite") && { label: "Invite a member", href: "/members", icon: UserPlus },
  ].filter((action) => !!action);
  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={action.label} asChild variant="outline" size="sm">
          <Link href={action.href}>
            <action.icon />
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

/** For a role with nothing to chart, or a salesperson not yet linked to a login. */
function NothingToShow({ unlinked }: { unlinked: boolean }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LayoutDashboard />
        </EmptyMedia>
        <EmptyTitle>Nothing to show here yet</EmptyTitle>
        <EmptyDescription>
          {unlinked
            ? "Your sign-in isn't linked to a salesperson yet. Ask an owner or admin to link it under Salespeople, and your stock and deliveries will show here."
            : "Your role doesn't include stock or deliveries. Use the menu to get to the pages you can see."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** The whole business: store, field stock and supply to dealers. */
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
        <RunningLowCard products={store.products} />
        <StuckTransfersCard transfers={stuck} />
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

/** For a storekeeper: the store, what came in and what went out to salespeople. */
async function StoreMetrics({ member }: { member: ActiveMember }) {
  const organizationId = member.organization.id;
  const showSalespeople = member.permissions.has("salespeople.read");
  const prisma = getPrisma();
  const [store, activity, field, stuck, held, salespeople, products] = await Promise.all([
    readStoreStock(organizationId),
    readStoreActivity(organizationId),
    readFieldStock(organizationId),
    readStuckTransfers(organizationId),
    showSalespeople ? heldStock(organizationId) : new Map<string, Map<string, number>>(),
    showSalespeople
      ? prisma.salesperson.findMany({
          where: { organizationId, deactivatedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [],
    prisma.product.findMany({ where: { organizationId }, select: { id: true, sellingPrice: true } }),
  ]);
  const price = new Map(products.map((product) => [product.id, product.sellingPrice]));
  const holdings = salespeople
    .map((salesperson) => {
      const holding = [...(held.get(salesperson.id)?.entries() ?? [])];
      return {
        ...salesperson,
        units: holding.reduce((sum, [, units]) => sum + units, 0),
        value: holding.reduce((sum, [id, units]) => sum + units * (price.get(id) ?? 0), 0),
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stock value in store"
          value={formatMoney(store.value, true)}
          detail={`${formatCompact(store.units)} units · ${store.outOfStock} ${store.outOfStock === 1 ? "product" : "products"} out of stock`}
        />
        <StatTile
          label={`Received, last ${WINDOW_DAYS} days`}
          value={formatMoney(activity.receivedValue, true)}
          detail={`${formatCompact(activity.receivedUnits)} units in from suppliers`}
        />
        <StatTile
          label={`Sent to salespeople, last ${WINDOW_DAYS} days`}
          value={formatMoney(activity.sentValue, true)}
          detail={`${formatCompact(activity.sentUnits)} units`}
        />
        <StatTile
          label="Stock with salespeople"
          value={formatMoney(field.heldValue, true)}
          detail={`${formatCompact(field.heldUnits)} units held · ${formatCompact(field.onTheWay)} on the way`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RunningLowCard products={store.products} />
        <StuckTransfersCard transfers={stuck} />
      </div>

      {showSalespeople ? (
        <Card>
          <CardHeader>
            <CardTitle>Stock with each salesperson</CardTitle>
            <CardDescription>What they acknowledged and haven&apos;t supplied to dealers yet.</CardDescription>
          </CardHeader>
          <CardContent>
            {holdings.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salesperson</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((salesperson) => (
                    <TableRow key={salesperson.id}>
                      <TableCell className="font-medium">{salesperson.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(salesperson.units)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(salesperson.value, true)}</TableCell>
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
  const [held, toAcknowledge, delivered, products, recent] = await Promise.all([
    heldStock(organizationId, salesperson.id),
    prisma.stockTransfer.count({
      where: { salespersonId: salesperson.id, status: { in: ["in_transit", "arrived"] }, acknowledgedAt: null },
    }),
    prisma.deliveryLine.findMany({
      where: { delivery: { salespersonId: salesperson.id, deliveredOn: { gte: since } } },
      select: { quantity: true, product: { select: { sellingPrice: true } }, delivery: { select: { superDealerId: true } } },
    }),
    prisma.product.findMany({
      where: { organizationId },
      select: { id: true, name: true, size: true, sellingPrice: true },
    }),
    prisma.delivery.findMany({
      where: { salespersonId: salesperson.id },
      orderBy: [{ deliveredOn: "desc" }, { number: "desc" }],
      take: 6,
      select: {
        id: true,
        number: true,
        deliveredOn: true,
        superDealer: { select: { shopName: true, contactName: true } },
        lines: { select: { quantity: true } },
      },
    }),
  ]);
  const product = new Map(products.map((product) => [product.id, product]));
  const holding = [...(held.get(salesperson.id) ?? new Map<string, number>())]
    .filter(([, units]) => units > 0)
    .map(([id, units]) => ({ id, units, product: product.get(id) }))
    .sort((a, b) => b.units - a.units);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stock with you"
          value={formatMoney(holding.reduce((sum, row) => sum + row.units * (row.product?.sellingPrice ?? 0), 0), true)}
          detail={`${formatCount(holding.reduce((sum, row) => sum + row.units, 0))} units`}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your stock</CardTitle>
            <CardDescription>What you hold to supply to dealers.</CardDescription>
          </CardHeader>
          <CardContent>
            {holding.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holding.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="font-medium">{row.product?.name ?? "Product"}</span>
                        {row.product?.size ? <span className="text-muted-foreground"> {row.product.size}</span> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(row.units)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                You hold no stock. It shows here once you acknowledge a transfer.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your recent deliveries</CardTitle>
            <CardDescription>The last dealers you supplied.</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/deliveries">All deliveries</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recent.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Units</TableHead>
                    <TableHead className="text-right">Day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">{deliveryNumber(delivery.number)}</TableCell>
                      <TableCell>{dealerName(delivery.superDealer)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {formatCount(delivery.lines.reduce((sum, line) => sum + line.quantity, 0))}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDay(delivery.deliveredOn)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">You haven&apos;t recorded a delivery yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Products that won't last long at their recent pace, soonest out first. */
function RunningLowCard({ products }: { products: StoreStock["products"] }) {
  const low = products
    .filter((product) => product.daysLeft !== null && product.daysLeft < LOW_DAYS)
    .sort((a, b) => a.daysLeft! - b.daysLeft!)
    .slice(0, 6);

  return (
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
  );
}

/** Transfers held up at a step, longest waiting first. */
function StuckTransfersCard({ transfers: stuck }: { transfers: StuckTransfers }) {
  return (
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
  );
}

/** "a" or "an" before a role name. */
function article(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
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
        {delta !== undefined && delta !== null ? (
          <div
            className={`flex items-center gap-1 ${delta > 0 ? "text-emerald-700 dark:text-emerald-400" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}
          >
            {delta > 0 ? <ArrowUpRight className="size-4" /> : delta < 0 ? <ArrowDownRight className="size-4" /> : <Minus className="size-4" />}
            <span>
              {delta > 0 ? "+" : ""}
              {delta}% vs the {WINDOW_DAYS} days before
            </span>
          </div>
        ) : null}
        {detail ? <div className="text-muted-foreground">{detail}</div> : null}
      </CardContent>
    </Card>
  );
}

/** Days of stock left, flagged with an icon and words as well as colour. */
function DaysLeft({ days }: { days: number }) {
  const shown = days < 1 ? "Under a day" : `${Math.floor(days)} ${Math.floor(days) === 1 ? "day" : "days"}`;
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
