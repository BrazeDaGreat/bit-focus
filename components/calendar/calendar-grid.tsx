"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type CalendarProps,
  type EventProps,
  type SlotInfo,
} from "react-big-calendar";
import withDragAndDrop, {
  type DragFromOutsideItemArgs,
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import {
  format,
  getDay,
  isSameDay,
  parse,
  startOfDay,
  startOfWeek,
  endOfDay,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { minutesBetween, pomodoroHint } from "@/lib/timeblocks";
import {
  softTag,
  timeblocksFirstLayout,
  ZOOM,
  type CalendarEvent,
  type CalendarView,
  type ZoomLevel,
} from "./calendar-shared";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});
const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar<CalendarEvent>);

function DayHeader({ date }: { date: Date }) {
  return (
    <span className="flex flex-col items-center gap-1 py-3">
      <span className="text-[11px] text-muted-foreground">
        {format(date, "EEE")}
      </span>
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg font-mono text-lg tabular-nums",
          isSameDay(date, new Date()) &&
            "bg-primary/12 font-semibold text-primary",
        )}
      >
        {format(date, "d")}
      </span>
    </span>
  );
}

function CalendarEventContent({
  event,
  settings,
  month,
}: EventProps<CalendarEvent> & {
  settings: { focusDuration: number; breakDuration: number };
  month: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.contentRect.height),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const hint = pomodoroHint(minutesBetween(event.start, event.end), settings);
  if (event.kind === "deadline")
    return <div className="truncate text-[11px]">{event.title}</div>;
  if (event.kind === "session")
    return (
      <div
        ref={ref}
        className="h-full overflow-hidden"
        aria-label={`Focus session: ${event.title}`}
        title={`${event.title} · ${format(event.start, "h:mm a")} – ${format(event.end, "h:mm a")}`}
      >
        {(month || height >= 64) && (
          <span
            className={cn(
              "block truncate text-[10px] leading-none",
              !month && "[writing-mode:vertical-rl]",
            )}
          >
            {event.title}
          </span>
        )}
      </div>
    );
  return (
    <div
      ref={ref}
      className="h-full overflow-hidden"
      data-occurrence-key={event.occurrence?.key}
    >
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {event.title}
        </span>
        {event.occurrence?.recurring && (
          <Repeat2
            aria-label="Repeating block"
            className="size-3 shrink-0 opacity-60"
          />
        )}
      </div>
      {height >= 35 && (
        <p className="mt-1 truncate font-mono text-[10px] tabular-nums opacity-65">
          {format(event.start, "HH:mm")}–{format(event.end, "HH:mm")}
        </p>
      )}
      {height >= 58 && hint && (
        <p className="mt-1 truncate font-mono text-[10px] tabular-nums opacity-65">
          {hint.label}
        </p>
      )}
    </div>
  );
}

interface GridProps {
  events: CalendarEvent[];
  date: Date;
  view: CalendarView;
  zoom: ZoomLevel;
  settings: { focusDuration: number; breakDuration: number };
  loading: boolean;
  highlight: string | null;
  scrollTo: Date;
  draggedEvent: CalendarEvent | null;
  onDate: (date: Date) => void;
  onView: (view: CalendarView) => void;
  onSelect: (
    event: CalendarEvent,
    eventDetails: React.SyntheticEvent<HTMLElement>,
  ) => void;
  onSlot: (slot: SlotInfo) => void;
  onMove: (args: EventInteractionArgs<CalendarEvent>) => void;
  onOutsideDrop: (args: DragFromOutsideItemArgs) => void;
}

export function CalendarGrid({
  events,
  date,
  view,
  zoom,
  settings,
  loading,
  highlight,
  scrollTo,
  draggedEvent,
  onDate,
  onView,
  onSelect,
  onSlot,
  onMove,
  onOutsideDrop,
}: GridProps) {
  const components = useMemo<CalendarProps<CalendarEvent>["components"]>(
    () => ({
      event: (props) => (
        <CalendarEventContent
          {...props}
          settings={settings}
          month={view === "month"}
        />
      ),
      week: { header: DayHeader },
      day: { header: DayHeader },
      month: {
        header: ({ date: day }) => (
          <span className="block py-3 text-xs text-muted-foreground">
            {format(day, "EEE")}
          </span>
        ),
      },
    }),
    [settings, view],
  );
  return (
    <main
      aria-label="Calendar"
      className="gcal min-h-0 min-w-0 flex-1 overflow-auto px-2 pb-3 md:pr-4"
      style={{ "--row-h": `${ZOOM[zoom]}px` } as CSSProperties}
    >
      {loading ? (
        <div
          className="h-full min-h-96 rounded-2xl bg-muted/40 p-4"
          role="status"
          aria-label="Loading calendar"
        >
          <div className="mb-4 h-16 rounded-xl bg-muted/60" />
          <div className="grid h-3/4 grid-cols-7 gap-3">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="rounded-xl bg-muted/40" />
            ))}
          </div>
        </div>
      ) : (
        <DnDCalendar
          localizer={localizer}
          events={events}
          date={date}
          view={view}
          views={["day", "week", "month"]}
          onNavigate={onDate}
          onView={(value) => onView(value as CalendarView)}
          toolbar={false}
          startAccessor="start"
          endAccessor="end"
          allDayAccessor="allDay"
          onSelectEvent={onSelect}
          onKeyPressEvent={(event, details) => {
            const key = (details.nativeEvent as KeyboardEvent).key;
            if (key === "Enter" || key === " ") {
              details.preventDefault();
              onSelect(event, details);
            }
          }}
          onSelectSlot={onSlot}
          selectable={view === "month" ? false : "ignoreEvents"}
          onEventDrop={onMove}
          onEventResize={onMove}
          draggableAccessor={(event) => event.kind === "block"}
          resizableAccessor={(event) => event.kind === "block"}
          resizable
          dragFromOutsideItem={draggedEvent ? () => draggedEvent : undefined}
          onDropFromOutside={draggedEvent ? onOutsideDrop : undefined}
          onDragOver={(event) => {
            if (draggedEvent && view !== "month") event.preventDefault();
          }}
          dayLayoutAlgorithm={timeblocksFirstLayout}
          showMultiDayTimes
          popup
          step={15}
          timeslots={4}
          scrollToTime={scrollTo}
          min={startOfDay(date)}
          max={endOfDay(date)}
          components={components}
          formats={{
            timeGutterFormat: (day) => format(day, "h a"),
            eventTimeRangeFormat: () => "",
          }}
          tooltipAccessor={(event) =>
            `${event.kind === "block" ? "Planned" : event.kind === "session" ? "Focus session" : "Task deadline"} · ${event.title}\n${format(event.start, "EEE HH:mm")} – ${format(event.end, "HH:mm")}`
          }
          eventPropGetter={(event) => ({
            className: cn(
              `calendar-${event.kind}`,
              highlight &&
                event.occurrence?.key === highlight &&
                "calendar-highlight",
            ),
            style:
              event.kind === "block"
                ? {
                    background: softTag(event.color),
                    color: "var(--foreground)",
                    borderInlineStart: `3px solid ${event.color}`,
                  }
                : event.kind === "session"
                  ? {
                      background: event.color,
                      color: event.whiteText ? "#ffffff" : "#000000",
                    }
                  : {
                      background: "var(--muted)",
                      color: "var(--muted-foreground)",
                    },
          })}
        />
      )}
      <style jsx global>{`
        .gcal .rbc-calendar {
          min-height: 450px;
          height: 100%;
          font-family: inherit;
          background: transparent;
        }
        .gcal .rbc-time-view,
        .gcal .rbc-month-view {
          border: 0;
          border-radius: 16px;
          overflow: hidden;
          background: var(--card);
        }
        .gcal .rbc-time-header,
        .gcal .rbc-time-header-content,
        .gcal .rbc-time-header.rbc-overflowing {
          border: 0;
        }
        .gcal .rbc-header {
          border-bottom: 0;
          border-left: 0;
          padding: 0;
          font-weight: 400;
        }
        .gcal .rbc-allday-cell {
          min-height: 25px;
          padding: 3px 0;
        }
        .gcal .rbc-time-header .rbc-row-content {
          min-height: 25px;
        }
        .gcal .rbc-time-content {
          border-top: 1px solid
            color-mix(in srgb, var(--border) 65%, transparent);
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .gcal .rbc-time-content > * + * > *,
        .gcal .rbc-day-bg + .rbc-day-bg {
          border-left: 1px solid
            color-mix(in srgb, var(--border) 45%, transparent);
        }
        .gcal .rbc-timeslot-group {
          min-height: var(--row-h);
          border-bottom: 1px solid
            color-mix(in srgb, var(--border) 55%, transparent);
        }
        .gcal .rbc-day-slot .rbc-time-slot {
          border-top: 0;
        }
        .gcal .rbc-day-slot .rbc-time-slot:nth-child(3) {
          border-top: 1px solid
            color-mix(in srgb, var(--border) 18%, transparent);
        }
        .gcal .rbc-time-gutter {
          font-family: var(--font-geist-mono), monospace;
          font-size: 10px;
          font-variant-numeric: tabular-nums;
          color: var(--muted-foreground);
        }
        .gcal .rbc-time-gutter .rbc-timeslot-group {
          border-bottom: 0;
          text-align: right;
        }
        .gcal .rbc-time-gutter .rbc-label {
          display: inline-block;
          padding: 0 10px;
          transform: translateY(-0.5em);
        }
        .gcal .rbc-time-gutter .rbc-timeslot-group:first-child .rbc-label {
          visibility: hidden;
        }
        .gcal .rbc-today {
          background: color-mix(in srgb, var(--primary) 3%, transparent);
        }
        .gcal .rbc-current-time-indicator {
          background: var(--primary);
          height: 2px;
          z-index: 4;
        }
        .gcal .rbc-current-time-indicator::before {
          content: "";
          position: absolute;
          left: -3px;
          top: -2px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--primary);
        }
        .gcal .rbc-day-slot .rbc-events-container {
          margin-right: 4px;
        }
        .gcal .rbc-event {
          border: 0;
          border-radius: 8px;
          padding: 4px 6px;
          font-size: 12px;
          line-height: 1.3;
          box-shadow: none;
        }
        .gcal .rbc-day-slot .rbc-event {
          border: 0;
        }
        .gcal .rbc-day-slot .calendar-block {
          border-inline-start-width: 3px;
          border-inline-start-style: solid;
        }
        .gcal .rbc-event-content {
          height: 100%;
        }
        .gcal .rbc-event-label {
          display: none;
        }
        .gcal .calendar-session {
          padding: 3px 0;
          border-radius: 5px;
        }
        .gcal .calendar-deadline {
          padding: 3px 6px;
          font-weight: 400;
        }
        .gcal .rbc-event:focus-visible,
        .gcal .rbc-selected,
        .gcal .calendar-highlight {
          outline: 2px solid var(--ring);
          outline-offset: 1px;
        }
        .gcal .rbc-slot-selection {
          background: color-mix(in srgb, var(--primary) 14%, transparent);
          color: var(--foreground);
          border-radius: 8px;
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
        }
        .gcal .rbc-month-row {
          border-top: 1px solid
            color-mix(in srgb, var(--border) 55%, transparent);
        }
        .gcal .rbc-month-row:first-child {
          border-top: 0;
        }
        .gcal .rbc-date-cell {
          padding: 7px;
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          font-variant-numeric: tabular-nums;
        }
        .gcal .rbc-date-cell.rbc-now .rbc-button-link {
          border-radius: 8px;
          background: color-mix(in srgb, var(--primary) 12%, transparent);
          color: var(--primary);
          padding: 3px 6px;
        }
        .gcal .rbc-off-range-bg {
          background: color-mix(in srgb, var(--muted) 30%, transparent);
        }
        .gcal .rbc-off-range {
          color: var(--muted-foreground);
        }
        .gcal .rbc-show-more {
          background: transparent;
          color: var(--muted-foreground);
          font-size: 11px;
          font-weight: 400;
        }
        .gcal .rbc-overlay {
          z-index: 20;
          max-width: min(90vw, 420px);
          background: var(--popover);
          color: var(--popover-foreground);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 12px;
          box-shadow: 0 1px 2px
            color-mix(in srgb, var(--foreground) 6%, transparent);
        }
        .gcal .rbc-overlay-header {
          border: 0;
          padding: 0 0 8px;
          font-size: 12px;
        }
        .gcal .rbc-month-view .calendar-session {
          padding: 3px 6px;
        }
        .gcal .rbc-addons-dnd-drag-preview {
          opacity: 0.6;
        }
        .gcal .rbc-addons-dnd .rbc-addons-dnd-resize-ns-icon {
          border-color: currentColor;
          opacity: 0.4;
        }
        .gcal .rbc-button-link:focus-visible {
          outline: 2px solid var(--ring);
          border-radius: 8px;
        }
        @media (max-width: 767px) {
          .gcal .rbc-time-view,
          .gcal .rbc-month-view {
            min-width: 650px;
          }
          .gcal
            .rbc-time-view:has(
              .rbc-time-header-content > .rbc-row > .rbc-header:only-child
            ) {
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}
