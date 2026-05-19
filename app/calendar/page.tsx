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
  FaFilter,
  FaTrash,
  FaRegClock,
  FaMagnifyingGlassMinus,
  FaMagnifyingGlass,
  FaMagnifyingGlassPlus,
} from "react-icons/fa6";

// ── localizer ─────────────────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(Calendar as any);

// Custom layout: timeblocks always full-width underneath, focus events use no-overlap
const timeblocksFirstLayout: DayLayoutFunction<CalendarEvent> = ({
  events,
  minimumStartDifference,
  slotMetrics,
  accessors,
}) => {
  const focusEvts = events.filter((e) => !e.isTimeblock);
  const tbEvts = events.filter((e) => e.isTimeblock);

  type StyledEvent = { event: CalendarEvent; style: { top: number; height: number; width: number; xOffset: number } };

  // No-overlap layout for actual focus sessions
  const focusStyled: StyledEvent[] = focusEvts.length
    ? (getStyledEvents({
        events: focusEvts,
        minimumStartDifference,
        slotMetrics,
        accessors,
        dayLayoutAlgorithm: "no-overlap",
      }) as StyledEvent[])
    : [];

  // Full-width background positions for timeblocks
  const tbStyled: StyledEvent[] = tbEvts.map((event) => {
    const { top, height } = (slotMetrics as { getRange: (s: Date, e: Date) => { top: number; height: number } }).getRange(
      (accessors as { start: (e: CalendarEvent) => Date }).start(event),
      (accessors as { end: (e: CalendarEvent) => Date }).end(event)
    );
    return { event, style: { top, height, width: 100, xOffset: 0 } };
  });

  // Timeblocks first → renders behind focus events (DOM order = paint order)
  return [...tbStyled, ...focusStyled];
};

// ── types ─────────────────────────────────────────────────────────────────────

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

const ZOOM_CONFIG: Record<ZoomLevel, { height: number; step: number; timeslots: number }> = {
  compact:  { height: 1000, step: 30, timeslots: 2 },
  normal:   { height: 1600, step: 15, timeslots: 4 },
  expanded: { height: 2600, step: 15, timeslots: 4 },
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

// ── helpers ───────────────────────────────────────────────────────────────────

function getPeriodRange(date: Date, view: CalView) {
  if (view === "day")
    return { start: startOfDay(date), end: endOfDay(date) };
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
  if (s.getMonth() === e.getMonth())
    return `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`;
  return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
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
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  return color;
}

// ── Calendar Page ─────────────────────────────────────────────────────────────

export default function CalendarPage(): JSX.Element {
  const { theme } = useTheme();
  const { focusSessions, loadFocusSessions, loadingFocusSessions } = useFocus();
  const { savedTags } = useTag();
  const { timeblocks, loadTimeblocks, addTimeblock, editTimeblock, removeTimeblock } = useTimeblocks();
  const isMobile = useIsMobile();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalView>("week");
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("normal");
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showTimeblocks, setShowTimeblocks] = useState(true);

  // Pending slot popup (create)
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);
  const [pendingTag, setPendingTag] = useState("");

  // Editing existing timeblock popup
  const [editingTb, setEditingTb] = useState<EditingTb | null>(null);
  const [editTbTag, setEditTbTag] = useState("");

  // Track mouse position for popup placement
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

  // ── Focus event building (merged + split) ──────────────────────────────────

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

  // ── Filtered focus events ──────────────────────────────────────────────────

  const focusEvents = useMemo(
    () => allFocusEvents.filter((e) => !hiddenTags.has(e.tag)),
    [allFocusEvents, hiddenTags]
  );

  // ── Timeblock events ───────────────────────────────────────────────────────

  const timeblocksCalEvents = useMemo<CalendarEvent[]>(() => {
    if (!showTimeblocks || currentView === "month") return [];
    return timeblocks.map((tb): CalendarEvent => {
      const [solidColor, white] = getTagColor(savedTags, tb.tag);
      return {
        id: tb.id!,
        title: tb.tag || "Time Block",
        start: new Date(tb.startTime),
        end: new Date(tb.endTime),
        tag: tb.tag,
        color: solidColor,
        textColor: white ? "#ffffff" : "#000000",
        isTimeblock: true,
      };
    });
  }, [timeblocks, savedTags, showTimeblocks, currentView]);

  // ── Combined events ────────────────────────────────────────────────────────

  const allCalEvents = useMemo(
    () => [...focusEvents, ...timeblocksCalEvents],
    [focusEvents, timeblocksCalEvents]
  );

  // ── All unique tags from focus sessions ────────────────────────────────────

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    allFocusEvents.forEach((e) => {
      if (!map.has(e.tag)) map.set(e.tag, e.color);
    });
    return Array.from(map.entries())
      .map(([tag, color]) => ({ tag, color }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [allFocusEvents]);

  // ── Period stats ───────────────────────────────────────────────────────────

  const periodStats = useMemo(() => {
    const { start, end } = getPeriodRange(currentDate, currentView);
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
  }, [focusSessions, currentDate, currentView, hiddenTags]);

  // ── Popup position helper ──────────────────────────────────────────────────

  const clampPopupPos = useCallback((rawX: number, rawY: number) => ({
    x: Math.max(10, Math.min(rawX + 12, window.innerWidth - 275)),
    y: Math.max(10, Math.min(rawY - 10, window.innerHeight - 310)),
  }), []);

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleEventDrop = useCallback(
    ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      if (!event.isTimeblock) return;
      editTimeblock(event.id, {
        startTime: new Date(start),
        endTime: new Date(end),
      });
    },
    [editTimeblock]
  );

  const handleEventResize = useCallback(
    ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      if (!event.isTimeblock) return;
      editTimeblock(event.id, {
        startTime: new Date(start),
        endTime: new Date(end),
      });
    },
    [editTimeblock]
  );

  // ── Slot selection (drag-to-create) ───────────────────────────────────────

  const handleSelectSlot = useCallback(
    (slot: SlotInfo) => {
      if (currentView === "month") return;
      if (slot.action !== "select") return;
      const { x, y } = clampPopupPos(
        lastMousePos.current.x,
        lastMousePos.current.y
      );
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

  // ── Event click handler ───────────────────────────────────────────────────

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      if (event.isTimeblock) {
        const tb = timeblocks.find((t) => t.id === event.id);
        if (!tb) return;
        const { x, y } = clampPopupPos(
          lastMousePos.current.x,
          lastMousePos.current.y
        );
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

  // ── Event style ───────────────────────────────────────────────────────────

  const eventStyleGetter = useCallback(
    (event: CalendarEvent) => {
      if (event.isTimeblock) {
        const solidColor = event.color;
        const bg = colorWithAlpha(solidColor, 0.18);
        return {
          style: {
            backgroundColor: bg,
            color: solidColor,
            borderRadius: "6px",
            border: `2px dashed ${solidColor}`,
            opacity: 1,
            fontWeight: 600,
            fontSize: "0.7rem",
            letterSpacing: "0.02em",
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
          opacity: 0.9,
          zIndex: 2,
        },
      };
    },
    []
  );

  const draggableAccessor = useCallback((e: CalendarEvent) => e.isTimeblock, []);
  const resizableAccessor = useCallback((e: CalendarEvent) => e.isTimeblock, []);

  // ── Theme ─────────────────────────────────────────────────────────────────

  const isDark =
    theme === "dark" ||
    theme === "amoled" ||
    theme === "bluenight" ||
    theme === "amethyst" ||
    theme === "amethystoverloaded";

  const periodLabel = getPeriodLabel(currentDate, currentView);
  const statsLabel =
    currentView === "day" ? "Today" : currentView === "week" ? "This Week" : "This Month";

  // ── Tag toggle ────────────────────────────────────────────────────────────

  const toggleTag = (tag: string) => {
    setHiddenTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  // ── Filter panel ──────────────────────────────────────────────────────────

  const FilterPanelContent = () => (
    <div className="flex flex-col gap-4">
      {/* Tags */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Tags
        </p>
        {allTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {allTags.map(({ tag, color }) => {
              const active = !hiddenTags.has(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="flex items-center gap-2 py-1.5 text-sm cursor-pointer rounded-md px-1 hover:bg-accent/50 transition-colors w-full text-left"
                >
                  <span
                    className="size-3.5 rounded-sm shrink-0 border transition-all"
                    style={{
                      backgroundColor: active ? color : "transparent",
                      borderColor: color,
                    }}
                  />
                  <span
                    className={cn(
                      "text-sm transition-colors",
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

      {/* Timeblocks toggle */}
      {currentView !== "month" && (
        <div className="border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Timeblocks
          </p>
          <button
            onClick={() => setShowTimeblocks((v) => !v)}
            className="flex items-center gap-2 py-1.5 text-sm cursor-pointer rounded-md px-1 hover:bg-accent/50 transition-colors w-full text-left"
          >
            <span
              className={cn(
                "size-3.5 rounded-sm shrink-0 border-2 transition-all",
                showTimeblocks ? "border-primary" : "border-muted-foreground"
              )}
              style={{
                background: showTimeblocks
                  ? "repeating-linear-gradient(45deg, hsl(var(--primary)) 0px, hsl(var(--primary)) 2px, transparent 2px, transparent 6px)"
                  : "transparent",
              }}
            />
            <span className={cn("text-sm", showTimeblocks ? "text-foreground" : "text-muted-foreground line-through")}>
              Show planned
            </span>
          </button>
          {showTimeblocks && timeblocksCalEvents.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1 pl-1">
              {timeblocksCalEvents.length} block{timeblocksCalEvents.length !== 1 ? "s" : ""}
            </p>
          )}
          {showTimeblocks && (
            <p className="text-xs text-muted-foreground/70 mt-2 pl-1 leading-snug">
              Drag empty area to plan time
            </p>
          )}
        </div>
      )}

      {/* Period stats */}
      <div className="border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          {statsLabel}
        </p>
        <p className="text-2xl font-mono font-semibold tracking-tight">
          {periodStats.total}
        </p>
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {periodStats.count} session{periodStats.count !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">Avg: {periodStats.avg}</p>
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between py-2 mb-4 border-b pb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate((d) => navigate(d, currentView, -1))}
            className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Previous"
          >
            <FaChevronLeft className="size-3" />
          </button>
          <span className="text-xl font-semibold tracking-tight min-w-40 text-center">
            {periodLabel}
          </span>
          <button
            onClick={() => setCurrentDate((d) => navigate(d, currentView, 1))}
            className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Next"
          >
            <FaChevronRight className="size-3" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
            {(["day", "week", "month"] as CalView[]).map((v) => (
              <button
                key={v}
                onClick={() => setCurrentView(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full transition-colors capitalize",
                  currentView === v
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Zoom selector */}
          <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
            {(
              [
                { level: "compact" as ZoomLevel,  Icon: FaMagnifyingGlassMinus, label: "Compact"  },
                { level: "normal"  as ZoomLevel,  Icon: FaMagnifyingGlass,      label: "Normal"   },
                { level: "expanded" as ZoomLevel, Icon: FaMagnifyingGlassPlus,  label: "Expanded" },
              ] as const
            ).map(({ level, Icon, label }) => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                title={label}
                className={cn(
                  "size-7 flex items-center justify-center rounded-full transition-colors",
                  zoomLevel === level
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3" />
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="rounded-full px-4 text-xs h-8"
          >
            Today
          </Button>

          {isMobile && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="size-8 rounded-full">
                  <FaFilter className="size-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-4">
                <FilterPanelContent />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-0">
        {!isMobile && (
          <div className="w-48 shrink-0 border-r pr-5 mr-5 sticky top-6 self-start">
            <FilterPanelContent />
          </div>
        )}

        <div
          suppressHydrationWarning
          className={cn("calendar-container flex-1", isDark && "calendar-dark")}
          style={{ height: ZOOM_CONFIG[zoomLevel].height }}
        >
          {loadingFocusSessions ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
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
              onEventResize={handleEventResize as (args: EventInteractionArgs<object>) => void}
              onSelectSlot={handleSelectSlot}
              selectable={currentView !== "month"}
              draggableAccessor={draggableAccessor as (event: object) => boolean}
              resizableAccessor={resizableAccessor as (event: object) => boolean}
              resizable
              eventPropGetter={eventStyleGetter as (event: object) => { style: React.CSSProperties }}
              dayLayoutAlgorithm={timeblocksFirstLayout as DayLayoutFunction<object>}
              step={ZOOM_CONFIG[zoomLevel].step}
              timeslots={ZOOM_CONFIG[zoomLevel].timeslots}
              tooltipAccessor={(event) => {
                const ev = event as CalendarEvent;
                const prefix = ev.isTimeblock ? "⏱ Planned: " : "";
                return `${prefix}${ev.tag}\n${format(ev.start, "h:mm a")} – ${format(ev.end, "h:mm a")}`;
              }}
              getNow={() => new Date()}
              min={startOfDay(new Date())}
              max={endOfDay(new Date())}
              components={{ toolbar: () => null }}
            />
          )}
        </div>
      </div>

      {/* ── Create Timeblock Popup ─────────────────────────────────────────── */}
      {pendingSlot && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPendingSlot(null)}
          />
          <div
            className="fixed z-50 bg-popover border border-border shadow-2xl rounded-xl overflow-hidden w-64"
            style={{ left: pendingSlot.x, top: pendingSlot.y }}
          >
            {/* Header strip */}
            <div className="px-4 pt-3.5 pb-2.5 border-b border-border/60 bg-muted/30">
              <div className="flex items-center gap-2">
                <FaRegClock className="size-3 text-muted-foreground shrink-0" />
                <p className="text-xs font-semibold text-foreground">Plan Time Block</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {format(pendingSlot.start, "h:mm a")} → {format(pendingSlot.end, "h:mm a")}
              </p>
            </div>

            <div className="p-3 flex flex-col gap-2.5">
              {/* Quick-pick from existing tags */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allTags.slice(0, 10).map(({ tag, color }) => (
                    <button
                      key={tag}
                      onClick={() => handleCreateTimeblock(tag)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: colorWithAlpha(color, 0.15),
                        color: color,
                        border: `1.5px dashed ${color}`,
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom tag input */}
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

      {/* ── Edit Timeblock Popup ───────────────────────────────────────────── */}
      {editingTb && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setEditingTb(null)}
          />
          <div
            className="fixed z-50 bg-popover border border-border shadow-2xl rounded-xl overflow-hidden w-64"
            style={{ left: editingTb.x, top: editingTb.y }}
          >
            {/* Header */}
            <div className="px-4 pt-3.5 pb-2.5 border-b border-border/60 bg-muted/30">
              <div className="flex items-center gap-2">
                {(() => {
                  const [solidColor] = getTagColor(savedTags, editingTb.tag);
                  return (
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ background: solidColor }}
                    />
                  );
                })()}
                <p className="text-xs font-semibold text-foreground truncate">
                  {editingTb.tag}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {format(editingTb.startTime, "h:mm a")} → {format(editingTb.endTime, "h:mm a")}
              </p>
            </div>

            <div className="p-3 flex flex-col gap-2.5">
              {/* Re-assign to different tag */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allTags.filter((t) => t.tag !== editingTb.tag).slice(0, 9).map(({ tag, color }) => (
                    <button
                      key={tag}
                      onClick={() => {
                        editTimeblock(editingTb.id, { tag });
                        setEditingTb(null);
                      }}
                      className="px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                      style={{
                        backgroundColor: colorWithAlpha(color, 0.12),
                        color: color,
                        border: `1.5px dashed ${color}`,
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {/* Rename to custom tag */}
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

              {/* Delete */}
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

      {/* Edit Session Dialog */}
      <EditFocusSessionDialog
        session={selectedSession}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />

      {/* ── CSS overrides ─────────────────────────────────────────────────── */}
      <div className="hidden">
        <style jsx global>{`
        .calendar-container .rbc-calendar {
          font-family: inherit;
          height: 100%;
        }
        .calendar-container .rbc-toolbar {
          display: none;
        }
        .calendar-container .rbc-time-gutter {
          font-size: 0.7rem;
          font-family: var(--font-geist-mono, monospace);
          color: hsl(var(--muted-foreground));
        }
        .calendar-container .rbc-label {
          padding: 0 0.5rem;
        }
        .calendar-container .rbc-header {
          padding: 0.4rem 0.25rem;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: hsl(var(--muted-foreground));
          border-bottom: 1px solid hsl(var(--border));
        }
        .calendar-container .rbc-time-content {
          overflow-y: hidden !important;
        }
        .calendar-container .rbc-timeslot-group {
          border-bottom: 1px solid hsl(var(--border) / 0.6);
          min-height: 40px;
        }
        .calendar-container .rbc-time-slot {
          border-top: 1px solid hsl(var(--border) / 0.12);
        }
        .calendar-container .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid hsl(var(--border) / 0.12);
        }
        .calendar-container .rbc-time-content {
          border-top: 1px solid hsl(var(--border));
        }
        .calendar-container .rbc-time-header-content {
          border-left: 1px solid hsl(var(--border) / 0.3);
        }
        .calendar-container .rbc-events-container {
          border-left: 1px solid hsl(var(--border));
        }
        .calendar-container .rbc-day-bg {
          border-left: 1px solid hsl(var(--border) / 0.3);
        }
        .calendar-container .rbc-time-view,
        .calendar-container .rbc-month-view {
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .calendar-container .rbc-month-row {
          border-bottom: 1px solid hsl(var(--border));
        }
        .calendar-container .rbc-today {
          background: hsl(var(--accent) / 0.2);
        }
        .calendar-container .rbc-off-range-bg {
          background: hsl(var(--muted) / 0.3);
        }
        .calendar-container .rbc-current-time-indicator {
          display: none;
        }
        .calendar-container .rbc-event {
          padding: 2px 6px;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: 6px !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .calendar-container .rbc-event:focus {
          outline: none;
        }
        .calendar-container .rbc-event-label {
          font-size: 0.65rem;
          font-family: var(--font-geist-mono, monospace);
          opacity: 0.85;
        }
        .calendar-container .rbc-selected {
          outline: 2px solid hsl(var(--primary)) !important;
          outline-offset: 1px;
        }
        .calendar-container .rbc-show-more {
          color: hsl(var(--primary));
          font-size: 0.7rem;
          font-weight: 600;
        }
        /* Timeblock events: allow dashed border to show through */
        .calendar-container .rbc-event[style*="dashed"] {
          border: inherit !important;
          box-shadow: none !important;
          outline: none !important;
        }
        /* Timeblock z-index: behind focus events */
        .calendar-container .rbc-event[style*="z-index: 0"],
        .calendar-container .rbc-event[style*="zIndex: 0"] {
          z-index: 0 !important;
        }
        /* DnD drag ghost */
        .calendar-container .rbc-addons-dnd-drag-preview {
          opacity: 0.65;
        }
        /* Resize handle styling */
        .calendar-container .rbc-addons-dnd-resize-ns-anchor {
          opacity: 0.7;
        }
        /* Dark theme */
        .calendar-dark .rbc-time-view,
        .calendar-dark .rbc-month-view {
          background: hsl(var(--card));
        }
        .calendar-dark .rbc-header {
          background: hsl(var(--muted) / 0.3);
        }
        .calendar-dark .rbc-time-gutter {
          background: hsl(var(--card));
        }
        .calendar-dark .rbc-day-slot .rbc-events-container {
          margin-right: 0;
        }
        /* Slot selection highlight */
        .calendar-container .rbc-slot-selecting {
          background: hsl(var(--primary) / 0.08);
          border: 1px dashed hsl(var(--primary) / 0.4);
        }
      `}</style>
      </div>
    </div>
  );
}
