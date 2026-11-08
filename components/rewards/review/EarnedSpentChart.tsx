"use client";

/**
 * Earned vs Spent Chart
 *
 * Weekly bars of gems earned from focus and spent in the shop. Kept in its own
 * module so Recharts loads on demand (see `RewardsReview`), like the
 * dashboard's `TrendChart`.
 */

import { type JSX } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatGems } from "@/lib/rewards";

export interface WeekDatum {
  week: string;
  /** Hundredths of a gem. */
  earned: number;
  /** Hundredths of a gem, positive. */
  spent: number;
}

export default function EarnedSpentChart({ data }: { data: WeekDatum[] }): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={2}>
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={false}
          tickFormatter={(v: number) => formatGems(v)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          contentStyle={{
            fontSize: 12,
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
          labelStyle={{ color: "var(--muted-foreground)" }}
          labelFormatter={(label: string) => `Week of ${label}`}
          formatter={(v: number, name: string) => [`${formatGems(v)} gems`, name === "earned" ? "Earned" : "Spent"]}
        />
        <Bar dataKey="earned" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={14} />
        <Bar dataKey="spent" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}
