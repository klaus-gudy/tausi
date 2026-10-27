import { Prisma } from "@/lib/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { SALESPERSON_PERSON } from "@/lib/salespeople"

// The dashboard's numbers. Values are units times the product's current
// selling price, so they show what the stock is worth at today's prices, not
// what it sold for. Days run on Tanzania time.

const TODAY = Prisma.sql`(now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date`

/** How many days back the "last 30 days" figures look. */
export const WINDOW_DAYS = 30
/** Weeks in the supply trend. */
export const TREND_WEEKS = 12

/**
 * Every unit that reached a dealer, one row per line: straight from the store
 * (the dealer side of issues, less their reversals) or through a salesperson
 * (deliveries).
 */
function supplyRows(organizationId: string) {
  return Prisma.sql`
    SELECT m.occurred_on AS day, m.super_dealer_id AS dealer_id, NULL::uuid AS salesperson_id,
           m.quantity AS units, m.quantity::bigint * p.selling_price AS value
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    WHERE m.organization_id = ${organizationId}::uuid AND m.holder = 'super_dealer'
    UNION ALL
    SELECT d.delivered_on, d.super_dealer_id, d.salesperson_id,
           l.quantity, l.quantity::bigint * p.selling_price
    FROM deliveries d
    JOIN delivery_lines l ON l.delivery_id = d.id
    JOIN products p ON p.id = l.product_id
    WHERE d.organization_id = ${organizationId}::uuid`
}

/** Stock in the store: what it's worth, and each product's units and cover. */
export async function readStoreStock(organizationId: string) {
  const products = await getPrisma().$queryRaw<
    { id: string; name: string; size: string | null; price: number; on_hand: bigint; out_30: bigint }[]
  >`
    WITH outflow AS (
      -- Units that left the store in the window: issues and transfers, less
      -- any reversed since.
      SELECT m.product_id, -SUM(m.quantity) AS units
      FROM stock_movements m
      LEFT JOIN stock_movements original ON original.id = m.reverses_id
      WHERE m.organization_id = ${organizationId}::uuid AND m.holder = 'warehouse'
        AND m.occurred_on > ${TODAY} - ${WINDOW_DAYS}::int
        AND (m.type IN ('issued', 'transferred')
             OR (m.type = 'reversal' AND original.type IN ('issued', 'transferred')))
      GROUP BY m.product_id
    )
    SELECT p.id, p.name, p.size, p.selling_price AS price,
           COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = p.id AND holder = 'warehouse'), 0) AS on_hand,
           COALESCE(o.units, 0) AS out_30
    FROM products p
    LEFT JOIN outflow o ON o.product_id = p.id
    WHERE p.organization_id = ${organizationId}::uuid AND p.archived_at IS NULL`

  const rows = products.map((row) => {
    const onHand = Number(row.on_hand)
    const perDay = Number(row.out_30) / WINDOW_DAYS
    return {
      id: row.id,
      name: row.name,
      size: row.size,
      onHand,
      value: Math.max(onHand, 0) * row.price,
      perDay,
      // Days the stock lasts at the last 30 days' pace; null when nothing moved.
      daysLeft: perDay > 0 ? Math.max(onHand, 0) / perDay : null,
    }
  })
  return {
    value: rows.reduce((sum, row) => sum + row.value, 0),
    units: rows.reduce((sum, row) => sum + Math.max(row.onHand, 0), 0),
    outOfStock: rows.filter((row) => row.onHand <= 0).length,
    products: rows,
  }
}

/** Supply to dealers: the last 30 days against the 30 before, and per week. */
export async function readSupply(organizationId: string) {
  const prisma = getPrisma()
  const [windows, weeks, dealers] = await Promise.all([
    prisma.$queryRaw<{ current_units: bigint; current_value: bigint; previous_value: bigint }[]>`
      WITH supply AS (${supplyRows(organizationId)})
      SELECT COALESCE(SUM(units) FILTER (WHERE day > ${TODAY} - ${WINDOW_DAYS}::int), 0) AS current_units,
             COALESCE(SUM(value) FILTER (WHERE day > ${TODAY} - ${WINDOW_DAYS}::int), 0) AS current_value,
             COALESCE(SUM(value) FILTER (
               WHERE day > ${TODAY} - ${2 * WINDOW_DAYS}::int AND day <= ${TODAY} - ${WINDOW_DAYS}::int
             ), 0) AS previous_value
      FROM supply`,
    prisma.$queryRaw<{ week: Date; units: bigint; value: bigint }[]>`
      WITH supply AS (${supplyRows(organizationId)})
      SELECT date_trunc('week', day)::date AS week, SUM(units) AS units, SUM(value) AS value
      FROM supply
      WHERE day >= date_trunc('week', ${TODAY})::date - ${7 * (TREND_WEEKS - 1)}::int
      GROUP BY 1`,
    // Each active dealer's last supply, and whether they got any this window.
    prisma.$queryRaw<{ id: string; last_day: Date | null; supplied_now: boolean }[]>`
      WITH supply AS (${supplyRows(organizationId)}),
      per_dealer AS (
        SELECT dealer_id, MAX(day) FILTER (WHERE units > 0) AS last_day,
               SUM(units) FILTER (WHERE day > ${TODAY} - ${WINDOW_DAYS}::int) > 0 AS supplied_now
        FROM supply GROUP BY dealer_id
      )
      SELECT s.id, pd.last_day, COALESCE(pd.supplied_now, false) AS supplied_now
      FROM super_dealers s
      LEFT JOIN per_dealer pd ON pd.dealer_id = s.id
      WHERE s.organization_id = ${organizationId}::uuid AND s.deactivated_at IS NULL`,
  ])

  // Every week in the trend, oldest first, with empty weeks as 0.
  const byWeek = new Map(weeks.map((row) => [row.week.toISOString().slice(0, 10), row]))
  const thisWeek = weekStart(tanzaniaToday())
  const trend = Array.from({ length: TREND_WEEKS }, (_, index) => {
    const start = new Date(thisWeek)
    start.setUTCDate(start.getUTCDate() - 7 * (TREND_WEEKS - 1 - index))
    const row = byWeek.get(start.toISOString().slice(0, 10))
    return { week: start.toISOString().slice(0, 10), units: Number(row?.units ?? 0), value: Number(row?.value ?? 0) }
  })

  const [window] = windows
  return {
    units: Number(window.current_units),
    value: Number(window.current_value),
    previousValue: Number(window.previous_value),
    trend,
    activeDealers: dealers.length,
    suppliedDealers: dealers.filter((dealer) => dealer.supplied_now).length,
    // Supplied before, but not in the window: worth a visit.
    quietDealerIds: dealers
      .filter((dealer) => dealer.last_day && !dealer.supplied_now)
      .sort((a, b) => a.last_day!.getTime() - b.last_day!.getTime())
      .map((dealer) => ({ id: dealer.id, lastDay: dealer.last_day! })),
  }
}

/** Per salesperson over the window: what they supplied, to how many dealers. */
export async function readSalespeopleSupply(organizationId: string) {
  const rows = await getPrisma().$queryRaw<
    { salesperson_id: string; units: bigint; value: bigint; dealers: bigint }[]
  >`
    WITH supply AS (${supplyRows(organizationId)})
    SELECT salesperson_id, SUM(units) AS units, SUM(value) AS value, COUNT(DISTINCT dealer_id) AS dealers
    FROM supply
    WHERE salesperson_id IS NOT NULL AND day > ${TODAY} - ${WINDOW_DAYS}::int
    GROUP BY salesperson_id`
  return new Map(
    rows.map((row) => [
      row.salesperson_id,
      { units: Number(row.units), value: Number(row.value), dealers: Number(row.dealers) },
    ])
  )
}

/**
 * Transfers that are taking too long: picked over a day ago and not
 * dispatched, or dispatched over two days ago and not acknowledged.
 */
export async function readStuckTransfers(organizationId: string) {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const transfers = await getPrisma().stockTransfer.findMany({
    where: {
      organizationId,
      OR: [
        { status: "initiated", createdAt: { lt: new Date(now - day) } },
        {
          status: { in: ["in_transit", "arrived"] },
          acknowledgedAt: null,
          dispatchedAt: { lt: new Date(now - 2 * day) },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      dispatchedAt: true,
      salesperson: { select: SALESPERSON_PERSON },
    },
  })
  return transfers.map((transfer) => ({
    ...transfer,
    // Days since the step it's waiting on began.
    days: Math.floor((now - (transfer.dispatchedAt ?? transfer.createdAt).getTime()) / day),
  }))
}

/** Today's date in Tanzania, as UTC midnight like a @db.Date. */
function tanzaniaToday() {
  const local = new Date(Date.now() + 3 * 60 * 60 * 1000)
  return new Date(`${local.toISOString().slice(0, 10)}T00:00:00Z`)
}

/** The Monday on or before `day`, matching Postgres date_trunc('week'). */
function weekStart(day: Date) {
  const start = new Date(day)
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  return start
}

/**
 * Stock out in the field: what salespeople hold (acknowledged, not yet
 * supplied), and what has left the store for them but isn't acknowledged.
 */
export async function readFieldStock(organizationId: string) {
  const [row] = await getPrisma().$queryRaw<
    { held_units: bigint; held_value: bigint; on_the_way: bigint }[]
  >`
    WITH held AS (
      SELECT m.product_id, -m.quantity AS units
      FROM stock_transfers t
      JOIN stock_movements m ON m.transfer_id = t.id AND m.type = 'transferred'
      WHERE t.organization_id = ${organizationId}::uuid AND t.acknowledged_at IS NOT NULL
      UNION ALL
      SELECT l.product_id, -l.quantity
      FROM deliveries d
      JOIN delivery_lines l ON l.delivery_id = d.id
      WHERE d.organization_id = ${organizationId}::uuid
    )
    SELECT
      (SELECT COALESCE(SUM(units), 0) FROM held) AS held_units,
      (SELECT COALESCE(SUM(h.units::bigint * p.selling_price), 0)
         FROM held h JOIN products p ON p.id = h.product_id) AS held_value,
      (SELECT COALESCE(-SUM(m.quantity), 0)
         FROM stock_transfers t
         JOIN stock_movements m ON m.transfer_id = t.id AND m.type = 'transferred'
         WHERE t.organization_id = ${organizationId}::uuid
           AND t.status IN ('in_transit', 'arrived') AND t.acknowledged_at IS NULL) AS on_the_way`
  return {
    heldUnits: Number(row.held_units),
    heldValue: Number(row.held_value),
    onTheWay: Number(row.on_the_way),
  }
}

/** The first day in the "last 30 days" window, as UTC midnight like a @db.Date. */
export function windowStart() {
  const start = tanzaniaToday()
  start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1))
  return start
}
