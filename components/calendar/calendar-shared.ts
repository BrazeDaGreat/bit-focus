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
/** Screen rectangle of what a panel belongs to (a selection or a block). */
export interface AnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  tag: string;
  color: string;
  whiteText?: boolean;
  /** "pending" is the outline of a selection while its editor is open. */
  kind: "block" | "session" | "deadline" | "pending";
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
/** How focus sessions are drawn in day and week views: slim pills in an edge lane, or full blocks. */
export type SessionStyle = "pills" | "full";
/** How planned blocks are drawn: solid soft cards, or see-through tinted outlines. */
export type BlockStyle = "solid" | "seeThrough";
export interface CalendarDisplay {
  sessions: SessionStyle;
  blocks: BlockStyle;
}
export const DEFAULT_DISPLAY: CalendarDisplay = {
  sessions: "pills",
  blocks: "solid",
};

/**
 * What a right-click landed on. The grid and month overview report it from
 * their own `contextmenu` handlers (which run before the page's), then the
 * page opens the calendar menu at the pointer.
 */
export type ContextTarget =
  /** Empty time (`time` set), or a whole day: header, all-day row, month cell (`time` null). */
  | { kind: "slot"; day: Date; time: Date | null }
  | { kind: "block"; event: CalendarEvent }
  | { kind: "session"; event: CalendarEvent }
  | { kind: "deadline"; event: CalendarEvent };

/** Props of the month overview, which replaces the event-pill month grid. */
export interface MonthOverviewProps {
  /** Any date in the month shown. */
  month: Date;
  /** Focus sessions in the visible weeks, already filtered by the Show menu. */
  sessions: FocusSession[];
  /** Planned block occurrences in the visible weeks, already filtered. */
  occurrences: TimeblockOccurrence[];
  /** Task deadlines in the visible weeks (kind "deadline"), already filtered. */
  deadlines: CalendarEvent[];
  /** Tag colours: `getTagColor(savedTags, tag)` result for a tag. */
  tagColor: (tag: string) => string;
  /** Open a day (the page switches to day view). */
  onOpenDay: (day: Date) => void;
  /** Report a right-click on a day before the page opens its menu. */
  onContextTarget: (target: ContextTarget) => void;
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

// Full sessions and plans share non-overlapping columns for both block styles.
// Pill sessions keep an edge lane; pending selections overlay without taking a column.
export function createTimeblocksLayout(
  display: CalendarDisplay,
): DayLayoutFunction<CalendarEvent> {
  return ({ events, slotMetrics }) => {
    const metrics = slotMetrics as {
      getRange: (start: Date, end: Date) => { top: number; height: number };
    };
    const plans = events
      .filter(
        (event) =>
          event.kind !== "pending" &&
          (display.sessions === "full" || event.kind !== "session"),
      )
      .sort((a, b) => +a.start - +b.start || +b.end - +a.end);
    const sessions = events.filter(
      (event) => event.kind === "session" && display.sessions === "pills",
    );
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
    events
      .filter((event) => event.kind === "pending")
      .forEach((event) =>
        result.push({
          event,
          style: {
            ...metrics.getRange(event.start, event.end),
            width: "calc(100% - 4px)",
            xOffset: 0,
          },
        }),
      );
    return result;
  };
}

export const timeblocksFirstLayout = createTimeblocksLayout(DEFAULT_DISPLAY);
