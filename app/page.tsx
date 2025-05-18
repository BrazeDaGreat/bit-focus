"use client";

import { FocusSession, useFocus } from "@/hooks/useFocus";
import { cn, durationFromSeconds, formatTimeNew, reduceSessions } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { MdTimelapse } from "react-icons/md";
import { TbClockHeart } from "react-icons/tb";

import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);

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
        <h1 className="text-sm opacity-60">
          This feature is under development.
        </h1>
      </div>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

// Cards
function CardTimeFocused() {
  const { focusSessions, loadingFocusSessions } = useFocus();

  const today: FocusSession[] = [];
  const week: FocusSession[]  = [];
  const month: FocusSession[] = [];

  focusSessions.forEach((session) => {
    const start = dayjs(session.startTime);
    if (start.isSameOrAfter(dayjs().subtract(1, "day"))) {
      today.push(session);
    }
    if (start.isBetween(dayjs().subtract(7, "day"), dayjs())) {
      week.push(session);
    }
    if (start.isBetween(dayjs().subtract(30, "day"), dayjs())) {
      month.push(session);
    }
  })

  // Calculate Times
  const todayTotal = formatTimeNew(durationFromSeconds(reduceSessions(today)), "H:M:S", "text");
  const weekTotal  = formatTimeNew(durationFromSeconds(reduceSessions(week)), "H:M:S", "text");
  const monthTotal = formatTimeNew(durationFromSeconds(reduceSessions(month)), "H:M:S", "text");

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
            {loadingFocusSessions ? (
              <Skeleton className="h-10" />
            ) : (
              todayTotal
            )}
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
            {loadingFocusSessions ? (
              <Skeleton className="h-10" />
            ) : (
              weekTotal
            )}
          </span>
        </div>
      </Card>

      <Card className="w-64">
        <div className="px-4 space-y-3">
          <div className="flex items-center gap-2">
            <TbClockHeart />
            <span className="text-xl font-bold">Focus Time</span>
            <span className="text-xs opacity-70">(Last 30 days)</span>
          </div>
          <span className="text-3xl font-bold">
            {loadingFocusSessions ? (
              <Skeleton className="h-10" />
            ) : (
              monthTotal
            )}
          </span>
        </div>
      </Card>
    </>
  );

  
}