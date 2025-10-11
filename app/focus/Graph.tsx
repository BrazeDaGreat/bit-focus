/**
 * Graph Component - Interactive Focus Session Data Visualization
 *
 * This component provides comprehensive data visualization for focus sessions using
 * interactive bar charts and data tables. It supports multiple time views (daily,
 * weekly, monthly, and 30-day periods) and displays focus time broken down by tags.
 *
 * Features:
 * - Interactive bar charts with hover tooltips
 * - Multiple time period views (7 days, 30 days, 6 months)
 * - Navigation controls for historical data viewing
 * - Data table with sorted focus time by tags
 * - Color-coded visualization using saved tag colors
 * - Responsive design with scrollable content
 *
 * Dependencies:
 * - Recharts for chart visualization
 * - Day.js for date manipulation and formatting
 * - Custom UI components for dialogs and controls
 *
 * @fileoverview Focus session data visualization and analytics component
 * @author BIT Focus Development Team
 * @since v0.2.0-alpha
 */

import React, { type JSX, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { FocusSession, useFocus } from "@/hooks/useFocus";
import { formatTime, getTagColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FaChartBar } from "react-icons/fa6";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useTag } from "@/hooks/useTag";

// Extend dayjs with ISO week plugin for week-based calculations
dayjs.extend(isoWeek);

/**
 * Interface for processed chart data
 * Represents a single data point in the chart with date and tag-based focus times
 */
interface ProcessedData {
  /** Date string in the format determined by the time unit */
  date: string;
  /** Total focus time for this date in minutes */
  total: number;
  /** Dynamic properties for each tag with focus time in minutes */
  [key: string]: number | string;
}

/**
 * Generates an array of date strings for the last N time units
 *
 * Creates a sequential array of date strings going backwards from the current date,
 * offset by the specified number of periods. Useful for creating consistent
 * date ranges for chart data processing.
 *
 * @param {number} n - Number of time units to generate
 * @param {"day" | "week" | "month"} unit - Time unit type
 * @param {number} offset - Number of periods to offset from current date
 * @returns {string[]} Array of formatted date strings
 *
 * @example
 * ```typescript
 * // Generate last 7 days starting from today
 * const dates = generateLastNUnits(7, "day", 0);
 * // Returns: ["2024-01-08", "2024-01-09", ..., "2024-01-14"]
 *
 * // Generate 4 weeks starting from 2 weeks ago
 * const weeks = generateLastNUnits(4, "week", 2);
 * // Returns: ["2024-W01", "2024-W02", "2024-W03", "2024-W04"]
 * ```
 */
const generateLastNUnits = (
  n: number,
  unit: "day" | "week" | "month",
  offset: number
): string[] => {
  return Array.from({ length: n }, (_, i) =>
    dayjs()
      .subtract(i + offset, unit)
      .format(
        unit === "week"
          ? "YYYY-[W]WW"
          : unit === "month"
          ? "YYYY-MM"
          : "YYYY-MM-DD"
      )
  ).reverse();
};

/**
 * Processes focus session data into chart-ready format
 *
 * Transforms raw focus session data into a structured format suitable for
 * chart visualization. Groups sessions by date and calculates duration
 * for each tag, ensuring all dates in the range are represented even
 * if they have no focus sessions.
 *
 * @param {FocusSession[]} data - Array of focus sessions to process
 * @param {string[]} dateRange - Array of date strings defining the chart range
 * @param {"day" | "week" | "month"} unit - Time unit for date grouping
 * @returns {ProcessedData[]} Array of processed data objects for chart rendering
 *
 * @example
 * ```typescript
 * const sessions = [
 *   { tag: "Work", startTime: new Date("2024-01-15T09:00:00"), endTime: new Date("2024-01-15T10:30:00") },
 *   { tag: "Study", startTime: new Date("2024-01-15T14:00:00"), endTime: new Date("2024-01-15T15:00:00") }
 * ];
 * const dates = ["2024-01-15", "2024-01-16"];
 * const processed = processData(sessions, dates, "day");
 * // Returns: [
 * //   { date: "2024-01-15", total: 150, Work: 90, Study: 60 },
 * //   { date: "2024-01-16", total: 0 }
 * // ]
 * ```
 */
const processData = (
  data: FocusSession[],
  dateRange: string[],
  unit: "day" | "week" | "month"
): ProcessedData[] => {
  const groupedData: { [date: string]: ProcessedData } = {};

  // Initialize all dates in range with zero values
  dateRange.forEach((date) => {
    groupedData[date] = { date, total: 0 };
  });

  // Process each focus session
  data.forEach(({ tag, startTime, endTime }) => {
    const date =
      unit === "week"
        ? dayjs(startTime).format("YYYY-[W]WW")
        : dayjs(startTime).format(unit === "month" ? "YYYY-MM" : "YYYY-MM-DD");

    if (!groupedData[date]) return;

    // Calculate duration in minutes with precision
    const duration =
      Math.round(((endTime.getTime() - startTime.getTime()) / 60000) * 100) /
      100;

    // Add duration to tag-specific and total counters
    groupedData[date][tag] =
      ((groupedData[date][tag] as number) || 0) + duration;
    groupedData[date].total += duration;
  });

  console.log(groupedData);
  return Object.values(groupedData);
};

/**
 * Generates an array of month strings for a yearly view
 *
 * Creates a 12-month range starting from January of the target year,
 * accounting for year offset for historical data navigation.
 *
 * @param {number} offset - Number of years to offset from current year
 * @returns {string[]} Array of formatted month strings (YYYY-MM format)
 *
 * @example
 * ```typescript
 * // Generate months for current year
 * const months = generateYearlyMonths(0);
 * // Returns: ["2025-01", "2025-02", ..., "2025-12"]
 *
 * // Generate months for last year
 * const lastYear = generateYearlyMonths(1);
 * // Returns: ["2024-01", "2024-02", ..., "2024-12"]
 * ```
 */
const generateYearlyMonths = (offset: number): string[] => {
  const targetYear = dayjs().year() - offset;
  return Array.from({ length: 12 }, (_, i) =>
    dayjs().year(targetYear).month(i).format("YYYY-MM")
  );
};

/**
 * Main Graph Component
 *
 * Renders an interactive bar chart displaying focus session data over time.
 * Provides controls for changing time periods, navigating through historical data,
 * and viewing detailed focus time breakdowns. Includes both visual chart and
 * tabular data representations.
 *
 * The component manages its own state for view type (day/week/month) and time offset
 * for historical navigation. It automatically processes focus session data and
 * applies appropriate color coding based on saved tag preferences.
 *
 * @component
 * @returns {JSX.Element} Interactive graph component with controls and data table
 *
 * @example
 * ```tsx
 * // Used within a dialog or modal
 * <Graph />
 * ```
 *
 * @see {@link ProcessedData} for the data structure used in charts
 * @see {@link FocusSession} for raw session data structure
 */
const Graph: React.FC = (): JSX.Element => {
  const { focusSessions } = useFocus();
  const { savedTags } = useTag();
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<
    "day" | "week" | "month" | "30days" | "yearly"
  >("day");

  // Determine number of units to show and unit type for generateLastNUnits
  const unitToShow =
    view === "day"
      ? 7
      : view === "30days"
      ? 30
      : view === "week"
      ? 4
      : view === "yearly"
      ? 12
      : 6;

  // For 30days view, unit is 'day'; otherwise use the view directly
  const unitForGenerate =
    view === "30days" ? "day" : view === "yearly" ? "month" : view;

  // Generate date range and process data
  const dateRange =
    view === "yearly"
      ? generateYearlyMonths(offset)
      : generateLastNUnits(unitToShow, unitForGenerate, offset);
  const processedData = processData(focusSessions, dateRange, unitForGenerate);

  // Extract and sort tags by total focus time
  const rawTags = Array.from(
    new Set(
      processedData.flatMap((entry) =>
        Object.entries(entry)
          .filter(
            ([key, value]) =>
              key !== "date" && key !== "total" && Number(value) > 0
          )
          .map(([key]) => key)
      )
    )
  );

  // Calculate totals for each tag for sorting
  const tagTotals: Record<string, number> = {};
  for (const entry of processedData) {
    for (const tag of rawTags) {
      tagTotals[tag] = (tagTotals[tag] || 0) + ((entry[tag] as number) || 0);
    }
  }
  const tags = rawTags.sort((a, b) => tagTotals[b] - tagTotals[a]);

  return (
    <div>
      {/* Navigation Controls */}
      <div className="flex justify-between mb-4">
        <Button
          variant={"secondary"}
          onClick={() =>
            setOffset(offset + (view === "yearly" ? 1 : unitToShow))
          }
        >
          <FaArrowLeft />
        </Button>
        <Button
          variant={"secondary"}
          onClick={() =>
            setOffset(
              Math.max(0, offset - (view === "yearly" ? 1 : unitToShow))
            )
          }
        >
          <FaArrowRight />
        </Button>
      </div>

      {/* Interactive Bar Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={processedData} stackOffset="sign">
          <CartesianGrid strokeDasharray="5" stroke="#bbb" x={48} />
          <XAxis
            dataKey="date"
            stroke="#8884d8"
            tickFormatter={(date) => {
              // Format X axis ticks differently based on view
              if (view === "week") return dayjs(date).format("[W]WW, YYYY");
              if (view === "month") return dayjs(date).format("MMM YYYY");
              if (view === "yearly") return dayjs(date).format("MMM");
              return dayjs(date).format("DD MMM");
            }}
          />
          <YAxis
            label={{
              value: "Duration",
              angle: -90,
              position: "insideLeft",
            }}
            tickFormatter={(value) => `${formatTime(value as number, 0, 1)}`}
          />
          <Tooltip
            wrapperStyle={{ outline: "none" }}
            cursor={{ fill: "transparent" }}
            formatter={(value, name) => {
              if (name === "total") return null; // Hide the total as a separate item
              return [`${formatTime(value as number, 0, 1)}`, name];
            }}
            content={({ payload, label }) => {
              if (!payload || payload.length === 0) return null;
              const total = payload[0].payload.total; // Get total focus time for the day/week/month
              return (
                <div className="bg-white p-2 shadow rounded">
                  <p className="font-bold">{label}</p>
                  <p className="text-gray-700">
                    Total: {formatTime(total, 0, 1)}
                  </p>
                  <hr />
                  {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color }}>
                      {entry.name}: {formatTime(entry.value as number, 0, 1)}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend />
          {/* Render bars for each tag with appropriate colors */}
          {tags.map((tag: string) => (
            <Bar
              key={String(tag)}
              dataKey={tag}
              stackId="a"
              fill={getTagColor(savedTags, tag, 0.6)[0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* View Period Selection Buttons */}
      <div className="flex justify-center mt-4 space-x-4">
        <Button
          variant={view === "day" ? "secondary" : "ghost"}
          onClick={() => {
            setView("day");
            setOffset(0);
          }}
        >
          7 Days
        </Button>
        <Button
          variant={view === "30days" ? "secondary" : "ghost"}
          onClick={() => {
            setView("30days");
            setOffset(0);
          }}
        >
          30 Days
        </Button>
        <Button
          variant={view === "month" ? "secondary" : "ghost"}
          onClick={() => {
            setView("month");
            setOffset(0);
          }}
        >
          6 Months
        </Button>
        <Button
          variant={view === "yearly" ? "secondary" : "ghost"}
          onClick={() => {
            setView("yearly");
            setOffset(0);
          }}
        >
          Yearly
        </Button>
      </div>

      {/* Focus Time Data Table */}
      <div className="mt-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b flex justify-between font-medium w-full px-2">
              <th className="py-2 text-left w-1/2">Tag</th>
              <th className="py-2 text-right w-1/2">Focused Time</th>
            </tr>
          </thead>
          <tbody>
            {/* Sort tags by total focus time and render rows */}
            {[...tags]
              .sort((a, b) => {
                const totalA = processedData.reduce(
                  (acc, entry) => acc + ((entry[a] as number) || 0),
                  0
                );
                const totalB = processedData.reduce(
                  (acc, entry) => acc + ((entry[b] as number) || 0),
                  0
                );
                return totalB - totalA; // Sort descending
              })
              .map((tag) => {
                const total = processedData.reduce(
                  (acc, entry) => acc + ((entry[tag] as number) || 0),
                  0
                );
                const color = getTagColor(savedTags, tag, 0.6)[0];
                return (
                  <tr key={tag} className="flex justify-between w-full px-2">
                    <td
                      className="py-1 w-1/2 text-left font-semibold"
                      style={{ color }}
                    >
                      {tag}
                    </td>
                    <td
                      className="py-1 w-1/2 text-right font-semibold"
                      style={{ color }}
                    >
                      {formatTime(total, 0, 1)}
                    </td>
                  </tr>
                );
              })}
            {/* Total Row */}
            <tr className="border-t font-semibold flex justify-between w-full px-2">
              <td className="py-2 w-1/2 text-left">Total</td>
              <td className="py-2 w-1/2 text-right">
                {formatTime(
                  processedData.reduce((acc, entry) => acc + entry.total, 0),
                  0,
                  1
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Graph Dialog Wrapper Component
 *
 * Provides a modal dialog interface for displaying the graph component.
 * Acts as a trigger button that opens a full-screen dialog containing
 * the interactive graph and data visualization.
 *
 * The dialog includes a scrollable content area to accommodate the full
 * graph interface including charts, controls, and data tables.
 *
 * @component
 * @returns {JSX.Element} Dialog trigger button and modal containing the graph
 *
 * @example
 * ```tsx
 * // Used in focus session lists or dashboards
 * <GraphDialog />
 * ```
 *
 * @see {@link Graph} for the main graph component
 */
export default function GraphDialog(): JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={"sm"} variant={"outline"}>
          <FaChartBar /> Details
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-200 text-gray-800 max-h-[calc(85vh)] overflow-auto no-scroll-wheel">
        <DialogTitle>Focus History</DialogTitle>
        <DialogDescription>
          See a summary of your focus time, broken down by days, weeks, and
          months.
        </DialogDescription>
        <Graph />
      </DialogContent>
    </Dialog>
  );
}
