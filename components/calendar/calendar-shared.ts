import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { DayLayoutFunction } from "react-big-calendar";
import type { CSSProperties } from "react";
import type { FocusSession } from "@/hooks/useFocus";
import type { TimeblockOccurrence } from "@/lib/timeblocks";

export type CalendarView = "day" | "week" | "month";
export type ZoomLevel = "compact" | "normal" | "expanded";
export interface Point {
  x: number;
  y: number;
}
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  tag: string;
  color: string;
  whiteText?: boolean;
  kind: "block" | "session" | "deadline";
  occurrence?: TimeblockOccurrence;
  session?: FocusSession;
  taskUid?: string;
  allDay?: boolean;
}
export interface CalendarFilters {
  sessions: boolean;
  blocks: boolean;
  deadlines: boolean;
  hiddenTags: string[];
}
export const CONTROL =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";
export const QUIET = `${CONTROL} text-muted-foreground hover:bg-muted/60 hover:text-foreground`;
export const PRIMARY = `${CONTROL} bg-primary text-primary-foreground`;
export const FIELD =
  "h-9 w-full min-w-0 rounded-lg bg-muted/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const ZOOM = { compact: 36, normal: 64, expanded: 112 };

export function periodRange(date: Date, view: CalendarView) {
  if (view === "day")
    return { start: startOfDay(date), end: addDays(startOfDay(date), 1) };
  if (view === "week")
    return {
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: addDays(startOfWeek(date, { weekStartsOn: 1 }), 7),
    };
  return { start: startOfMonth(date), end: startOfMonth(addMonths(date, 1)) };
}
export function renderRange(date: Date, view: CalendarView) {
  if (view !== "month") return periodRange(date, view);
  return {
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
    end: addDays(
      startOfDay(endOfWeek(endOfMonth(date), { weekStartsOn: 1 })),
      1,
    ),
  };
}
export function movePeriod(date: Date, view: CalendarView, direction: number) {
  return view === "day"
    ? addDays(date, direction)
    : view === "week"
      ? addWeeks(date, direction)
      : addMonths(date, direction);
}
export function periodLabel(date: Date, view: CalendarView) {
  if (view === "day") return format(date, "EEE, MMM d, yyyy");
  if (view === "month") return format(date, "MMMM yyyy");
  const first = startOfWeek(date, { weekStartsOn: 1 });
  const last = addDays(first, 6);
  return `${format(first, first.getMonth() === last.getMonth() ? "MMM d" : "MMM d, yyyy")} – ${format(last, "MMM d, yyyy")}`;
}
export function softTag(color: string) {
  return `color-mix(in srgb, ${color} 14%, transparent)`;
}
export function durationLabel(minutes: number) {
  const rounded = Math.round(minutes);
  return rounded >= 60
    ? `${Math.floor(rounded / 60)}h${rounded % 60 ? ` ${rounded % 60}m` : ""}`
    : `${rounded}m`;
}

// Sessions always occupy their own slim lane. Overlapping plans share the
// remaining space, rather than concealing one another beneath the latest block.
export const timeblocksFirstLayout: DayLayoutFunction<CalendarEvent> = ({
  events,
  slotMetrics,
}) => {
  const metrics = slotMetrics as {
    getRange: (start: Date, end: Date) => { top: number; height: number };
  };
  const plans = events
    .filter((event) => event.kind !== "session")
    .sort((a, b) => +a.start - +b.start || +b.end - +a.end);
  const sessions = events.filter((event) => event.kind === "session");
  // RBC consumes xOffset as a percentage before passing CSS to the DOM; its
  // public CSSProperties return type does not describe that intermediate field.
  const result: {
    event: CalendarEvent;
    style: CSSProperties & { xOffset: number | string };
  }[] = [];
  const laneWidth = sessions.length ? 18 : 4;
  const groups: CalendarEvent[][] = [];
  let groupEnd = -Infinity;
  for (const event of plans) {
    if (+event.start >= groupEnd) groups.push([]);
    groups.at(-1)!.push(event);
    groupEnd = Math.max(
      +event.end,
      +event.start >= groupEnd ? -Infinity : groupEnd,
    );
  }
  for (const group of groups) {
    const columns: Date[] = [];
    const assigned = group.map((event) => {
      let column = columns.findIndex((end) => end <= event.start);
      if (column < 0) column = columns.length;
      columns[column] = event.end;
      return { event, column };
    });
    const fraction = 100 / columns.length;
    assigned.forEach(({ event, column }) =>
      result.push({
        event,
        style: {
          ...metrics.getRange(event.start, event.end),
          width: `calc(${fraction}% - ${laneWidth / columns.length + 2}px)`,
          xOffset: `calc(${fraction * column}% - ${(laneWidth * column) / columns.length}px)`,
        },
      }),
    );
  }
  sessions.forEach((event) =>
    result.push({
      event,
      style: {
        ...metrics.getRange(event.start, event.end),
        width: "10px",
        xOffset: "calc(100% - 12px)",
      },
    }),
  );
  return result;
};
