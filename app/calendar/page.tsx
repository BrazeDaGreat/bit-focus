"use client";

import { useEffect, useMemo, useState, useCallback, type JSX } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useFocus, FocusSession } from "@/hooks/useFocus";
import { useTag } from "@/hooks/useTag";
import { getTagColor } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { EditFocusSessionDialog } from "@/components/EditFocusSessionDialog";

// Configure date-fns localizer for react-big-calendar
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday start
  getDay,
  locales,
});

// Calendar event interface
interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  tag: string;
  color: string;
  textColor: string;
}

/**
 * Calendar Page Component - Weekly Focus Session View
 *
 * Displays focus sessions in a Google Calendar-style weekly view.
 * Each session is shown as a time block with color-coding based on tags.
 */
export default function CalendarPage(): JSX.Element {
  const { theme } = useTheme();
  const { focusSessions, loadFocusSessions, loadingFocusSessions } = useFocus();
  const { savedTags } = useTag();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(
    null,
  );
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Load focus sessions on mount
  useEffect(() => {
    loadFocusSessions();
  }, [loadFocusSessions]);

  // Transform focus sessions into calendar events, merging nearby same-tag sessions
  const events: CalendarEvent[] = useMemo(() => {
    if (focusSessions.length === 0) return [];

    // Sort sessions by start time
    const sortedSessions = [...focusSessions].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    const mergedEvents: CalendarEvent[] = [];
    const GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

    let currentGroup: FocusSession[] = [sortedSessions[0]];

    for (let i = 1; i < sortedSessions.length; i++) {
      const prevSession = currentGroup[currentGroup.length - 1];
      const currSession = sortedSessions[i];

      const prevEnd = new Date(prevSession.endTime).getTime();
      const currStart = new Date(currSession.startTime).getTime();
      const gap = currStart - prevEnd;

      // Check if same tag and gap is less than 30 minutes
      if (
        currSession.tag === prevSession.tag &&
        gap >= 0 &&
        gap <= GAP_THRESHOLD_MS
      ) {
        // Add to current group
        currentGroup.push(currSession);
      } else {
        // Finalize current group and start a new one
        const groupStart = new Date(currentGroup[0].startTime);
        const groupEnd = new Date(
          currentGroup[currentGroup.length - 1].endTime,
        );
        const tag = currentGroup[0].tag;
        const [color, useWhiteText] = getTagColor(savedTags, tag);

        mergedEvents.push({
          id: currentGroup[0].id!,
          title: tag,
          start: groupStart,
          end: groupEnd,
          tag: tag,
          color: color,
          textColor: useWhiteText ? "#ffffff" : "#000000",
        });

        currentGroup = [currSession];
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
      const groupStart = new Date(currentGroup[0].startTime);
      const groupEnd = new Date(currentGroup[currentGroup.length - 1].endTime);
      const tag = currentGroup[0].tag;
      const [color, useWhiteText] = getTagColor(savedTags, tag);

      mergedEvents.push({
        id: currentGroup[0].id!,
        title: tag,
        start: groupStart,
        end: groupEnd,
        tag: tag,
        color: color,
        textColor: useWhiteText ? "#ffffff" : "#000000",
      });
    }

    return mergedEvents;
  }, [focusSessions, savedTags]);

  // Custom event styling based on tag color
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    return {
      style: {
        backgroundColor: event.color,
        color: event.textColor,
        borderRadius: "4px",
        border: "none",
        opacity: 0.9,
        display: "block",
        fontWeight: 500,
      },
    };
  }, []);

  // Navigate handlers
  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  // Handle event click - open edit dialog
  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      // Find the original focus session by ID
      const session = focusSessions.find((s) => s.id === event.id);
      if (session) {
        setSelectedSession(session);
        setIsEditDialogOpen(true);
      }
    },
    [focusSessions],
  );

  // Get unique tags that are visible in the current calendar view
  const visibleTags = useMemo(() => {
    // Create a map to store unique tags with their colors
    const tagMap = new Map<string, { tag: string; color: string }>();

    events.forEach((event) => {
      if (!tagMap.has(event.tag)) {
        tagMap.set(event.tag, {
          tag: event.tag,
          color: event.color,
        });
      }
    });

    // Convert map to array and sort alphabetically
    return Array.from(tagMap.values()).sort((a, b) =>
      a.tag.localeCompare(b.tag),
    );
  }, [events]);

  return (
    <div className={cn("flex-1 p-4 md:p-8 gap-8 flex flex-col")}>
      <Card className="w-full flex-grow flex flex-col">
        <CardTitle className="p-6 pb-2">Focus Calendar</CardTitle>
        <CardDescription className="px-6 pb-4">
          Weekly view of your focus sessions. Each block represents a focus
          session, colored by tag.
        </CardDescription>
        <CardContent className="p-2 md:p-6 pt-0 flex-grow flex flex-col">
          <div
            className={cn(
              "calendar-container flex-grow",
              theme === "dark" ||
                theme === "amoled" ||
                theme === "bluenight" ||
                theme === "amethyst" ||
                theme === "amethystoverloaded"
                ? "calendar-dark"
                : "",
            )}
            style={{ minHeight: "600px" }}
          >
            {loadingFocusSessions ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Loading sessions...</p>
              </div>
            ) : (
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                defaultView={Views.WEEK}
                views={[Views.WEEK, Views.DAY, Views.MONTH]}
                date={currentDate}
                onNavigate={handleNavigate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                dayLayoutAlgorithm="no-overlap"
                step={30}
                timeslots={4}
                min={new Date(1970, 1, 1, 0, 0, 0)} // Start at 5 AM
                max={new Date(1970, 1, 1, 23, 59, 59)} // End at midnight
                tooltipAccessor={(event) =>
                  `${event.tag}\n${format(event.start, "h:mm a")} - ${format(event.end, "h:mm a")}`
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legend showing tag colors for visible tags in current view */}
      {visibleTags.length > 0 && (
        <Card className="w-full">
          <CardTitle className="p-6 pb-2 text-base">Tag Legend</CardTitle>
          <CardContent className="p-6 pt-2">
            <div className="flex flex-wrap gap-3">
              {visibleTags.map((tagInfo) => (
                <div key={tagInfo.tag} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: tagInfo.color }}
                  />
                  <span className="text-sm">{tagInfo.tag}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Focus Session Dialog */}
      <EditFocusSessionDialog
        session={selectedSession}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />

      {/* Calendar custom styles */}
      <style jsx global>{`
        .calendar-container .rbc-calendar {
          font-family: inherit;
        }

        .calendar-container .rbc-toolbar {
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .calendar-container .rbc-toolbar button {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          border: 1px solid var(--border);
          background: var(--muted);
          color: var(--foreground);
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .calendar-container .rbc-toolbar button:hover {
          background: var(--accent);
          border-color: var(--accent);
          transform: translateY(-1px);
          box-shadow: 0 2px 4px oklch(0 0 0 / 0.1);
        }

        .calendar-container .rbc-toolbar button.rbc-active {
          background: var(--primary);
          color: var(--primary-foreground);
          border-color: var(--primary);
          font-weight: 600;
        }

        .calendar-container .rbc-header {
          padding: 0.3rem 0.2rem;
          font-weight: 600;
          border-bottom: 1px solid var(--border);
        }

        .calendar-container .rbc-time-header-content {
          border-left: 1px solid oklch(from var(--border) l c h / 0.3);
        }

        .calendar-container .rbc-time-content {
          border-top: 1px solid var(--border);
        }

        /* Hourly divisions - make these more prominent */
        .calendar-container .rbc-timeslot-group {
          border-bottom: 1px solid oklch(from var(--border) l c h / 0.6);
          min-height: 60px;
        }

        /* Individual time slots within each hour - subtle lines */
        .calendar-container .rbc-time-slot {
          border-top: 1px solid oklch(from var(--border) l c h / 0.15);
        }

        /* Override for day slots to ensure visibility */
        .calendar-container .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid oklch(from var(--border) l c h / 0.15);
        }

        /* Make vertical day separators more subtle */
        .calendar-container .rbc-events-container {
          border-left: 1px solid oklch(from var(--border) l c h / 1);
        }

        .calendar-container .rbc-time-view {
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .calendar-container .rbc-month-view {
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .calendar-container .rbc-month-row {
          border-bottom: 1px solid var(--border);
        }

        .calendar-container .rbc-day-bg {
          border-left: 1px solid oklch(from var(--border) l c h / 0.3);
        }

        .calendar-container .rbc-off-range-bg {
          background: oklch(from var(--muted) l c h / 0.3);
        }

        .calendar-container .rbc-today {
          background: oklch(from var(--primary) l c h / 0.1);
        }

        .calendar-container .rbc-current-time-indicator {
          background-color: var(--destructive);
          height: 2px;
        }

        .calendar-container .rbc-event {
          padding: 2px 5px;
          font-size: 0.8rem;
        }

        .calendar-container .rbc-event-label {
          font-size: 0.75rem;
        }

        .calendar-container .rbc-time-gutter {
          font-size: 0.75rem;
          color: var(--muted-foreground);
        }

        .calendar-container .rbc-label {
          padding: 0 0.5rem;
        }

        /* Dark theme adjustments */
        .calendar-dark .rbc-toolbar button {
          background: var(--card);
        }

        .calendar-dark .rbc-time-view,
        .calendar-dark .rbc-month-view {
          background: var(--card);
        }

        .calendar-dark .rbc-header {
          background: oklch(from var(--muted) l c h / 0.3);
        }

        .calendar-dark .rbc-time-gutter {
          background: var(--card);
        }

        .calendar-dark .rbc-day-slot .rbc-events-container {
          margin-right: 0;
        }
      `}</style>
    </div>
  );
}
