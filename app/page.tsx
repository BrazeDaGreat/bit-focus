"use client";

import { useFocus } from "@/hooks/useFocus";
import { cn, formatTime } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { MdTimelapse } from "react-icons/md";
import { TbClockHeart } from "react-icons/tb";

import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
dayjs.extend(isBetween);

export default function Home() {
  const { theme } = useTheme();

  return (
    <div className="">
      <div
        className={cn("flex-1 p-4 gap-4 flex flex-col", "container mx-auto")}
      >
        <div>
          <h1 className="text-3xl font-bold">BIT Focus</h1>
          <span>Your minimalist productivity workspace.</span>
        </div>
        <div className={cn("flex gap-4", "flex-wrap", "my-8")}>
          <CardTimeFocused />
        </div>
        <h1 className="text-sm opacity-60">This feature is under development.</h1>
      </div>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

// Cards
function CardTimeFocused() {
  const { focusSessions, loadingFocusSessions } = useFocus();

  const now = dayjs();
  const todayStart = now.startOf("day");
  const last7DaysStart = now.subtract(7, "day").startOf("day");

  let todayTotal = 0;
  let last7DaysTotal = 0;

  focusSessions.forEach(({ startTime, endTime }) => {
    const start = dayjs(startTime);
    const end = dayjs(endTime);
    const duration = end.diff(start, "second");

    if (start.isAfter(todayStart)) {
      todayTotal += duration;
    }
    if (start.isBetween(last7DaysStart, now, null, "[]")) {
      last7DaysTotal += duration;
    }
  });

  return (
    <>
      <Card className="w-64">
        <div className="px-4 space-y-3">
          <div className="flex items-center gap-2">
            <MdTimelapse />
            <span className="text-xl font-bold">Focus Time</span>
            <span className="text-xs opacity-70">(Today)</span>
          </div>
          <span className="text-3xl font-bold">
            {loadingFocusSessions ? <Skeleton className="h-10" /> : formatTime(Math.floor(todayTotal / 60), todayTotal % 60, 1)}
          </span>
        </div>
      </Card>
      <Card className="w-64">
        <div className="px-4 space-y-3">
          <div className="flex items-center gap-2">
            <TbClockHeart />
            <span className="text-xl font-bold">Focus Time</span>
            <span className="text-xs opacity-70">(Last 7 days)</span>
          </div>
          <span className="text-3xl font-bold">
            {loadingFocusSessions ? <Skeleton className="h-10" /> : formatTime(Math.floor(last7DaysTotal / 60), last7DaysTotal % 60, 1)}
          </span>
        </div>
      </Card>
      {/* <Card>{last7DaysTotal}</Card> */}
    </>
  );
}
