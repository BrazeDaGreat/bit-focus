"use client";

/**
 * Trend Chart
 *
 * The 30-day bar chart on the dashboard. Recharts is the largest dependency on
 * the home page, so the chart lives in its own module and is loaded on demand
 * behind a placeholder of the same height (see `TrendPanel`).
 */

import { type JSX } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface TrendDatum {
  date: string;
  hours: number;
}

export default function TrendChart({ data }: { data: TrendDatum[] }): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
      >
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          interval={6}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={44}
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
          formatter={(v: number) => [`${v}h`, "Focus"]}
        />
        <Bar
          dataKey="hours"
          fill="var(--chart-1)"
          radius={[3, 3, 0, 0]}
          maxBarSize={14}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
