/**
 * FocusHeatmap Component - Calendar Heatmap for Focus Sessions
 *
 * A year of focus activity as a day grid. Each cell is one day; its fill is the
 * day's total focus time measured against the best day in that year.
 *
 * The component is shell-less on purpose: it renders no card, title, or border
 * of its own so the page that uses it owns the framing. It supplies only its
 * own controls — the year stepper, a summary strip, the grid, and the legend.
 *
 * @fileoverview Calendar heatmap visualization for focus sessions
 * @author BIT Focus Development Team
 * @since v0.14.0-beta
 */

"use client";

import { FocusSession, useFocus } from "@/hooks/useFocus";
import { cn, durationFromSeconds, formatTimeNew } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FaFire, FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { useMemo, useState, type JSX, type ReactNode } from "react";
import dayjs from "dayjs";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Day data structure for heatmap cells
 */
interface DayData {
  date: Date;
  totalSeconds: number;
  sessionCount: number;
}

/**
 * Calculates focus data aggregated by day for a specific year
 *
 * @param sessions - Array of focus sessions
 * @param year - Year to aggregate data for
 * @returns Map of date strings to day data
 */
function aggregateFocusByDay(
  sessions: FocusSession[],
  year: number
): Map<string, DayData> {
  const dayMap = new Map<string, DayData>();

  // Get the first day of the year and find the Sunday of that week
  const yearStart = dayjs().year(year).startOf("year");
  const startDate = yearStart.startOf("week");

  // Get the last day of the year and find the Saturday of that week
  const yearEnd = dayjs().year(year).endOf("year");
  const endDate = yearEnd.endOf("week");

  // Initialize all days in range
  let current = startDate;
  while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
    const dateKey = current.format("YYYY-MM-DD");
    dayMap.set(dateKey, {
      date: current.toDate(),
      totalSeconds: 0,
      sessionCount: 0,
    });
    current = current.add(1, "day");
  }

  // Aggregate sessions into days
  sessions.forEach((session) => {
    const sessionDate = dayjs(session.startTime).format("YYYY-MM-DD");
    const existing = dayMap.get(sessionDate);

    if (existing) {
      const durationSeconds = Math.floor(
        (session.endTime.getTime() - session.startTime.getTime()) / 1000
      );
      existing.totalSeconds += durationSeconds;
      existing.sessionCount += 1;
    }
  });

  return dayMap;
}

/**
 * Calculates intensity level (0-6) based on focus time relative to max
 * Level 0 = 0 minutes, Level 6 = max time, Level 3 = midway
 *
 * @param seconds - Total seconds focused
 * @param maxSeconds - Maximum seconds in the dataset
 * @returns Intensity level 0-6
 */
function getIntensityLevel(seconds: number, maxSeconds: number): number {
  if (seconds === 0) return 0;
  if (maxSeconds === 0) return 0;

  // Calculate percentage of max
  const percentage = seconds / maxSeconds;

  // Map to 6 levels (1-6, with 0 reserved for no activity)
  if (percentage >= INTENSITY_THRESHOLD_LEVEL_6) return 6;
  if (percentage >= INTENSITY_THRESHOLD_LEVEL_5) return 5;
  if (percentage >= INTENSITY_THRESHOLD_LEVEL_4) return 4; // Midway
  if (percentage >= INTENSITY_THRESHOLD_LEVEL_3) return 3;
  if (percentage >= INTENSITY_THRESHOLD_LEVEL_2) return 2;
  return 1; // Any activity > 0
}

/**
 * Layout constants
 */
const CELL_SIZE_MOBILE = 9;
const CELL_SIZE_DESKTOP = 11;
const CELL_GAP = 3;
const CELL_RADIUS = 3;
const MONTH_LABEL_HEIGHT = 16;
const DAY_LABEL_MARGIN_RIGHT = 6;
const DAY_LABEL_WIDTH_MOBILE = 18;
const DAY_LABEL_WIDTH_DESKTOP = 26;

/**
 * Get day name abbreviation
 */
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Month abbreviations
 */
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Intensity thresholds for heatmap levels
 */
const INTENSITY_THRESHOLD_LEVEL_6 = 0.9;
const INTENSITY_THRESHOLD_LEVEL_5 = 0.6;
const INTENSITY_THRESHOLD_LEVEL_4 = 0.3;
const INTENSITY_THRESHOLD_LEVEL_3 = 0.15;
const INTENSITY_THRESHOLD_LEVEL_2 = 0.075;

/** Fill for one intensity step. Level 0 is the resting surface, not a faint tint. */
function levelColor(level: number): string {
  switch (level) {
    case 0:
      return "var(--muted)";
    case 1:
      return "color-mix(in srgb, var(--chart-1) 22%, var(--muted))";
    case 2:
      return "color-mix(in srgb, var(--chart-1) 40%, var(--muted))";
    case 3:
      return "color-mix(in srgb, var(--chart-1) 58%, var(--muted))";
    case 4:
      return "color-mix(in srgb, var(--chart-1) 76%, var(--muted))";
    case 5:
      return "color-mix(in srgb, var(--chart-1) 88%, var(--muted))";
    case 6:
      return "var(--chart-1)";
    default:
      return "var(--muted)";
  }
}

/** Small rounded fact shown above the grid. */
function SummaryChip({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
        accent
          ? "bg-primary/12 font-medium text-primary"
          : "bg-muted/60 text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

/**
 * FocusHeatmap Component
 *
 * Renders a calendar-style heatmap showing focus activity for a full year.
 * Intensity is calculated relative to the user's maximum daily focus time.
 *
 * @component
 * @returns {JSX.Element} The heatmap visualization
 */
export default function FocusHeatmap(): JSX.Element {
  const { focusSessions, loadingFocusSessions } = useFocus();
  const isMobile = useIsMobile();
  const currentYear = dayjs().year();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Aggregate focus data by day for selected year
  const dayData = useMemo(
    () => aggregateFocusByDay(focusSessions, selectedYear),
    [focusSessions, selectedYear]
  );

  // Find max seconds for intensity scaling
  const maxSeconds = useMemo(() => {
    let max = 0;
    dayData.forEach((data) => {
      if (data.totalSeconds > max) max = data.totalSeconds;
    });
    return max;
  }, [dayData]);

  // Organize data into weeks (columns) and days (rows)
  const weeks = useMemo(() => {
    const result: DayData[][] = [];
    const sortedDays = Array.from(dayData.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    let currentWeek: DayData[] = [];

    sortedDays.forEach((day) => {
      const dayOfWeek = dayjs(day.date).day();

      // Start new week on Sunday
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        result.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(day);
    });

    // Push last week if not empty
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [dayData]);

  // Calculate total focus time for the year
  const totalFocusTime = useMemo(() => {
    let total = 0;
    dayData.forEach((data) => {
      // Only count days in the selected year
      if (dayjs(data.date).year() === selectedYear) {
        total += data.totalSeconds;
      }
    });
    return total;
  }, [dayData, selectedYear]);

  // Days with any activity, for the "active days" chip
  const activeDays = useMemo(() => {
    let count = 0;
    dayData.forEach((data) => {
      if (dayjs(data.date).year() === selectedYear && data.totalSeconds > 0) {
        count++;
      }
    });
    return count;
  }, [dayData, selectedYear]);

  // Calculate current streak (only for current year)
  const currentStreak = useMemo(() => {
    if (selectedYear !== currentYear) return 0;

    let streak = 0;
    let checkDate = dayjs().startOf("day");

    while (true) {
      const dateKey = checkDate.format("YYYY-MM-DD");
      const data = dayData.get(dateKey);

      if (data && data.totalSeconds > 0) {
        streak++;
        checkDate = checkDate.subtract(1, "day");
      } else {
        break;
      }
    }

    return streak;
  }, [dayData, selectedYear, currentYear]);

  // Calculate month positions for labels
  const monthPositions = useMemo(() => {
    const positions: { month: string; startWeek: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIdx) => {
      // Check the first day of each week that's in our target year
      const firstDayInYear = week.find(d => dayjs(d.date).year() === selectedYear);
      if (firstDayInYear) {
        const month = dayjs(firstDayInYear.date).month();
        if (month !== lastMonth) {
          positions.push({ month: MONTH_LABELS[month], startWeek: weekIdx });
          lastMonth = month;
        }
      }
    });

    return positions;
  }, [weeks, selectedYear]);

  // Cell size based on screen - smaller for full year view
  const cellSize = isMobile ? CELL_SIZE_MOBILE : CELL_SIZE_DESKTOP;
  const cellGap = CELL_GAP;
  const dayLabelWidth = isMobile ? DAY_LABEL_WIDTH_MOBILE : DAY_LABEL_WIDTH_DESKTOP;
  const gridOffset = dayLabelWidth + DAY_LABEL_MARGIN_RIGHT;

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    focusSessions.forEach((session) => {
      years.add(dayjs(session.startTime).year());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [focusSessions, currentYear]);

  const canGoNext = selectedYear < currentYear;
  const canGoPrev = availableYears.includes(selectedYear - 1) || selectedYear > currentYear - 5;

  if (loadingFocusSessions) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-56 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex w-full flex-col">
        {/* ── Summary + year stepper ── */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <SummaryChip>
              <span className="font-mono">
                {formatTimeNew(durationFromSeconds(totalFocusTime), "H:M:S", "text")}
              </span>
              focused
            </SummaryChip>
            {activeDays > 0 && (
              <SummaryChip>
                <span className="font-mono">{activeDays}</span>
                active {activeDays === 1 ? "day" : "days"}
              </SummaryChip>
            )}
            {maxSeconds > 0 && (
              <SummaryChip>
                Best day
                <span className="font-mono">
                  {formatTimeNew(durationFromSeconds(maxSeconds), "H:M:S", "text")}
                </span>
              </SummaryChip>
            )}
            {currentStreak > 0 && selectedYear === currentYear && (
              <SummaryChip accent>
                <FaFire className="size-3" />
                <span className="font-mono">{currentStreak}</span>
                day streak
              </SummaryChip>
            )}
          </div>

          <div className="flex items-center gap-0.5 rounded-xl bg-muted/60 p-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg hover:bg-background"
              onClick={() => setSelectedYear((y) => y - 1)}
              disabled={!canGoPrev}
              aria-label="Previous year"
            >
              <FaChevronLeft className="size-3" />
            </Button>
            <span className="min-w-[3.25rem] text-center font-mono text-sm font-medium">
              {selectedYear}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg hover:bg-background"
              onClick={() => setSelectedYear((y) => y + 1)}
              disabled={!canGoNext}
              aria-label="Next year"
            >
              <FaChevronRight className="size-3" />
            </Button>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
          <div className="min-w-max">
            {/* Month labels */}
            <div
              className="relative mb-1.5 flex"
              style={{
                marginLeft: `${gridOffset}px`,
                height: `${MONTH_LABEL_HEIGHT}px`,
              }}
            >
              {monthPositions.map((pos, idx) => (
                <div
                  key={`${pos.month}-${idx}`}
                  className="absolute text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70"
                  style={{
                    left: `${pos.startWeek * (cellSize + cellGap)}px`,
                  }}
                >
                  {pos.month}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex">
              {/* Day labels */}
              <div
                className="flex shrink-0 flex-col text-muted-foreground/70"
                style={{
                  gap: `${cellGap}px`,
                  marginRight: `${DAY_LABEL_MARGIN_RIGHT}px`,
                }}
              >
                {DAY_LABELS.map((day, idx) => (
                  <div
                    key={day}
                    className="flex items-center justify-end text-[9px]"
                    style={{
                      height: `${cellSize}px`,
                      width: `${dayLabelWidth}px`,
                    }}
                  >
                    {idx % 2 === 1 ? (isMobile ? day[0] : day) : ""}
                  </div>
                ))}
              </div>

              {/* Weeks grid */}
              <div className="flex" style={{ gap: `${cellGap}px` }}>
                {weeks.map((week, weekIdx) => (
                  <div
                    key={weekIdx}
                    className="flex flex-col"
                    style={{ gap: `${cellGap}px` }}
                  >
                    {/* Pad first week if needed */}
                    {weekIdx === 0 &&
                      week.length < 7 &&
                      Array(7 - week.length)
                        .fill(null)
                        .map((_, idx) => (
                          <div
                            key={`pad-${idx}`}
                            style={{
                              width: `${cellSize}px`,
                              height: `${cellSize}px`,
                            }}
                          />
                        ))}
                    {week.map((day) => {
                      const isInYear = dayjs(day.date).year() === selectedYear;

                      // Days outside the selected year keep their slot empty so
                      // the grid stays aligned week to week.
                      if (!isInYear) {
                        return (
                          <div
                            key={day.date.toISOString()}
                            style={{
                              width: `${cellSize}px`,
                              height: `${cellSize}px`,
                            }}
                          />
                        );
                      }

                      const intensity = getIntensityLevel(
                        day.totalSeconds,
                        maxSeconds
                      );
                      const isToday = dayjs(day.date).isSame(dayjs(), "day");
                      const formattedDate = dayjs(day.date).format("ddd, MMM D, YYYY");
                      const formattedTime =
                        day.totalSeconds > 0
                          ? formatTimeNew(
                              durationFromSeconds(day.totalSeconds),
                              "H:M:S",
                              "text"
                            )
                          : "No focus time";

                      return (
                        <Tooltip key={day.date.toISOString()}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "cursor-pointer transition-shadow duration-150 hover:ring-2 hover:ring-foreground/25",
                                isToday && "ring-1 ring-foreground/40"
                              )}
                              style={{
                                width: `${cellSize}px`,
                                height: `${cellSize}px`,
                                borderRadius: `${CELL_RADIUS}px`,
                                backgroundColor: levelColor(intensity),
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="rounded-lg text-xs">
                            <p className="font-semibold">{formattedDate}</p>
                            <p>{formattedTime}</p>
                            {day.sessionCount > 0 && (
                              <p className="opacity-70">
                                {day.sessionCount} session
                                {day.sessionCount !== 1 ? "s" : ""}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground/70">
          <span>Less</span>
          <div className="flex" style={{ gap: `${cellGap}px` }}>
            {[0, 1, 2, 3, 4, 5, 6].map((level) => (
              <div
                key={level}
                style={{
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  borderRadius: `${CELL_RADIUS}px`,
                  backgroundColor: levelColor(level),
                }}
              />
            ))}
          </div>
          <span>More</span>
        </div>

        {totalFocusTime === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            No sessions recorded in {selectedYear}.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
