"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompact, formatCount, formatMoney } from "@/lib/format";

// One series, so one hue; the steps were checked against the card surface in
// each theme (light L 0.52, dark L 0.66).
const config = {
  value: {
    label: "Supplied",
    theme: { light: "oklch(0.52 0.15 315)", dark: "oklch(0.66 0.15 315)" },
  },
} satisfies ChartConfig;

const weekLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const label = (week: string) => weekLabel.format(new Date(`${week}T00:00:00Z`));

/** Value supplied to dealers per week, with a table of the same numbers. */
export function SupplyChart({ weeks }: { weeks: { week: string; units: number; value: number }[] }) {
  // The last week is still running, so it is named as such rather than read as a drop.
  const current = weeks.at(-1)?.week;
  const name = (week: string) => (week === current ? "This week" : label(week));

  return (
    <div className="grid gap-3">
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <BarChart data={weeks} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="week"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
            tickFormatter={name}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => formatCompact(value)}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.4 }}
            content={
              <ChartTooltipContent
                // One series: the title names it, so no colour key is needed.
                hideIndicator
                labelFormatter={(_, payload) => {
                  const week = String(payload?.[0]?.payload.week);
                  return week === current ? "This week so far" : `Week of ${label(week)}`;
                }}
                formatter={(value, _name, item) => (
                  <div className="grid gap-0.5">
                    <span className="font-medium text-foreground tabular-nums">
                      {formatMoney(Number(value))}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatCount(item.payload.units)} units
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ChartContainer>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Week of</th>
              <th className="py-1 text-right font-normal">Units</th>
              <th className="py-1 text-right font-normal">Value</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {weeks.map((week) => (
              <tr key={week.week} className="border-t">
                <td className="py-1">{name(week.week)}</td>
                <td className="py-1 text-right">{formatCount(week.units)}</td>
                <td className="py-1 text-right">{formatMoney(week.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
