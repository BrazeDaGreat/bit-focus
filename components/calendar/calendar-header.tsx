"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL } from "./anchored-panel";
import {
  CONTROL,
  QUIET,
  periodLabel,
  type CalendarFilters,
  type CalendarView,
} from "./calendar-shared";

const DEFAULT_FILTERS: CalendarFilters = {
  sessions: true,
  blocks: true,
  deadlines: true,
  hiddenTags: [],
};
const FILTER_KEY = "bit-focus-calendar-show";
export function useCalendarFilters() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(FILTER_KEY) || "null",
      );
      if (stored && typeof stored === "object") {
        const value = stored as Partial<CalendarFilters>;
        setFilters({
          sessions: typeof value.sessions === "boolean" ? value.sessions : true,
          blocks: typeof value.blocks === "boolean" ? value.blocks : true,
          deadlines:
            typeof value.deadlines === "boolean" ? value.deadlines : true,
          hiddenTags: Array.isArray(value.hiddenTags)
            ? value.hiddenTags.filter(
                (tag): tag is string => typeof tag === "string",
              )
            : [],
        });
      }
    } catch {
      /* Private browsing can disable storage. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {
      /* Filters still work for this visit. */
    }
  }, [filters, ready]);
  return [filters, setFilters] as const;
}

interface HeaderProps {
  date: Date;
  view: CalendarView;
  onDate: (direction: -1 | 0 | 1) => void;
  onView: (view: CalendarView) => void;
  viewOptions: ReactNode;
  rail: ReactNode;
}
function Divider() {
  return <span className="mx-1 hidden h-6 w-px bg-border sm:block" />;
}

export function CalendarHeader({
  date,
  view,
  onDate,
  onView,
  viewOptions,
  rail,
}: HeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-3 md:px-5">
      <div className="md:hidden">
        <Popover.Root modal>
          <Popover.Trigger
            className={cn(QUIET, "w-9 px-0")}
            aria-label="Open plan and review"
          >
            <PanelLeft className="size-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              collisionPadding={12}
              aria-label="Plan and review"
              className={cn(PANEL, "w-80 max-h-[80dvh] p-5")}
            >
              {rail}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <button className={QUIET} onClick={() => onDate(0)} title="Go to today (T)" aria-keyshortcuts="T">
        Today
      </button>
      <div className="flex gap-1">
        <button
          className={cn(QUIET, "w-9 px-0")}
          aria-label="Previous period"
          onClick={() => onDate(-1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          className={cn(QUIET, "w-9 px-0")}
          aria-label="Next period"
          onClick={() => onDate(1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <h1 className="min-w-0 flex-1 font-mono text-sm font-semibold tracking-tight tabular-nums">
        {periodLabel(date, view)}
      </h1>
      {viewOptions}
      <Divider />
      <div className="flex rounded-xl bg-muted/60 p-1">
        {(["day", "week", "month"] as const).map((item) => (
          <button
            key={item}
            className={cn(
              CONTROL,
              "capitalize",
              view === item
                ? "bg-background shadow-xs"
                : "text-muted-foreground hover:bg-muted/60",
            )}
            onClick={() => onView(item)}
            title={`${item[0].toUpperCase()}${item.slice(1)} (${item[0].toUpperCase()})`}
            aria-keyshortcuts={item[0].toUpperCase()}
            aria-pressed={view === item}
          >
            {item}
          </button>
        ))}
      </div>
    </header>
  );
}
