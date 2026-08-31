"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type JSX,
} from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import type { SlotInfo, DayLayoutFunction } from "react-big-calendar";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getStyledEvents } = require("react-big-calendar/lib/utils/DayEventLayout") as {
  getStyledEvents: (args: {
    events: object[];
    minimumStartDifference: number;
    slotMetrics: unknown;
    accessors: unknown;
    dayLayoutAlgorithm: string;
  }) => Array<{ event: object; style: { top: number; height: number; width: number; xOffset: number } }>;
};
import {
  format,
  parse,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  getDay,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { useFocus, FocusSession } from "@/hooks/useFocus";
import { useTag } from "@/hooks/useTag";
import { useTimeblocks } from "@/hooks/useTimeblocks";
import {
  cn,
  durationFromSeconds,
  formatTimeNew,
  getTagColor,
  reduceSessions,
} from "@/lib/utils";
import { useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { EditFocusSessionDialog } from "@/components/EditFocusSessionDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  FaChevronLeft,
  FaChevronRight,
  FaBars,
  FaTrash,
  FaRegClock,
  FaMagnifyingGlassMinus,
  FaMagnifyingGlass,
  FaMagnifyingGlassPlus,
} from "react-icons/fa6";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(Calendar as any);

const timeblocksFirstLayout: DayLayoutFunction<CalendarEvent> = ({
  events,
  minimumStartDifference,
  slotMetrics,
  accessors,
}) => {
  const focusEvts = events.filter((e) => !e.isTimeblock);
  const tbEvts = events.filter((e) => e.isTimeblock);

  type StyledEvent = {
    event: CalendarEvent;
    style: { top: number; height: number; width: number; xOffset: number };
  };

  const focusStyled: StyledEvent[] = focusEvts.length
    ? (getStyledEvents({
        events: focusEvts,
        minimumStartDifference,
        slotMetrics,
        accessors,
        dayLayoutAlgorithm: "no-overlap",
      }) as StyledEvent[])
    : [];

  const tbStyled: StyledEvent[] = tbEvts.map((event) => {
    const { top, height } = (
      slotMetrics as { getRange: (s: Date, e: Date) => { top: number; height: number } }
    ).getRange(
      (accessors as { start: (e: CalendarEvent) => Date }).start(event),
      (accessors as { end: (e: CalendarEvent) => Date }).end(event)
    );
    return { event, style: { top, height, width: 100, xOffset: 0 } };
  });

  return [...tbStyled, ...focusStyled];
};

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  tag: string;
  color: string;
  textColor: string;
  isTimeblock: boolean;
}

type CalView = "day" | "week" | "month";
type ZoomLevel = "compact" | "normal" | "expanded";

const ZOOM_CONFIG: Record<ZoomLevel, { row: number; step: number; timeslots: number }> = {
  compact: { row: 34, step: 30, timeslots: 2 },
  normal: { row: 56, step: 15, timeslots: 4 },
  expanded: { row: 104, step: 15, timeslots: 4 },
};

interface PendingSlot {
  start: Date;
  end: Date;
  x: number;
  y: number;
}

interface EditingTb {
  id: number;
  tag: string;
  startTime: Date;
  endTime: Date;
  x: number;
  y: number;
}

function getPeriodRange(date: Date, view: CalView) {
  if (view === "day") return { start: startOfDay(date), end: endOfDay(date) };
  if (view === "week")
    return {
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
    };
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

function navigate(date: Date, view: CalView, dir: -1 | 1): Date {
  if (view === "day") return addDays(date, dir);
  if (view === "week") return addWeeks(date, dir);
  return addMonths(date, dir);
}

function getPeriodLabel(date: Date, view: CalView): string {
  if (view === "day") return format(date, "MMMM d, yyyy");
  if (view === "month") return format(date, "MMMM yyyy");
  const s = startOfWeek(date, { weekStartsOn: 1 });
  const e = endOfWeek(date, { weekStartsOn: 1 });
  if (s.getMonth() === e.getMonth()) return format(s, "MMMM yyyy");
  if (s.getFullYear() === e.getFullYear())
    return `${format(s, "MMM")} – ${format(e, "MMM yyyy")}`;
  return `${format(s, "MMM yyyy")} – ${format(e, "MMM yyyy")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) return hexToRgba(color, alpha);
  if (color.startsWith("rgba")) return color.replace(/[\d.]+\)$/, `${alpha})`);
  if (color.startsWith("rgb("))
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  return color;
}

function MiniCalendar({
  value,
  onPick,
  activeRange,
}: {
  value: Date;
  onPick: (d: Date) => void;
  activeRange: { start: Date; end: Date };
}) {
  const [month, setMonth] = useState(() => startOfMonth(value));
  useEffect(() => setMonth(startOfMonth(value)), [value]);

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [month]);

  const today = new Date();
  const rangeStart = startOfDay(activeRange.start);
  const rangeEnd = endOfDay(activeRange.end);

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold tracking-tight">
          {format(month, "MMMM yyyy")}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="size-6 grid place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Previous month"
          >
            <FaChevronLeft className="size-2.5" />
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="size-6 grid place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Next month"
          >
            <FaChevronRight className="size-2.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={i}
            className="text-[10px] font-medium text-muted-foreground h-6 grid place-items-center"
          >
            {d}
          </span>
        ))}
        {days.map((d) => {
          const inRange = d >= rangeStart && d <= rangeEnd;
          const isToday = isSameDay(d, today);
          const isSel = isSameDay(d, value);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "text-[11px] size-6 mx-auto grid place-items-center rounded-full transition-colors tabular-nums",
                !isSameMonth(d, month) && "text-muted-foreground/45",
                inRange && !isSel && "bg-accent",
                isToday && !isSel && "text-primary font-bold",
                isSel
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "hover:bg-accent/70"
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage(): JSX.Element {
  const { theme } = useTheme();
  const { focusSessions, loadFocusSessions, loadingFocusSessions } = useFocus();
  const { savedTags } = useTag();
  const {
    timeblocks,
    loadTimeblocks,
    addTimeblock,
    editTimeblock,
    removeTimeblock,
  } = useTimeblocks();
  const isMobile = useIsMobile();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalView>("week");
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("normal");
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showTimeblocks, setShowTimeblocks] = useState(true);

  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);
  const [pendingTag, setPendingTag] = useState("");

  const [editingTb, setEditingTb] = useState<EditingTb | null>(null);
  const [editTbTag, setEditTbTag] = useState("");

  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  useEffect(() => {
    loadFocusSessions();
    loadTimeblocks();
  }, [loadFocusSessions, loadTimeblocks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      )
        return;
      switch (e.key.toLowerCase()) {
        case "d":
          setCurrentView("day");
          break;
        case "w":
          setCurrentView("week");
          break;
        case "m":
          setCurrentView("month");
          break;
        case "t":
          setCurrentDate(new Date());
          break;
        case "arrowleft":
          setCurrentDate((d) => navigate(d, currentView, -1));
          break;
        case "arrowright":
          setCurrentDate((d) => navigate(d, currentView, 1));
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentView]);

  const allFocusEvents = useMemo<CalendarEvent[]>(() => {
    if (!focusSessions.length) return [];

    const sorted = [...focusSessions].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const GAP = 30 * 60 * 1000;
    const merged: CalendarEvent[] = [];
    let group = [sorted[0]];

    const flush = (g: typeof group) => {
      const tag = g[0].tag;
      const [color, white] = getTagColor(savedTags, tag);
      merged.push({
        id: g[0].id!,
        title: tag,
        start: new Date(g[0].startTime),
        end: new Date(g[g.length - 1].endTime),
        tag,
        color,
        textColor: white ? "#ffffff" : "#000000",
        isTimeblock: false,
      });
    };

    for (let i = 1; i < sorted.length; i++) {
      const prev = group[group.length - 1];
      const curr = sorted[i];
      const gap = new Date(curr.startTime).getTime() - new Date(prev.endTime).getTime();
      if (curr.tag === prev.tag && gap >= 0 && gap <= GAP) {
        group.push(curr);
      } else {
        flush(group);
        group = [curr];
      }
    }
    flush(group);

    const split: CalendarEvent[] = [];
    for (const ev of merged) {
      if (ev.start.toDateString() === ev.end.toDateString()) {
        split.push(ev);
        continue;
      }
      let seg = new Date(ev.start);
      while (seg.toDateString() !== ev.end.toDateString()) {
        const dayEnd = new Date(seg);
        dayEnd.setHours(23, 59, 59, 999);
        split.push({ ...ev, start: new Date(seg), end: dayEnd });
        seg = new Date(seg);
        seg.setDate(seg.getDate() + 1);
        seg.setHours(0, 0, 0, 0);
      }
      split.push({ ...ev, start: seg, end: new Date(ev.end) });
    }
    return split;
  }, [focusSessions, savedTags]);

  const focusEvents = useMemo(
    () => allFocusEvents.filter((e) => !hiddenTags.has(e.tag)),
    [allFocusEvents, hiddenTags]
  );

  const timeblocksCalEvents = useMemo<CalendarEvent[]>(() => {
    if (!showTimeblocks || currentView === "month") return [];
    return timeblocks.map((tb): CalendarEvent => {
      const [solidColor, white] = getTagColor(savedTags, tb.tag);
      return {
        id: tb.id!,
        title: tb.tag || "Time block",
        start: new Date(tb.startTime),
        end: new Date(tb.endTime),
        tag: tb.tag,
        color: solidColor,
        textColor: white ? "#ffffff" : "#000000",
        isTimeblock: true,
      };
    });
  }, [timeblocks, savedTags, showTimeblocks, currentView]);

  const allCalEvents = useMemo(
    () => [...focusEvents, ...timeblocksCalEvents],
    [focusEvents, timeblocksCalEvents]
  );

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    allFocusEvents.forEach((e) => {
      if (!map.has(e.tag)) map.set(e.tag, e.color);
    });
    return Array.from(map.entries())
      .map(([tag, color]) => ({ tag, color }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [allFocusEvents]);

  const periodRange = useMemo(
    () => getPeriodRange(currentDate, currentView),
    [currentDate, currentView]
  );

  const periodStats = useMemo(() => {
    const { start, end } = periodRange;
    const inPeriod = focusSessions.filter((s) => {
      const t = new Date(s.startTime).getTime();
      return t >= start.getTime() && t <= end.getTime() && !hiddenTags.has(s.tag);
    });
    const totalSec = reduceSessions(inPeriod);
    const count = inPeriod.length;
    const avgSec = count > 0 ? totalSec / count : 0;
    return {
      total: formatTimeNew(durationFromSeconds(totalSec), "H:M:S", "text"),
      count,
      avg: count > 0 ? formatTimeNew(durationFromSeconds(avgSec), "H:M:S", "text") : "—",
    };
  }, [focusSessions, periodRange, hiddenTags]);

  const tagBreakdown = useMemo(() => {
    const { start, end } = periodRange;
    const totals = new Map<string, number>();
    focusSessions.forEach((s) => {
      const t = new Date(s.startTime).getTime();
      if (t < start.getTime() || t > end.getTime()) return;
      if (hiddenTags.has(s.tag)) return;
      totals.set(s.tag, (totals.get(s.tag) ?? 0) + reduceSessions([s]));
    });
    const max = Math.max(1, ...totals.values());
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, sec]) => ({
        tag,
        sec,
        pct: (sec / max) * 100,
        color: getTagColor(savedTags, tag)[0],
      }));
  }, [focusSessions, periodRange, hiddenTags, savedTags]);

  const clampPopupPos = useCallback(
    (rawX: number, rawY: number) => ({
      x: Math.max(10, Math.min(rawX + 12, window.innerWidth - 275)),
      y: Math.max(10, Math.min(rawY - 10, window.innerHeight - 310)),
    }),
    []
  );

  const handleEventDrop = useCallback(
    ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      if (!event.isTimeblock) return;
      editTimeblock(event.id, { startTime: new Date(start), endTime: new Date(end) });
    },
    [editTimeblock]
  );

  const handleEventResize = useCallback(
    ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      if (!event.isTimeblock) return;
      editTimeblock(event.id, { startTime: new Date(start), endTime: new Date(end) });
    },
    [editTimeblock]
  );

  const handleSelectSlot = useCallback(
    (slot: SlotInfo) => {
      if (currentView === "month") return;
      if (slot.action !== "select") return;
      const { x, y } = clampPopupPos(lastMousePos.current.x, lastMousePos.current.y);
      setPendingSlot({ start: slot.start, end: slot.end, x, y });
      setPendingTag("");
    },
    [currentView, clampPopupPos]
  );

  const handleCreateTimeblock = useCallback(
    (tagOverride?: string) => {
      if (!pendingSlot) return;
      const tag = (tagOverride ?? pendingTag).trim();
      if (!tag) return;
      addTimeblock(tag, pendingSlot.start, pendingSlot.end);
      setPendingSlot(null);
      setPendingTag("");
    },
    [pendingSlot, pendingTag, addTimeblock]
  );

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      if (event.isTimeblock) {
        const tb = timeblocks.find((t) => t.id === event.id);
        if (!tb) return;
        const { x, y } = clampPopupPos(lastMousePos.current.x, lastMousePos.current.y);
        setEditingTb({
          id: tb.id!,
          tag: tb.tag,
          startTime: new Date(tb.startTime),
          endTime: new Date(tb.endTime),
          x,
          y,
        });
        setEditTbTag(tb.tag);
      } else {
        const session = focusSessions.find((s) => s.id === event.id);
        if (session) {
          setSelectedSession(session);
          setIsEditDialogOpen(true);
        }
      }
    },
    [timeblocks, focusSessions, clampPopupPos]
  );

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    if (event.isTimeblock) {
      return {
        style: {
          backgroundColor: colorWithAlpha(event.color, 0.14),
          color: event.color,
          borderRadius: "6px",
          border: `1.5px dashed ${colorWithAlpha(event.color, 0.7)}`,
          fontWeight: 600,
          fontSize: "0.7rem",
          zIndex: 0,
        },
      };
    }
    return {
      style: {
        backgroundColor: event.color,
        color: event.textColor,
        borderRadius: "6px",
        border: "none",
        zIndex: 2,
      },
    };
  }, []);

  const draggableAccessor = useCallback((e: CalendarEvent) => e.isTimeblock, []);
  const resizableAccessor = useCallback((e: CalendarEvent) => e.isTimeblock, []);

  const DayHeader = useCallback(({ date }: { date: Date }) => {
    const isToday = isSameDay(date, new Date());
    return (
      <button
        onClick={() => {
          setCurrentDate(date);
          setCurrentView("day");
        }}
        className="w-full flex flex-col items-center gap-0.5 py-2 group"
      >
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-wider",
            isToday ? "text-primary" : "text-muted-foreground"
          )}
        >
          {format(date, "EEE")}
        </span>
        <span
          className={cn(
            "grid place-items-center size-9 rounded-full text-xl tabular-nums transition-colors",
            isToday
              ? "bg-primary text-primary-foreground font-medium"
              : "text-foreground group-hover:bg-accent"
          )}
        >
          {format(date, "d")}
        </span>
      </button>
    );
  }, []);

  const MonthHeader = useCallback(
    ({ date }: { date: Date }) => (
      <span className="block py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {format(date, "EEE")}
      </span>
    ),
    []
  );

  const calComponents = useMemo(
    () => ({
      toolbar: () => null,
      timeGutterHeader: () => (
        <div className="h-full flex items-end justify-end pr-2 pb-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">
            {format(new Date(), "OOO")}
          </span>
        </div>
      ),
      week: { header: DayHeader },
      day: { header: DayHeader },
      month: { header: MonthHeader },
    }),
    [DayHeader, MonthHeader]
  );

  const scrollToTime = useMemo(() => {
    const d = new Date();
    d.setHours(Math.max(0, d.getHours() - 1), 0, 0, 0);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, currentView, zoomLevel]);

  const periodLabel = getPeriodLabel(currentDate, currentView);
  const statsLabel =
    currentView === "day" ? "Today" : currentView === "week" ? "This week" : "This month";

  const toggleTag = (tag: string) => {
    setHiddenTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const SidebarContent = () => (
    <div className="flex flex-col gap-5">
      <MiniCalendar value={currentDate} onPick={setCurrentDate} activeRange={periodRange} />

      <div className="border-t pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          My tags
        </p>
        {allTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No tags yet. Finish a focus session to see it here.
          </p>
        ) : (
          <div className="flex flex-col">
            {allTags.map(({ tag, color }) => {
              const active = !hiddenTags.has(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={active}
                  className="flex items-center gap-2.5 py-1.5 px-1.5 -mx-1.5 rounded-md hover:bg-accent/60 transition-colors w-full text-left"
                >
                  <span
                    className="size-3.5 rounded-[4px] shrink-0 border-2 transition-colors"
                    style={{
                      backgroundColor: active ? color : "transparent",
                      borderColor: color,
                    }}
                  />
                  <span
                    className={cn(
                      "text-[13px] truncate transition-colors",
                      active ? "text-foreground" : "text-muted-foreground line-through"
                    )}
                  >
                    {tag}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {currentView !== "month" && (
        <div className="border-t pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Planned
          </p>
          <button
            onClick={() => setShowTimeblocks((v) => !v)}
            aria-pressed={showTimeblocks}
            className="flex items-center gap-2.5 py-1.5 px-1.5 -mx-1.5 rounded-md hover:bg-accent/60 transition-colors w-full text-left"
          >
            <span
              className={cn(
                "size-3.5 rounded-[4px] shrink-0 border-2 border-dashed transition-colors",
                showTimeblocks ? "border-primary bg-primary/20" : "border-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-[13px]",
                showTimeblocks ? "text-foreground" : "text-muted-foreground line-through"
              )}
            >
              Time blocks
            </span>
          </button>
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 pl-1 leading-snug">
            {showTimeblocks && timeblocksCalEvents.length > 0
              ? `${timeblocksCalEvents.length} block${
                  timeblocksCalEvents.length !== 1 ? "s" : ""
                } · drag empty space to plan more`
              : "Drag empty space to plan time"}
          </p>
        </div>
      )}

      <div className="border-t pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {statsLabel}
        </p>
        <p className="text-2xl font-mono font-semibold tracking-tight tabular-nums">
          {periodStats.total}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {periodStats.count} session{periodStats.count !== 1 ? "s" : ""} · avg{" "}
          {periodStats.avg}
        </p>

        {tagBreakdown.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {tagBreakdown.map(({ tag, sec, pct, color }) => (
              <div key={tag} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] truncate">{tag}</span>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {formatTimeNew(durationFromSeconds(sec), "H:M:S", "text")}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground/70">
        Shortcuts: <span className="font-mono">D</span> day ·{" "}
        <span className="font-mono">W</span> week · <span className="font-mono">M</span>{" "}
        month · <span className="font-mono">T</span> today ·{" "}
        <span className="font-mono">← →</span> navigate
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
      <header className="flex items-center gap-2 md:gap-3 px-3 md:px-5 h-16 shrink-0 border-b">
        {isMobile && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 rounded-full">
                <FaBars className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-4 max-h-[80vh] overflow-y-auto"
            >
              <SidebarContent />
            </PopoverContent>
          </Popover>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentDate(new Date())}
          className="rounded-full h-9 px-4 text-[13px] font-medium"
        >
          Today
        </Button>

        <div className="flex items-center">
          <button
            onClick={() => setCurrentDate((d) => navigate(d, currentView, -1))}
            className="size-9 grid place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Previous period"
          >
            <FaChevronLeft className="size-3.5" />
          </button>
          <button
            onClick={() => setCurrentDate((d) => navigate(d, currentView, 1))}
            className="size-9 grid place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Next period"
          >
            <FaChevronRight className="size-3.5" />
          </button>
        </div>

        <h1 className="text-base md:text-[22px] font-normal tracking-tight truncate">
          {periodLabel}
        </h1>

        <div className="ml-auto flex items-center gap-2">
          {currentView !== "month" && !isMobile && (
            <div className="flex items-center bg-muted rounded-full p-0.5 gap-0.5">
              {(
                [
                  {
                    level: "compact" as ZoomLevel,
                    Icon: FaMagnifyingGlassMinus,
                    label: "Compact rows",
                  },
                  {
                    level: "normal" as ZoomLevel,
                    Icon: FaMagnifyingGlass,
                    label: "Normal rows",
                  },
                  {
                    level: "expanded" as ZoomLevel,
                    Icon: FaMagnifyingGlassPlus,
                    label: "Expanded rows",
                  },
                ] as const
              ).map(({ level, Icon, label }) => (
                <button
                  key={level}
                  onClick={() => setZoomLevel(level)}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "size-8 grid place-items-center rounded-full transition-colors",
                    zoomLevel === level
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3" />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center bg-muted rounded-full p-0.5 gap-0.5">
            {(["day", "week", "month"] as CalView[]).map((v) => (
              <button
                key={v}
                onClick={() => setCurrentView(v)}
                className={cn(
                  "px-3 md:px-3.5 h-8 text-[13px] font-medium rounded-full transition-colors capitalize",
                  currentView === v
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {!isMobile && (
          <aside className="w-64 shrink-0 border-r px-4 py-4 overflow-y-auto">
            <SidebarContent />
          </aside>
        )}

        <main
          suppressHydrationWarning
          className="gcal flex-1 min-w-0 p-2 md:p-3"
          style={{ ["--row-h" as string]: `${ZOOM_CONFIG[zoomLevel].row}px` }}
        >
          {loadingFocusSessions ? (
            <div className="grid place-items-center h-full text-muted-foreground text-sm">
              Loading sessions…
            </div>
          ) : (
            <DnDCalendar
              localizer={localizer}
              events={allCalEvents}
              startAccessor="start"
              endAccessor="end"
              view={currentView as View}
              onView={(v) => setCurrentView(v as CalView)}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={handleSelectEvent as (event: object) => void}
              onEventDrop={handleEventDrop as (args: EventInteractionArgs<object>) => void}
              onEventResize={
                handleEventResize as (args: EventInteractionArgs<object>) => void
              }
              onSelectSlot={handleSelectSlot}
              selectable={currentView !== "month"}
              draggableAccessor={draggableAccessor as (event: object) => boolean}
              resizableAccessor={resizableAccessor as (event: object) => boolean}
              resizable
              popup
              eventPropGetter={
                eventStyleGetter as (event: object) => { style: React.CSSProperties }
              }
              dayLayoutAlgorithm={timeblocksFirstLayout as DayLayoutFunction<object>}
              step={ZOOM_CONFIG[zoomLevel].step}
              timeslots={ZOOM_CONFIG[zoomLevel].timeslots}
              scrollToTime={scrollToTime}
              formats={{
                timeGutterFormat: (d: Date) => format(d, "h a"),
                eventTimeRangeFormat: ({ start }: { start: Date }) =>
                  format(start, "h:mm a"),
              }}
              tooltipAccessor={(event) => {
                const ev = event as CalendarEvent;
                const prefix = ev.isTimeblock ? "Planned · " : "";
                return `${prefix}${ev.tag}\n${format(ev.start, "h:mm a")} – ${format(
                  ev.end,
                  "h:mm a"
                )}`;
              }}
              getNow={() => new Date()}
              min={startOfDay(new Date())}
              max={endOfDay(new Date())}
              components={calComponents}
            />
          )}
        </main>
      </div>

      {pendingSlot && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPendingSlot(null)} />
          <div
            className="fixed z-50 bg-popover border shadow-2xl rounded-xl overflow-hidden w-64"
            style={{ left: pendingSlot.x, top: pendingSlot.y }}
          >
            <div className="px-4 pt-3.5 pb-2.5 border-b bg-muted/40">
              <div className="flex items-center gap-2">
                <FaRegClock className="size-3 text-muted-foreground shrink-0" />
                <p className="text-xs font-semibold">Plan time block</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {format(pendingSlot.start, "h:mm a")} → {format(pendingSlot.end, "h:mm a")}
              </p>
            </div>

            <div className="p-3 flex flex-col gap-2.5">
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allTags.slice(0, 10).map(({ tag, color }) => (
                    <button
                      key={tag}
                      onClick={() => handleCreateTimeblock(tag)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold transition-transform hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: colorWithAlpha(color, 0.15),
                        color,
                        border: `1.5px dashed ${color}`,
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  value={pendingTag}
                  onChange={(e) => setPendingTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTimeblock();
                    if (e.key === "Escape") setPendingSlot(null);
                  }}
                  placeholder="New tag…"
                  className="h-7 text-xs flex-1 bg-background"
                />
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => handleCreateTimeblock()}
                  disabled={!pendingTag.trim()}
                >
                  Add
                </Button>
              </div>

              <button
                onClick={() => setPendingSlot(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center py-0.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {editingTb && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEditingTb(null)} />
          <div
            className="fixed z-50 bg-popover border shadow-2xl rounded-xl overflow-hidden w-64"
            style={{ left: editingTb.x, top: editingTb.y }}
          >
            <div className="px-4 pt-3.5 pb-2.5 border-b bg-muted/40">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ background: getTagColor(savedTags, editingTb.tag)[0] }}
                />
                <p className="text-xs font-semibold truncate">{editingTb.tag}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {format(editingTb.startTime, "h:mm a")} →{" "}
                {format(editingTb.endTime, "h:mm a")}
              </p>
            </div>

            <div className="p-3 flex flex-col gap-2.5">
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allTags
                    .filter((t) => t.tag !== editingTb.tag)
                    .slice(0, 9)
                    .map(({ tag, color }) => (
                      <button
                        key={tag}
                        onClick={() => {
                          editTimeblock(editingTb.id, { tag });
                          setEditingTb(null);
                        }}
                        className="px-2 py-0.5 rounded-full text-xs font-medium transition-transform hover:scale-105"
                        style={{
                          backgroundColor: colorWithAlpha(color, 0.12),
                          color,
                          border: `1.5px dashed ${color}`,
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                </div>
              )}

              <div className="flex gap-1.5">
                <Input
                  value={editTbTag}
                  onChange={(e) => setEditTbTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editTbTag.trim()) {
                      editTimeblock(editingTb.id, { tag: editTbTag.trim() });
                      setEditingTb(null);
                    }
                    if (e.key === "Escape") setEditingTb(null);
                  }}
                  placeholder="Rename tag…"
                  className="h-7 text-xs flex-1 bg-background"
                />
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    if (editTbTag.trim()) {
                      editTimeblock(editingTb.id, { tag: editTbTag.trim() });
                      setEditingTb(null);
                    }
                  }}
                  disabled={!editTbTag.trim() || editTbTag.trim() === editingTb.tag}
                >
                  Save
                </Button>
              </div>

              <button
                onClick={() => {
                  removeTimeblock(editingTb.id);
                  setEditingTb(null);
                }}
                className="flex items-center justify-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors w-full py-0.5"
              >
                <FaTrash className="size-2.5" />
                Delete block
              </button>

              <button
                onClick={() => setEditingTb(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center py-0.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <EditFocusSessionDialog
        session={selectedSession}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />

      <style jsx global>{`
        .gcal {
          height: 100%;
        }
        .gcal .rbc-calendar {
          font-family: inherit;
          height: 100%;
          background: transparent;
        }
        .gcal .rbc-toolbar,
        .gcal .rbc-allday-cell {
          display: none;
        }
        .gcal .rbc-time-view,
        .gcal .rbc-month-view {
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--card);
        }
        .gcal .rbc-time-header {
          border-bottom: 1px solid var(--border);
          background: var(--card);
        }
        .gcal .rbc-time-header.rbc-overflowing,
        .gcal .rbc-time-header-gutter,
        .gcal .rbc-time-header-content {
          border-right: 0;
          border-left: 0;
        }
        .gcal .rbc-header {
          border-bottom: 0;
          border-left: 1px solid var(--border);
          padding: 0;
          font-weight: 400;
          overflow: visible;
        }
        .gcal .rbc-header:first-child {
          border-left: 0;
        }
        .gcal .rbc-time-content {
          border-top: 0;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .gcal .rbc-time-content > .rbc-day-slot,
        .gcal .rbc-time-content > .rbc-time-gutter + * {
          border-left: 1px solid var(--border);
        }
        .gcal .rbc-timeslot-group {
          min-height: var(--row-h, 56px);
          border-bottom: 1px solid var(--border);
        }
        .gcal .rbc-day-slot .rbc-time-slot {
          border-top: 0;
        }
        .gcal .rbc-time-gutter {
          font-size: 0.68rem;
          font-family: var(--font-geist-mono, monospace);
          color: var(--muted-foreground);
          background: var(--card);
        }
        .gcal .rbc-time-gutter .rbc-timeslot-group {
          border-bottom: 0;
          text-align: right;
        }
        .gcal .rbc-time-gutter .rbc-label {
          display: inline-block;
          padding: 0 0.6rem 0 0.5rem;
          transform: translateY(-0.55em);
          background: var(--card);
          white-space: nowrap;
        }
        .gcal .rbc-time-gutter .rbc-timeslot-group:first-child .rbc-label {
          visibility: hidden;
        }
        .gcal .rbc-today {
          background: color-mix(in oklab, var(--primary) 6%, transparent);
        }
        .gcal .rbc-off-range-bg {
          background: color-mix(in oklab, var(--muted) 55%, transparent);
        }
        .gcal .rbc-current-time-indicator {
          background: #ea4335;
          height: 2px;
          z-index: 5;
        }
        .gcal .rbc-current-time-indicator::before {
          content: "";
          position: absolute;
          left: -5px;
          top: -4px;
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #ea4335;
        }
        .gcal .rbc-event {
          padding: 2px 7px;
          font-size: 0.75rem;
          font-weight: 500;
          line-height: 1.25;
          border-radius: 6px !important;
          border: none;
          outline: none !important;
          box-shadow: none !important;
          transition: box-shadow 0.12s ease;
        }
        .gcal .rbc-event:hover {
          box-shadow: 0 1px 8px rgb(0 0 0 / 0.3) !important;
        }
        .gcal .rbc-event:focus-visible,
        .gcal .rbc-selected {
          outline: 2px solid var(--ring) !important;
          outline-offset: 1px;
        }
        .gcal .rbc-event-label {
          font-size: 0.64rem;
          font-family: var(--font-geist-mono, monospace);
          opacity: 0.85;
        }
        .gcal .rbc-slot-selecting,
        .gcal .rbc-slot-selection {
          background: color-mix(in oklab, var(--primary) 14%, transparent);
          border: 1px dashed color-mix(in oklab, var(--primary) 55%, transparent);
          border-radius: 6px;
          color: var(--foreground);
          font-size: 0.68rem;
        }
        .gcal .rbc-month-row {
          border-top: 1px solid var(--border);
        }
        .gcal .rbc-month-row:first-child {
          border-top: 0;
        }
        .gcal .rbc-month-header .rbc-header {
          text-align: center;
        }
        .gcal .rbc-day-bg + .rbc-day-bg {
          border-left: 1px solid var(--border);
        }
        .gcal .rbc-date-cell {
          padding: 5px 6px 2px;
          text-align: center;
          font-size: 0.72rem;
          font-variant-numeric: tabular-nums;
        }
        .gcal .rbc-date-cell.rbc-now > .rbc-button-link {
          display: inline-grid;
          place-items: center;
          min-width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: var(--primary);
          color: var(--primary-foreground);
          font-weight: 600;
        }
        .gcal .rbc-off-range .rbc-button-link {
          color: var(--muted-foreground);
          opacity: 0.55;
        }
        .gcal .rbc-show-more {
          color: var(--muted-foreground);
          font-size: 0.68rem;
          font-weight: 600;
          background: transparent;
          padding-left: 6px;
        }
        .gcal .rbc-show-more:hover {
          color: var(--foreground);
        }
        .gcal .rbc-overlay {
          background: var(--popover);
          color: var(--popover-foreground);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 12px 32px rgb(0 0 0 / 0.24);
          padding: 8px;
        }
        .gcal .rbc-overlay-header {
          border-bottom: 1px solid var(--border);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 2px 4px 8px;
          margin-bottom: 6px;
        }
        .gcal .rbc-addons-dnd-drag-preview {
          opacity: 0.6;
        }
        .gcal .rbc-addons-dnd .rbc-addons-dnd-resize-ns-icon {
          border-color: currentColor;
          opacity: 0.5;
        }
        .gcal .rbc-time-content::-webkit-scrollbar {
          width: 8px;
        }
        .gcal .rbc-time-content::-webkit-scrollbar-thumb {
          background: color-mix(in oklab, var(--muted-foreground) 35%, transparent);
          border-radius: 9999px;
        }
        .gcal .rbc-time-content::-webkit-scrollbar-track {
          background: transparent;
        }
        @media (prefers-reduced-motion: reduce) {
          .gcal *,
          .gcal *::before {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
