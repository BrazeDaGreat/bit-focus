import React, { useState } from "react";
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

dayjs.extend(isoWeek);

interface ProcessedData {
  date: string;
  total: number;
  [key: string]: number | string;
}

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

const processData = (
  data: FocusSession[],
  dateRange: string[],
  unit: "day" | "week" | "month"
): ProcessedData[] => {
  const groupedData: { [date: string]: ProcessedData } = {};

  dateRange.forEach((date) => {
    groupedData[date] = { date, total: 0 };
  });

  data.forEach(({ tag, startTime, endTime }) => {
    const date =
      unit === "week"
        ? dayjs(startTime).format("YYYY-[W]WW")
        : dayjs(startTime).format(unit === "month" ? "YYYY-MM" : "YYYY-MM-DD");
    if (!groupedData[date]) return;
    const duration =
      Math.round(((endTime.getTime() - startTime.getTime()) / 60000) * 100) /
      100;
    groupedData[date][tag] =
      ((groupedData[date][tag] as number) || 0) + duration;
    groupedData[date].total += duration;
  });
  console.log(groupedData);
  return Object.values(groupedData);
};

const Graph: React.FC = () => {
  const { focusSessions } = useFocus();
  const { savedTags } = useTag();
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"day" | "week" | "month" | "30days">("day");

  // Determine number of units to show and unit type for generateLastNUnits
  const unitToShow =
    view === "day" ? 7 : view === "30days" ? 30 : view === "week" ? 4 : 6;

  // For 30days view, unit is 'day'; otherwise use the view directly
  const unitForGenerate = view === "30days" ? "day" : view;

  const dateRange = generateLastNUnits(unitToShow, unitForGenerate, offset);
  const processedData = processData(focusSessions, dateRange, unitForGenerate);

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
  const tagTotals: Record<string, number> = {};
  for (const entry of processedData) {
    for (const tag of rawTags) {
      tagTotals[tag] = (tagTotals[tag] || 0) + ((entry[tag] as number) || 0);
    }
  }
  const tags = rawTags.sort((a, b) => tagTotals[b] - tagTotals[a]);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <Button
          variant={"secondary"}
          onClick={() => setOffset(offset + unitToShow)}
        >
          <FaArrowLeft />
        </Button>
        <Button
          variant={"secondary"}
          onClick={() => setOffset(Math.max(0, offset - unitToShow))}
        >
          <FaArrowRight />
        </Button>
      </div>
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
      </div>
      {/* Data Table */}
      <div className="mt-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b flex justify-between font-medium w-full px-2">
              <th className="py-2 text-left w-1/2">Tag</th>
              <th className="py-2 text-right w-1/2">Focused Time</th>
            </tr>
          </thead>
          <tbody>
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

export default function GraphDialog() {
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
