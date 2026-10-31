"use client";

import { useMemo, useRef, type KeyboardEvent } from "react";
import { addDays, format, isSameDay, isSameMonth, startOfDay } from "date-fns";
import { dayKey } from "@/lib/timeblocks";
import { cn, reduceSessions } from "@/lib/utils";
import {
  durationLabel,
  renderRange,
  type MonthOverviewProps,
} from "./calendar-shared";

interface DaySummary {
  day: Date;
  seconds: number;
  tags: Map<string, number>;
  planned: number;
  due: string[];
}

// Keep genuinely short sessions distinguishable from days without any focus.
function focusLabel(seconds: number) {
  return seconds < 30 ? "<1m" : durationLabel(seconds / 60);
}

export function MonthOverview({
  month,
  sessions,
  occurrences,
  deadlines,
  tagColor,
  onOpenDay,
  onContextTarget,
}: MonthOverviewProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const { days, monthSeconds, activeDays, topTags } = useMemo(() => {
    const range = renderRange(month, "month");
    const byDay = new Map<string, DaySummary>();
    for (let day = range.start; day < range.end; day = addDays(day, 1)) {
      byDay.set(dayKey(day), {
        day,
        seconds: 0,
        tags: new Map(),
        planned: 0,
        due: [],
      });
    }

    // Attribute overnight focus to its start day, matching the month totals.
    for (const session of sessions) {
      const summary = byDay.get(dayKey(new Date(session.startTime)));
      if (!summary) continue;
      const seconds = reduceSessions([session]);
      if (!Number.isFinite(seconds) || seconds <= 0) continue;
      summary.seconds += seconds;
      summary.tags.set(session.tag, (summary.tags.get(session.tag) ?? 0) + seconds);
    }

    // A plan that crosses midnight counts on each day it actually overlaps.
    for (const occurrence of occurrences) {
      const first = startOfDay(
        new Date(Math.max(+occurrence.start, +range.start)),
      );
      for (
        let day = first;
        day < occurrence.end && day < range.end;
        day = addDays(day, 1)
      ) {
        const summary = byDay.get(dayKey(day));
        if (summary) summary.planned += 1;
      }
    }
    for (const deadline of deadlines) {
      byDay.get(dayKey(deadline.start))?.due.push(deadline.title);
    }

    const days = Array.from(byDay.values());
    const monthTags = new Map<string, number>();
    let monthSeconds = 0;
    let activeDays = 0;
    for (const summary of days) {
      if (!isSameMonth(summary.day, month) || summary.seconds <= 0) continue;
      monthSeconds += summary.seconds;
      activeDays += 1;
      for (const [tag, seconds] of summary.tags) {
        monthTags.set(tag, (monthTags.get(tag) ?? 0) + seconds);
      }
    }
    const topTags = Array.from(monthTags)
      .sort(
        ([a, aSeconds], [b, bSeconds]) =>
          bSeconds - aSeconds || a.localeCompare(b),
      )
      .slice(0, 3);
    return { days, monthSeconds, activeDays, topTags };
  }, [month, sessions, occurrences, deadlines]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = index - 1;
        break;
      case "ArrowRight":
        next = index + 1;
        break;
      case "ArrowUp":
        next = index - 7;
        break;
      case "ArrowDown":
        next = index + 7;
        break;
      case "Home":
        next = index - (index % 7);
        break;
      case "End":
        next = index + 6 - (index % 7);
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons.current[Math.max(0, Math.min(days.length - 1, next))]?.focus();
  }

  const today = new Date();
  return (
    <div
      className="@container flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden"
      role="group"
      aria-label={`${format(month, "MMMM yyyy")} overview`}
    >
      {monthSeconds > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 px-2 py-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
              {focusLabel(monthSeconds)}
            </span>
            <span className="text-xs text-muted-foreground">
              focused this month
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{activeDays}</span>{" "}
            active {activeDays === 1 ? "day" : "days"}
          </span>
          <div className="ml-auto hidden min-w-0 max-w-[45%] items-center gap-3 @min-[760px]:flex">
            {topTags.map(([tag]) => (
              <span
                key={tag}
                className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                title={tag || "Untagged"}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tagColor(tag) }}
                  aria-hidden="true"
                />
                <span className="truncate">{tag || "Untagged"}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-xl bg-muted/40 p-1">
        <div className="sticky top-0 z-10 grid shrink-0 grid-cols-7 gap-1 rounded-lg bg-background py-2 text-center text-[11px] text-muted-foreground">
          {days.slice(0, 7).map(({ day }) => (
            <span key={dayKey(day)} title={format(day, "EEEE")}>
              <span className="@min-[600px]:hidden" aria-hidden="true">
                {format(day, "EEEEE")}
              </span>
              <span className="sr-only @min-[600px]:not-sr-only">
                {format(day, "EEE")}
              </span>
            </span>
          ))}
        </div>
        <div
          className="grid flex-1 grid-cols-7 gap-1 pt-1 [--month-row-min:76px] @min-[600px]:[--month-row-min:136px]"
          style={{
            gridTemplateRows: `repeat(${days.length / 7}, minmax(var(--month-row-min), 1fr))`,
          }}
        >
          {days.map(({ day, seconds, tags, planned, due }, index) => {
            const inMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, today);
            const details = [
              seconds > 0 ? `${focusLabel(seconds)} focused` : "No focus recorded",
              ...(planned > 0 ? [`${planned} planned`] : []),
              ...(due.length > 0 ? [`${due.length} due`] : []),
            ];
            const label = `${format(day, "EEEE, MMMM d, yyyy")}: ${details.join(", ")}`;
            return (
              <button
                key={dayKey(day)}
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                type="button"
                className={cn(
                  "flex min-w-0 flex-col items-start gap-2 rounded-lg p-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-safe:transition-colors motion-safe:duration-150 @min-[600px]:p-3",
                  inMonth ? "bg-background/70 text-foreground" : "text-muted-foreground",
                )}
                aria-label={due.length ? `${label}. First deadline: ${due[0]}` : label}
                aria-current={isToday ? "date" : undefined}
                title={due.length ? `${label}. First deadline: ${due[0]}` : label}
                onClick={() => onOpenDay(day)}
                onContextMenu={() =>
                  onContextTarget({ kind: "slot", day, time: null })
                }
                onKeyDown={(event) => moveFocus(event, index)}
              >
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs tabular-nums @min-[600px]:size-7",
                    isToday && "bg-primary/12 font-semibold text-primary",
                    !inMonth && !isToday && "opacity-60",
                  )}
                >
                  {format(day, "d")}
                </span>
                {seconds > 0 && (
                  <>
                    <span
                      className={cn(
                        "ml-2 size-1.5 rounded-full bg-primary @min-[600px]:hidden",
                        !inMonth && "opacity-40",
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "hidden w-full min-w-0 @min-[600px]:block",
                        !inMonth && "opacity-60",
                      )}
                      aria-hidden="true"
                    >
                      <span className="block truncate font-mono text-sm font-medium tabular-nums">
                        {focusLabel(seconds)}
                      </span>
                      <span className="mt-2 flex h-1 w-full overflow-hidden rounded-full">
                        {Array.from(tags)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([tag, tagSeconds]) => (
                            <span
                              key={tag}
                              className="h-full"
                              style={{
                                width: `${(tagSeconds / seconds) * 100}%`,
                                backgroundColor: tagColor(tag),
                              }}
                            />
                          ))}
                      </span>
                    </span>
                  </>
                )}
                {(planned > 0 || due.length > 0) && (
                  <span
                    className="mt-auto hidden flex-wrap gap-x-2 gap-y-0.5 pt-1 text-[11px] text-muted-foreground @min-[600px]:flex"
                    aria-hidden="true"
                  >
                    {planned > 0 && (
                      <span>
                        <span className="font-mono tabular-nums">{planned}</span>{" "}
                        planned
                      </span>
                    )}
                    {due.length > 0 && (
                      <span>
                        <span className="font-mono tabular-nums">{due.length}</span>{" "}
                        due
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
