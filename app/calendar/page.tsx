"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type JSX,
} from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
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
import { useFocus, FocusSession } from "@/hooks/useFocus";
import { useTag } from "@/hooks/useTag";
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { FaChevronLeft, FaChevronRight, FaFilter } from "react-icons/fa6";

// ── localizer ─────────────────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

// ── types ─────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  tag: string;
  color: string;
  textColor: string;
}

type CalView = "day" | "week" | "month";

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

// ── Calendar Page ─────────────────────────────────────────────────────────────

export default function CalendarPage(): JSX.Element {
  const { theme } = useTheme();
  const { focusSessions, loadFocusSessions, loadingFocusSessions } = useFocus();
  const { savedTags } = useTag();
  const isMobile = useIsMobile();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalView>("week");
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    loadFocusSessions();
  }, [loadFocusSessions]);

  // ── Event building (merged + split) ────────────────────────────────────────

  const allEvents = useMemo<CalendarEvent[]>(() => {
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

    // Split events crossing day boundaries
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

  // ── Filtered events ────────────────────────────────────────────────────────

  const events = useMemo(
    () => allEvents.filter((e) => !hiddenTags.has(e.tag)),
    [allEvents, hiddenTags]
  );

  // ── All unique tags ────────────────────────────────────────────────────────

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    allEvents.forEach((e) => {
      if (!map.has(e.tag)) map.set(e.tag, e.color);
    });
    return Array.from(map.entries())
      .map(([tag, color]) => ({ tag, color }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [allEvents]);

  // ── Period stats ───────────────────────────────────────────────────────────

  const periodStats = useMemo(() => {
    const { start, end } = getPeriodRange(currentDate, currentView);
    const inPeriod = focusSessions.filter((s) => {
      const t = new Date(s.startTime).getTime();
      return (
        t >= start.getTime() &&
        t <= end.getTime() &&
        !hiddenTags.has(s.tag)
      );
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const eventStyleGetter = useCallback((event: CalendarEvent) => ({
    style: {
      backgroundColor: event.color,
      color: event.textColor,
      borderRadius: "6px",
      border: "none",
      opacity: 0.9,
    },
  }), []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    const session = focusSessions.find((s) => s.id === event.id);
    if (session) {
      setSelectedSession(session);
      setIsEditDialogOpen(true);
    }
  }, [focusSessions]);

  const toggleTag = (tag: string) => {
    setHiddenTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const isDark =
    theme === "dark" ||
    theme === "amoled" ||
    theme === "bluenight" ||
    theme === "amethyst" ||
    theme === "amethystoverloaded";

  const periodLabel = getPeriodLabel(currentDate, currentView);
  const statsLabel =
    currentView === "day" ? "Today" : currentView === "week" ? "This Week" : "This Month";

  // ── Filter panel content (shared between sidebar and popover) ──────────────

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
                  {/* Colored square checkbox */}
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
          <p className="text-xs text-muted-foreground">
            Avg: {periodStats.avg}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ── Header Bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-2 mb-4 border-b pb-4 gap-3 flex-wrap">
        {/* Left: date navigation */}
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
          {/* View segmented control */}
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

          {/* Today pill */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="rounded-full px-4 text-xs h-8"
          >
            Today
          </Button>

          {/* Mobile: filter popover trigger */}
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

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="flex gap-0 flex-1 min-h-0">
        {/* Filter panel — desktop only */}
        {!isMobile && (
          <div className="w-48 shrink-0 border-r pr-5 mr-5">
            <FilterPanelContent />
          </div>
        )}

        {/* Calendar */}
        <div
          className={cn(
            "calendar-container flex-1 min-h-0",
            isDark && "calendar-dark"
          )}
          style={{ height: "calc(100vh - 240px)", minHeight: 480 }}
        >
          {loadingFocusSessions ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading sessions…
            </div>
          ) : (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={currentView as View}
              onView={(v) => setCurrentView(v as CalView)}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              dayLayoutAlgorithm="no-overlap"
              step={30}
              timeslots={4}
              min={new Date(1970, 1, 1, 0, 0, 0)}
              max={new Date(1970, 1, 1, 23, 59, 59)}
              tooltipAccessor={(event) =>
                `${event.tag}\n${format(event.start, "h:mm a")} – ${format(event.end, "h:mm a")}`
              }
              components={{ toolbar: () => null }}
            />
          )}
        </div>
      </div>

      {/* Edit Session Dialog */}
      <EditFocusSessionDialog
        session={selectedSession}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />

      {/* ── Calendar CSS overrides ────────────────────────────────────── */}
      <div className="hidden">
        <style jsx global>{`
        .calendar-container .rbc-calendar {
          font-family: inherit;
          height: 100%;
        }

        /* Hide the built-in toolbar (we supply our own) */
        .calendar-container .rbc-toolbar {
          display: none;
        }

        /* ── Time gutter ── */
        .calendar-container .rbc-time-gutter {
          font-size: 0.7rem;
          font-family: var(--font-geist-mono, monospace);
          color: hsl(var(--muted-foreground));
        }
        .calendar-container .rbc-label {
          padding: 0 0.5rem;
        }

        /* ── Header row (day names) ── */
        .calendar-container .rbc-header {
          padding: 0.4rem 0.25rem;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: hsl(var(--muted-foreground));
          border-bottom: 1px solid hsl(var(--border));
        }

        /* ── Grid lines ── */
        .calendar-container .rbc-timeslot-group {
          border-bottom: 1px solid hsl(var(--border) / 0.6);
          min-height: 60px;
        }
        .calendar-container .rbc-time-slot {
          border-top: 1px solid hsl(var(--border) / 0.15);
        }
        .calendar-container .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid hsl(var(--border) / 0.15);
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

        /* ── Rounded views ── */
        .calendar-container .rbc-time-view,
        .calendar-container .rbc-month-view {
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .calendar-container .rbc-month-row {
          border-bottom: 1px solid hsl(var(--border));
        }

        /* ── Today highlight ── */
        .calendar-container .rbc-today {
          background: hsl(var(--accent) / 0.2);
        }
        .calendar-container .rbc-off-range-bg {
          background: hsl(var(--muted) / 0.3);
        }

        /* ── Current time indicator ── */
        .calendar-container .rbc-current-time-indicator {
          background-color: hsl(var(--primary));
          height: 2px;
        }

        /* ── Events ── */
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

        /* ── Remove default blue from month dots ── */
        .calendar-container .rbc-show-more {
          color: hsl(var(--primary));
          font-size: 0.7rem;
          font-weight: 600;
        }

        /* ── Dark theme ── */
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
      `}</style>
      </div>
    </div>
  );
}
