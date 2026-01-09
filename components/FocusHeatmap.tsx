/**
 * FocusHeatmap Component - Calendar Heatmap for Focus Sessions
 *
 * Displays a GitHub-style contribution heatmap showing focus activity
 * for an entire year. Each cell represents a day and its intensity
 * reflects the total focus time relative to your personal maximum.
 *
 * Features:
 * - Full year calendar view (52 weeks)
 * - Year navigation controls
 * - Dynamic intensity based on user's data distribution
 * - Theme-aware colors
 * - Hover tooltips with detailed info
 * - Streak tracking
 *
 * @fileoverview Calendar heatmap visualization for focus sessions
 * @author BIT Focus Development Team
 * @since v0.14.0-beta
 */

"use client";

import { FocusSession, useFocus } from "@/hooks/useFocus";
import { durationFromSeconds, formatTimeNew } from "@/lib/utils";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FaFire, FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { useMemo, useState, type JSX } from "react";
import dayjs from "dayjs";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DotIcon } from "lucide-react";

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
const CELL_SIZE_MOBILE = 8;
const CELL_SIZE_DESKTOP = 10;
const CELL_GAP = 2;
const MONTH_LABEL_HEIGHT = 16;
const MONTH_LABEL_MARGIN_LEFT_MOBILE = 20;
const MONTH_LABEL_MARGIN_LEFT_DESKTOP = 28;
const DAY_LABEL_MARGIN_RIGHT_MOBILE = 4;
const DAY_LABEL_MARGIN_RIGHT_DESKTOP = 6;
const DAY_LABEL_FONT_SIZE_MOBILE = 7;
const DAY_LABEL_FONT_SIZE_DESKTOP = 9;
const DAY_LABEL_WIDTH_MOBILE = 16;
const DAY_LABEL_WIDTH_DESKTOP = 24;

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
  // Theme-aware colors are now handled via CSS variables
  const currentYear = dayjs().year();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Helper to get the right color based on theme using CSS variables
  const getColor = (level: number): string => {
    switch (level) {
      case 0:
        return "color-mix(in srgb, var(--chart-1) 5%, transparent)"; // Empty cell
      case 1:
        return "color-mix(in srgb, var(--chart-1) 20%, transparent)";
      case 2:
        return "color-mix(in srgb, var(--chart-1) 40%, transparent)";
      case 3:
        return "color-mix(in srgb, var(--chart-1) 60%, transparent)";
      case 4:
        return "color-mix(in srgb, var(--chart-1) 80%, transparent)";
      case 5:
        return "color-mix(in srgb, var(--chart-1) 90%, transparent)";
      case 6:
        return "var(--chart-1)"; // Full intensity
      default:
        return "var(--secondary)";
    }
  };

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

  // Calculate current streak (only for current year)
  const currentStreak = useMemo(() => {
    if (selectedYear !== currentYear) return 0;

    let streak = 0;
    const today = dayjs().startOf("day");
    let checkDate = today;

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
      <Card className="px-4 py-6 w-full">
        <CardTitle className="flex gap-2 items-center mb-4">
          <FaFire />
          <span>Focus Activity</span>
        </CardTitle>
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  return (
    <Card className="px-4 py-6 w-full overflow-hidden">
      <CardTitle className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between mb-4">
        <div className="flex gap-2 items-center">
          <FaFire />
          <span>Focus Activity</span>
        </div>

        {/* Year Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedYear(y => y - 1)}
            disabled={!canGoPrev}
          >
            <FaChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-sm font-semibold min-w-[4rem] text-center">
            {selectedYear}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedYear(y => y + 1)}
            disabled={!canGoNext}
          >
            <FaChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardTitle>

      {/* Stats Row */}
      <div className="flex gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground mb-4">
        <span>
          {formatTimeNew(durationFromSeconds(totalFocusTime), "H:M:S", "text")} total
        </span>
        {maxSeconds > 0 && (
          <>
            <span> <DotIcon /> </span>
            <span>
              Best: {formatTimeNew(durationFromSeconds(maxSeconds), "H:M:S", "text")}
            </span>
          </>
        )}
        {currentStreak > 0 && selectedYear === currentYear && (
          <>
            <span> <DotIcon /> </span>
            <span className="flex items-center gap-1">
              <FaFire className="text-balance" />
              {currentStreak} day streak
            </span>
          </>
        )}
      </div>

      <CardDescription>
        <TooltipProvider delayDuration={100}>
          <div className="flex flex-col w-full">
            <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
              <div className="min-w-max">
                {/* Month labels */}
                <div
                  className="flex mb-1 relative"
                style={{
                  marginLeft: isMobile
                    ? `${MONTH_LABEL_MARGIN_LEFT_MOBILE}px`
                    : `${MONTH_LABEL_MARGIN_LEFT_DESKTOP}px`,
                  height: `${MONTH_LABEL_HEIGHT}px`,
                }}
              >
              {monthPositions.map((pos, idx) => (
                <div
                  key={`${pos.month}-${idx}`}
                  className="text-xs text-muted-foreground absolute"
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
                className="flex flex-col text-xs text-muted-foreground shrink-0"
                style={{
                  gap: `${cellGap}px`,
                  marginRight: isMobile
                    ? `${DAY_LABEL_MARGIN_RIGHT_MOBILE}px`
                    : `${DAY_LABEL_MARGIN_RIGHT_DESKTOP}px`,
                }}
              >
                {DAY_LABELS.map((day, idx) => (
                  <div
                    key={day}
                    className="flex items-center justify-end"
                    style={{
                      height: `${cellSize}px`,
                      fontSize: isMobile
                        ? `${DAY_LABEL_FONT_SIZE_MOBILE}px`
                        : `${DAY_LABEL_FONT_SIZE_DESKTOP}px`,
                      width: isMobile
                        ? `${DAY_LABEL_WIDTH_MOBILE}px`
                        : `${DAY_LABEL_WIDTH_DESKTOP}px`,
                    }}
                  >
                    {idx % 2 === 1 ? (isMobile ? day[0] : day) : ""}
                  </div>
                ))}
              </div>

              {/* Weeks grid */}
              <div
                className="flex"
                style={{ gap: `${cellGap}px` }}
              >
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
                              height: `${cellSize}px`
                            }}
                          />
                        ))}
                    {week.map((day) => {
                      const isInYear = dayjs(day.date).year() === selectedYear;
                      const intensity = isInYear
                        ? getIntensityLevel(day.totalSeconds, maxSeconds)
                        : -1; // Outside year
                      const formattedDate = dayjs(day.date).format("ddd, MMM D, YYYY");
                      const formattedTime =
                        day.totalSeconds > 0
                          ? formatTimeNew(
                              durationFromSeconds(day.totalSeconds),
                              "H:M:S",
                              "text"
                            )
                          : "No focus time";

                      // Don't render days outside the selected year
                      if (!isInYear) {
                        return (
                          <div
                            key={day.date.toISOString()}
                            style={{
                              width: `${cellSize}px`,
                              height: `${cellSize}px`
                            }}
                          />
                        );
                      }

                      return (
                        <Tooltip key={day.date.toISOString()}>
                          <TooltipTrigger asChild>
                            <div
                              className="rounded-sm cursor-pointer transition-all hover:ring-1 hover:ring-foreground/30"
                              style={{
                                width: `${cellSize}px`,
                                height: `${cellSize}px`,
                                backgroundColor: getColor(intensity)
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-semibold">{formattedDate}</p>
                            <p>{formattedTime}</p>
                            {day.sessionCount > 0 && (
                              <p className="text-secondary">
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

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex" style={{ gap: `${cellGap}px` }}>
                {[0, 1, 2, 3, 4, 5, 6].map((level) => (
                  <div
                    key={level}
                    className="rounded-sm"
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      backgroundColor: getColor(level)
                    }}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        </TooltipProvider>
      </CardDescription>
    </Card>
  );
}
