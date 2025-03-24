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
import { stringToHexColor, formatTime } from "@/lib/utils";

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

  return Object.values(groupedData);
};

const Graph: React.FC = () => {
  const { focusSessions } = useFocus();
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const unitToShow = view === "day" ? 7 : view === "week" ? 4 : 6;
  const dateRange = generateLastNUnits(unitToShow, view, offset);
  const processedData = processData(focusSessions, dateRange, view);
  const tags = Array.from(
    new Set(focusSessions.map((item: FocusSession) => item.tag))
  );

  return (
    <div>
      <div className="flex justify-between mb-4">
        <button
          onClick={() => setOffset(offset + unitToShow)}
          className="px-4 py-2 bg-gray-300 rounded"
        >
          Previous
        </button>
        <button
          onClick={() => setOffset(Math.max(0, offset - unitToShow))}
          className="px-4 py-2 bg-gray-300 rounded"
        >
          Next
        </button>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={processedData} stackOffset="sign" >
        <CartesianGrid strokeDasharray="" stroke="#eee" />
          <XAxis
            dataKey="date"
            stroke="#8884d8"
            tickFormatter={(date) => {
              return dayjs(date).format("DD MMM");
            }}
          />
          <YAxis
            label={{
              value: "Duration",
              angle: -90,
              position: "insideLeft",
            }}
          />
          {/* <Tooltip
            formatter={(value) => formatTime((value as number), 0, 1)}
          /> */}
          <Tooltip
          wrapperStyle={{ outline: "none" }}
          cursor={{ fill: "transparent" }}
            formatter={(value, name, props) => {
              if (name === "total") return null; // Hide the total as a separate item
              const total = props.payload?.total ?? 0;
              console.log(total);
              return [`${formatTime(value as number, 0, 1)}`, name];
            }}
            content={({ payload, label }) => {
              if (!payload || payload.length === 0) return null;
              const total = payload[0].payload.total; // Get total focus time for the day
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
          {/* <Bar
            dataKey="total"
            stackId="a"
            fill="#8884d8"
            name="Total Focused Time"
            //   barSize={10} // Slightly thinner bar for total
            opacity={0.5} // Make it semi-transparent for distinction
          /> */}
          {tags.map((tag: string) => (
            <Bar
              key={String(tag)}
              dataKey={tag}
              stackId="a"
              fill={stringToHexColor(tag, undefined, 60)[0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center mt-4 space-x-4">
        <button
          onClick={() => setView("day")}
          className={`px-4 py-2 ${
            view === "day" ? "bg-blue-500 text-white" : "bg-gray-300"
          } rounded`}
        >
          Days
        </button>
        <button
          onClick={() => setView("week")}
          className={`px-4 py-2 ${
            view === "week" ? "bg-blue-500 text-white" : "bg-gray-300"
          } rounded`}
        >
          Weeks
        </button>
        <button
          onClick={() => setView("month")}
          className={`px-4 py-2 ${
            view === "month" ? "bg-blue-500 text-white" : "bg-gray-300"
          } rounded`}
        >
          Months
        </button>
      </div>
    </div>
  );
};

export default Graph;
