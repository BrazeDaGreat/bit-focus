"use client";

/**
 * Home Dashboard
 *
 * Client half of the home page (`app/page.tsx` renders the greeting header on
 * the server side of the boundary and this beneath it). Two zones with a deliberate seam between them:
 *
 * 1. **Now** — what to do in the next minute. Today's focus total, the start
 *    control, and the issues due soonest.
 * 2. **Review** — what already happened. A 30-day trend, where the time went
 *    by tag, and the year heatmap.
 *
 * The split exists because the two halves answer different questions and were
 * previously interleaved, which left the page reading as one flat pile of
 * panels with no lead element.
 */

import { FocusSession, useFocus } from "@/hooks/useFocus";
import {
  cn,
  durationFromSeconds,
  formatDate,
  formatTimeNew,
  getTagColor,
  reduceSessions,
} from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";

import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FaArrowRightLong,
  FaArrowTrendDown,
  FaArrowTrendUp,
  FaChevronDown,
  FaChevronUp,
  FaPause,
  FaPlay,
  FaRegCircle,
  FaRegCircleCheck,
} from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { useTag } from "@/hooks/useTag";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type JSX, type ReactNode, useState, useEffect, useMemo } from "react";
import { Issue, Milestone, Project, useProjects } from "@/hooks/useProjects";
import { useRouter } from "next/navigation";
import { useConfig } from "@/hooks/useConfig";
import { usePomo } from "@/hooks/PomoContext";
import { usePomodoroLog } from "@/hooks/usePomodoroLog";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DEFAULT_TAG_COLOR } from "./ManageTagsContent";
import type { TrendDatum } from "./TrendChart";

dayjs.extend(isSameOrAfter);

// ── code-split, below-the-fold and on-demand pieces ─────────────────────────

/** Recharts is the heaviest dependency on this page; it loads behind a same-size placeholder. */
const TrendChart = dynamic(() => import("./TrendChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[160px] w-full rounded-xl" />,
});

/** The year heatmap sits at the very bottom of the page. */
const FocusHeatmap = dynamic(() => import("@/components/FocusHeatmap"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-56 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  ),
});

/** Form behind "Manage tags": only needed once the popover is opened. */
const loadManageTagsContent = () => import("./ManageTagsContent");
const ManageTagsContent = dynamic(loadManageTagsContent, { ssr: false });

// ── helpers ──────────────────────────────────────────────────────────────────

/** Total focus seconds inside a half-open window [start, end). */
function focusBetween(
  sessions: FocusSession[],
  start: dayjs.Dayjs,
  end: dayjs.Dayjs
): number {
  const from = start.valueOf();
  const to = end.valueOf();
  return reduceSessions(
    sessions.filter((s) => {
      const t = new Date(s.startTime).getTime();
      return t >= from && t < to;
    })
  );
}

/** Human duration, e.g. "1h 12m". Seconds are dropped above the minute mark. */
function humanDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Percentage change against a baseline, or null when there is nothing to compare. */
function percentChange(current: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return Math.round(((current - baseline) / baseline) * 100);
}

// ── Home Page ─────────────────────────────────────────────────────────────────

export default function Dashboard(): JSX.Element {
  const { loadFocusSessions } = useFocus();
  const featureProjects = useConfig((s) => s.featureToggles.projects);

  useEffect(() => {
    loadFocusSessions();
  }, [loadFocusSessions]);

  return (
    <>
      {/* ── Zone 1: Now ── */}
      <div
        className={cn(
          "grid gap-4",
          featureProjects ? "lg:grid-cols-[1.6fr_1fr]" : "lg:grid-cols-1"
        )}
      >
        <TodayPanel />
        {featureProjects && <DuePanel />}
      </div>

      {/* ── Seam ── */}
      <div className="mb-4 mt-10 flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Review
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ── Zone 2: Review ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendPanel />
        <TagBreakdownPanel />
      </div>

      <div className="mt-4">
        <WeekReviewPanel />
      </div>

      <div className="mt-4">
        <Panel title="Consistency" subtitle="One square per day">
          <FocusHeatmap />
        </Panel>
      </div>
    </>
  );
}

// ── Panel shell ───────────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5 shadow-xs",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Up/down chip used beside a headline number. */
function Delta({
  change,
  label,
}: {
  change: number | null;
  label: string;
}): JSX.Element {
  if (change === null) {
    return <span className="text-xs text-muted-foreground">{label}</span>;
  }
  const up = change >= 0;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
          up
            ? "bg-emerald-600/12 text-emerald-600"
            : "bg-destructive/12 text-destructive"
        )}
      >
        {up ? (
          <FaArrowTrendUp className="size-2.5" />
        ) : (
          <FaArrowTrendDown className="size-2.5" />
        )}
        {up ? "+" : ""}
        {change}%
      </span>
      {label}
    </span>
  );
}

// ── Today panel: the headline number plus the one action that matters ─────────

function TodayPanel(): JSX.Element {
  const { focusSessions, loadingFocusSessions } = useFocus();
  const { state, start, pause } = usePomo();
  const { tag, savedTags } = useTag();
  const router = useRouter();

  const [tagColor, tagWantsWhite] = getTagColor(savedTags, tag ?? "");

  const totals = useMemo(() => {
    const startOfToday = dayjs().startOf("day");
    const now = dayjs();

    const today = focusBetween(focusSessions, startOfToday, now.add(1, "day"));

    // Today is compared against the recent daily average rather than yesterday:
    // a part-finished day always loses to a full one.
    const lastSevenDays = focusBetween(
      focusSessions,
      startOfToday.subtract(7, "day"),
      startOfToday
    );
    const dailyAverage = lastSevenDays / 7;

    const week = focusBetween(focusSessions, now.subtract(7, "day"), now);
    const previousWeek = focusBetween(
      focusSessions,
      now.subtract(14, "day"),
      now.subtract(7, "day")
    );

    const month = focusBetween(focusSessions, now.subtract(30, "day"), now);
    const previousMonth = focusBetween(
      focusSessions,
      now.subtract(60, "day"),
      now.subtract(30, "day")
    );

    return {
      today,
      dailyAverage,
      week,
      weekChange: percentChange(week, previousWeek),
      month,
      monthChange: percentChange(month, previousMonth),
    };
  }, [focusSessions]);

  const isPaused = !state.isRunning && state.elapsedSeconds > 0;
  const buttonLabel = state.isRunning
    ? "Pause session"
    : isPaused
    ? "Resume session"
    : "Start focusing";

  return (
    <section className="flex flex-col rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">Today</h3>
          {loadingFocusSessions ? (
            <Skeleton className="mt-3 h-12 w-40" />
          ) : (
            <p className="mt-2 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
              {formatTimeNew(
                durationFromSeconds(totals.today),
                "H:M:S",
                "text"
              )}
            </p>
          )}
          {!loadingFocusSessions && (
            <div className="mt-2.5">
              <Delta
                change={percentChange(totals.today, totals.dailyAverage)}
                label="vs your 7-day average"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-2">
          <Button
            size="lg"
            className="h-11 gap-2 rounded-xl px-5"
            onClick={() => (state.isRunning ? pause() : start())}
          >
            {state.isRunning ? (
              <FaPause className="size-3.5" />
            ) : (
              <FaPlay className="size-3.5" />
            )}
            {buttonLabel}
          </Button>
          <button
            onClick={() => router.push("/focus")}
            className="group flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {tag ? (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: tagColor,
                  color: tagWantsWhite ? "#fff" : "#000",
                }}
              >
                #{tag}
              </span>
            ) : (
              "Open the timer"
            )}
            <FaArrowRightLong className="size-2.5" />
          </button>
        </div>
      </div>

      {/* Supporting totals sit in a well so they read as context, not headlines */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border">
        <SupportStat
          label="Last 7 days"
          value={totals.week}
          change={totals.weekChange}
          loading={loadingFocusSessions}
        />
        <SupportStat
          label="Last 30 days"
          value={totals.month}
          change={totals.monthChange}
          loading={loadingFocusSessions}
        />
      </div>
    </section>
  );
}

function SupportStat({
  label,
  value,
  change,
  loading,
}: {
  label: string;
  value: number;
  change: number | null;
  loading: boolean;
}): JSX.Element {
  return (
    <div className="bg-muted/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-20" />
      ) : (
        <>
          <p className="mt-1 font-mono text-xl font-semibold tracking-tight">
            {humanDuration(value)}
          </p>
          <div className="mt-1">
            <Delta change={change} label="vs previous" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Week in review ────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Days of history behind the best-hours grid: four of each weekday. */
const HOURS_WINDOW_DAYS = 28;

/** "9am", "12pm", "5pm" */
function hourLabel(hour: number): string {
  const h = hour % 24;
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${suffix}`;
}

/**
 * Spread a session's minutes over the clock hours it covered, so a session
 * from 9:40 to 11:10 counts toward 9am, 10am and 11am.
 */
function addToHourGrid(grid: number[][], start: Date, end: Date): void {
  let cursor = dayjs(start);
  const stop = dayjs(end);
  while (cursor.isBefore(stop)) {
    const nextHour = cursor.startOf("hour").add(1, "hour");
    const sliceEnd = nextHour.isBefore(stop) ? nextHour : stop;
    grid[cursor.day()][cursor.hour()] += sliceEnd.diff(cursor, "second") / 60;
    cursor = sliceEnd;
  }
}

/**
 * The last seven days at a glance: when you focused and on what, the hours
 * you do your best work, how long sessions run, and how many Pomodoros you
 * finish rather than stop. Sits in the Review zone, under the daily trend.
 */
function WeekReviewPanel(): JSX.Element {
  const { focusSessions, loadingFocusSessions } = useFocus();
  const { savedTags } = useTag();
  const pomodoroEntries = usePomodoroLog((s) => s.entries);

  const review = useMemo(() => {
    const today = dayjs().startOf("day");
    const weekStart = today.subtract(6, "day");
    const prevStart = weekStart.subtract(7, "day");
    const hoursStart = today.subtract(HOURS_WINDOW_DAYS - 1, "day");

    const days = Array.from({ length: 7 }, (_, i) => ({
      date: weekStart.add(i, "day"),
      byTag: new Map<string, number>(),
      total: 0,
    }));
    const tagTotals = new Map<string, number>();
    const hourGrid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
    let weekCount = 0;
    let weekSeconds = 0;
    let prevCount = 0;
    let prevSeconds = 0;

    // Nothing here reads a session older than the best-hours window, so skip
    // those before building a dayjs object for each.
    const oldestNeeded = Math.min(hoursStart.valueOf(), prevStart.valueOf());

    for (const session of focusSessions) {
      if (new Date(session.startTime).getTime() < oldestNeeded) continue;
      const at = dayjs(session.startTime);
      const seconds = reduceSessions([session]);

      if (!at.isBefore(hoursStart)) {
        addToHourGrid(hourGrid, new Date(session.startTime), new Date(session.endTime));
      }
      if (!at.isBefore(weekStart)) {
        weekCount += 1;
        weekSeconds += seconds;
        const day = days[at.startOf("day").diff(weekStart, "day")];
        if (day) {
          const key = session.tag?.trim() || "Untagged";
          day.byTag.set(key, (day.byTag.get(key) ?? 0) + seconds);
          day.total += seconds;
          tagTotals.set(key, (tagTotals.get(key) ?? 0) + seconds);
        }
      } else if (!at.isBefore(prevStart)) {
        prevCount += 1;
        prevSeconds += seconds;
      }
    }

    // The five biggest tags keep their colour; the rest share one grey.
    const topTags = [...tagTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
    const colorFor = (tag: string) =>
      topTags.includes(tag) ? getTagColor(savedTags, tag)[0] : "var(--muted-foreground)";

    const maxDay = Math.max(...days.map((d) => d.total), 1);

    // Best two-hour window across the whole grid.
    const byHour = new Array<number>(24).fill(0);
    hourGrid.forEach((row) => row.forEach((m, h) => (byHour[h] += m)));
    let bestHour = -1;
    let bestMinutes = 0;
    for (let h = 0; h < 24; h++) {
      const span = byHour[h] + byHour[(h + 1) % 24];
      if (span > bestMinutes) {
        bestMinutes = span;
        bestHour = h;
      }
    }
    const maxCell = Math.max(...hourGrid.flat(), 1);

    const avg = weekCount > 0 ? weekSeconds / weekCount : 0;
    const prevAvg = prevCount > 0 ? prevSeconds / prevCount : 0;

    const weekEntries = pomodoroEntries.filter((e) => e.at >= weekStart.valueOf());
    const finished = weekEntries.filter((e) => e.completed).length;

    return {
      days: days.map((d) => ({
        label: d.date.isSame(today, "day") ? "Today" : WEEKDAY_LABELS[d.date.day()],
        total: d.total,
        height: (d.total / maxDay) * 100,
        segments: [...d.byTag.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([tag, seconds]) => ({ tag, seconds, color: colorFor(tag) })),
      })),
      legend: topTags.map((tag) => ({ tag, color: colorFor(tag) })),
      hourGrid,
      maxCell,
      bestHour,
      avg,
      avgChange: prevAvg > 0 && avg > 0 ? percentChange(avg, prevAvg) : null,
      weekCount,
      countChange: percentChange(weekCount, prevCount),
      pomodoros: { finished, total: weekEntries.length },
    };
  }, [focusSessions, savedTags, pomodoroEntries]);

  const { pomodoros } = review;
  const rate = pomodoros.total > 0 ? Math.round((pomodoros.finished / pomodoros.total) * 100) : null;

  return (
    <Panel title="Week in review" subtitle="Last 7 days, compared with the 7 before">
      {loadingFocusSessions ? (
        <Skeleton className="h-[260px] w-full rounded-xl" />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Numbers */}
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-3">
            <ReviewStat
              label="Average session"
              value={review.avg > 0 ? humanDuration(review.avg) : "—"}
              footer={<Delta change={review.avgChange} label="vs previous" />}
            />
            <ReviewStat
              label="Sessions"
              value={String(review.weekCount)}
              footer={<Delta change={review.countChange} label="vs previous" />}
            />
            <ReviewStat
              label="Pomodoros finished"
              value={rate === null ? "—" : `${rate}%`}
              footer={
                <span className="text-xs text-muted-foreground">
                  {pomodoros.total === 0
                    ? "None started this week"
                    : `${pomodoros.finished} of ${pomodoros.total} ran to the end`}
                </span>
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Focus by day, stacked by tag */}
            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                By day and tag
              </p>
              <div className="flex h-36 items-end gap-2">
                {review.days.map((day) => (
                  <div key={day.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
                    <div
                      className="flex w-full max-w-9 flex-1 flex-col justify-end"
                      title={`${day.label}: ${day.total > 0 ? humanDuration(day.total) : "no focus"}`}
                    >
                      <div
                        className="flex w-full flex-col-reverse overflow-hidden rounded-md bg-muted transition-[height] duration-500"
                        style={{ height: `${Math.max(day.height, day.total > 0 ? 4 : 2)}%` }}
                      >
                        {day.segments.map((seg) => (
                          <div
                            key={seg.tag}
                            style={{
                              height: `${(seg.seconds / day.total) * 100}%`,
                              backgroundColor: seg.color,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px]",
                        day.label === "Today" ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
              {review.legend.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {review.legend.map((item) => (
                    <span key={item.tag} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Best focus hours */}
            <div>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Best hours
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {review.bestHour >= 0
                    ? `Most focus ${hourLabel(review.bestHour)}–${hourLabel(review.bestHour + 2)}`
                    : `Last ${HOURS_WINDOW_DAYS} days`}
                </p>
              </div>
              <div className="flex flex-col gap-[3px]">
                {/* Monday first */}
                {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
                  <div key={weekday} className="flex items-center gap-2">
                    <span className="w-7 shrink-0 text-[10px] text-muted-foreground">
                      {WEEKDAY_LABELS[weekday]}
                    </span>
                    <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
                      {review.hourGrid[weekday].map((minutes, hour) => (
                        <span
                          key={hour}
                          className="aspect-square rounded-[3px]"
                          title={`${WEEKDAY_LABELS[weekday]} ${hourLabel(hour)}: ${Math.round(minutes)}m over ${HOURS_WINDOW_DAYS} days`}
                          style={{
                            backgroundColor:
                              minutes > 0
                                ? `color-mix(in oklch, var(--chart-1) ${Math.round(20 + (minutes / review.maxCell) * 80)}%, transparent)`
                                : "var(--muted)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <span className="w-7 shrink-0" />
                  <div className="grid flex-1 grid-cols-4 text-[10px] text-muted-foreground">
                    <span>12am</span>
                    <span>6am</span>
                    <span>12pm</span>
                    <span>6pm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ReviewStat({
  label,
  value,
  footer,
}: {
  label: string;
  value: string;
  footer: ReactNode;
}): JSX.Element {
  return (
    <div className="bg-muted/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1">{footer}</div>
    </div>
  );
}

// ── Due panel: issues that need attention now ─────────────────────────────────

/** Keeps the subtitle line's height reserved while it has nothing to say. */
const NBSP = "\u00A0";

/**
 * Fixed-footprint body for the Due panel.
 *
 * The panel's height must not depend on how many issues load in: it used to
 * open as a three-row skeleton and then grow to fit the real list, shoving the
 * Review zone down. On wide screens the body is taken out of flow and fills
 * whatever height the Today panel beside it sets (scrolling if the list is
 * longer); on narrow screens it reserves a floor that holds a typical list.
 */
function DueBody({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="relative flex min-h-44 flex-1 flex-col lg:min-h-0">
      <div className="flex flex-1 flex-col lg:absolute lg:-inset-1 lg:overflow-y-auto lg:p-1">
        {children}
      </div>
    </div>
  );
}

function DuePanel(): JSX.Element {
  const { getUpcomingIssues, loadingProjects } = useProjects();
  const router = useRouter();

  const action = (
    <button
      onClick={() => router.push("/projects")}
      className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      All projects
      <FaArrowRightLong className="size-2.5" />
    </button>
  );

  if (loadingProjects) {
    return (
      <Panel title="Due" subtitle={NBSP} action={action}>
        <DueBody>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-3/4" />
          </div>
        </DueBody>
      </Panel>
    );
  }

  const { overdue, today, tomorrow, next7days } = getUpcomingIssues();
  const total =
    overdue.length + today.length + tomorrow.length + next7days.length;

  return (
    <Panel
      title="Due"
      subtitle={total === 0 ? NBSP : `${total} open this week`}
      action={action}
    >
      <DueBody>
        {total === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center rounded-xl bg-muted/40 px-4 py-6">
            <p className="text-sm font-medium">Nothing due this week</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add an issue from a project to see it here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <IssueGroup label="Overdue" issues={overdue} urgent />
            <IssueGroup label="Today" issues={today} urgent />
            <IssueGroup label="Tomorrow" issues={tomorrow} />
            <IssueGroup label="Next 7 days" issues={next7days} />
          </div>
        )}
      </DueBody>
    </Panel>
  );
}

function IssueGroup({
  label,
  issues,
  urgent = false,
}: {
  label: string;
  issues: (Issue & { milestone: Milestone; project: Project })[];
  urgent?: boolean;
}): JSX.Element {
  if (issues.length === 0) return <></>;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.1em]",
            urgent ? "text-primary" : "text-muted-foreground/70"
          )}
        >
          {label}
        </p>
        <span className="font-mono text-[11px] text-muted-foreground/50">
          {issues.length}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function IssueRow({
  issue,
}: {
  issue: Issue & { milestone: Milestone; project: Project };
}): JSX.Element {
  const { updateIssue } = useProjects();
  const [showDescription, setShowDescription] = useState(false);

  const handleToggle = async () => {
    const newStatus = issue.status === "Open" ? "Close" : "Open";
    try {
      await updateIssue(issue.id!, { status: newStatus });
    } catch {
      toast.error("Failed to update issue");
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50",
        issue.status === "Close" && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          title={issue.status === "Open" ? "Mark as done" : "Reopen issue"}
        >
          {issue.status === "Open" ? (
            <FaRegCircle className="size-3.5" />
          ) : (
            <FaRegCircleCheck className="size-3.5" />
          )}
        </button>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            issue.status === "Close" && "line-through"
          )}
        >
          {issue.title}
        </span>
        {issue.dueDate && (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {formatDate(issue.dueDate)}
          </span>
        )}
        {issue.description && (
          <button
            onClick={() => setShowDescription(!showDescription)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            title={showDescription ? "Hide description" : "Show description"}
          >
            {showDescription ? (
              <FaChevronUp className="size-2.5" />
            ) : (
              <FaChevronDown className="size-2.5" />
            )}
          </button>
        )}
      </div>
      {showDescription && issue.description && (
        <p className="pl-6 pt-1 text-xs text-muted-foreground">
          {issue.description}
        </p>
      )}
    </div>
  );
}

// ── Trend panel ───────────────────────────────────────────────────────────────

function TrendPanel(): JSX.Element {
  const { focusSessions, loadingFocusSessions } = useFocus();

  const data = useMemo<TrendDatum[]>(() => {
    // Bucket sessions by day once, instead of re-scanning every session for
    // each of the 30 days.
    const byDay = new Map<string, FocusSession[]>();
    const oldest = dayjs().subtract(29, "day").startOf("day").valueOf();
    for (const session of focusSessions) {
      if (new Date(session.startTime).getTime() < oldest) continue;
      const key = dayjs(session.startTime).format("YYYY-MM-DD");
      const bucket = byDay.get(key);
      if (bucket) bucket.push(session);
      else byDay.set(key, [session]);
    }

    return Array.from({ length: 30 }, (_, i) => {
      const d = dayjs().subtract(29 - i, "day");
      const sessions = byDay.get(d.format("YYYY-MM-DD")) ?? [];
      return {
        date: d.format("M/D"),
        hours: parseFloat((reduceSessions(sessions) / 3600).toFixed(2)),
      };
    });
  }, [focusSessions]);

  const best = useMemo(
    () => data.reduce((max, d) => Math.max(max, d.hours), 0),
    [data]
  );

  return (
    <Panel
      title="Daily focus"
      subtitle={best > 0 ? `Best day: ${best}h` : "Last 30 days"}
    >
      {loadingFocusSessions ? (
        <Skeleton className="h-[160px] w-full rounded-xl" />
      ) : (
        <div className="h-[160px]">
          <TrendChart data={data} />
        </div>
      )}
    </Panel>
  );
}

// ── Tag breakdown panel ───────────────────────────────────────────────────────

function TagBreakdownPanel(): JSX.Element {
  const { focusSessions, loadingFocusSessions } = useFocus();
  const { savedTags } = useTag();

  const rows = useMemo(() => {
    const start = dayjs().subtract(7, "day").valueOf();
    const totals = new Map<string, number>();

    for (const session of focusSessions) {
      if (new Date(session.startTime).getTime() < start) continue;
      const seconds = reduceSessions([session]);
      const key = session.tag?.trim() || "Untagged";
      totals.set(key, (totals.get(key) ?? 0) + seconds);
    }

    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    if (rest.length > 0) {
      top.push([
        `${rest.length} more`,
        rest.reduce((sum, [, seconds]) => sum + seconds, 0),
      ]);
    }

    const max = top[0]?.[1] ?? 0;
    return top.map(([tag, seconds]) => ({
      tag,
      seconds,
      share: max > 0 ? (seconds / max) * 100 : 0,
      color: getTagColor(savedTags, tag)[0],
    }));
  }, [focusSessions, savedTags]);

  return (
    <Panel
      title="Where the time went"
      subtitle="Last 7 days"
      action={<ManageTagsButton />}
    >
      {loadingFocusSessions ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center rounded-xl bg-muted/40 px-4 py-6">
          <p className="text-sm font-medium">No sessions this week</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start a session to see how your time splits by tag.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <div key={row.tag} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs font-medium sm:w-28">
                {row.tag}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(row.share, 2)}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {humanDuration(row.seconds)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Tag creation and removal, kept here because tags are read here. */
function ManageTagsButton(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(DEFAULT_TAG_COLOR);
  const isMobile = useIsMobile();

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 rounded-lg px-2 text-xs"
      // Start fetching the form as soon as intent is clear.
      onPointerEnter={() => void loadManageTagsContent()}
      onFocus={() => void loadManageTagsContent()}
    >
      Manage tags
    </Button>
  );

  const content = <ManageTagsContent color={color} onColorChange={setColor} />;

  if (isMobile) {
    return (
      <MobileDrawer
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        title="Manage tags"
        description="Create labels for focus sessions and remove ones you no longer use."
      >
        {content}
      </MobileDrawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-xl">
        {content}
      </PopoverContent>
    </Popover>
  );
}
