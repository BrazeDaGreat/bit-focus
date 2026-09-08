/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Home Page
 *
 * Two zones with a deliberate seam between them:
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
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

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
  FaPlus,
  FaRegCircle,
  FaRegCircleCheck,
  FaTrash,
} from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { useTag } from "@/hooks/useTag";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { type JSX, type ReactNode, useState, useEffect, useMemo } from "react";
import { Issue, Milestone, Project, useProjects } from "@/hooks/useProjects";
import { useRouter } from "next/navigation";
import { useConfig } from "@/hooks/useConfig";
import { usePomo } from "@/hooks/PomoContext";
import FocusHeatmap from "@/components/FocusHeatmap";
import ColorPicker from "@/components/ui/color-picker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

dayjs.extend(isSameOrAfter);

// ── helpers ──────────────────────────────────────────────────────────────────

/** Total focus seconds inside a half-open window [start, end). */
function focusBetween(
  sessions: FocusSession[],
  start: dayjs.Dayjs,
  end: dayjs.Dayjs
): number {
  return reduceSessions(
    sessions.filter((s) => {
      const t = dayjs(s.startTime);
      return t.isSameOrAfter(start) && t.isBefore(end);
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

export default function Home(): JSX.Element {
  const { theme } = useTheme();
  const { loadFocusSessions } = useFocus();
  const { featureToggles } = useConfig();

  useEffect(() => {
    loadFocusSessions();
  }, [loadFocusSessions]);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Header ── */}
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {dateStr}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting}
        </h1>
      </header>

      {/* ── Zone 1: Now ── */}
      <div
        className={cn(
          "grid gap-4",
          featureToggles.projects ? "lg:grid-cols-[1.6fr_1fr]" : "lg:grid-cols-1"
        )}
      >
        <TodayPanel />
        {featureToggles.projects && <DuePanel />}
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
        <Panel title="Consistency" subtitle="One square per day">
          <FocusHeatmap />
        </Panel>
      </div>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
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

// ── Due panel: issues that need attention now ─────────────────────────────────

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
      <Panel title="Due" action={action}>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-3/4" />
        </div>
      </Panel>
    );
  }

  const { overdue, today, tomorrow, next7days } = getUpcomingIssues();
  const total =
    overdue.length + today.length + tomorrow.length + next7days.length;

  return (
    <Panel
      title="Due"
      subtitle={total === 0 ? undefined : `${total} open this week`}
      action={action}
    >
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

  const data = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = dayjs().subtract(29 - i, "day");
      const key = d.format("YYYY-MM-DD");
      const sessions = focusSessions.filter(
        (s) => dayjs(s.startTime).format("YYYY-MM-DD") === key
      );
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={{
                  fontSize: 12,
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--foreground)",
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(v: number) => [`${v}h`, "Focus"]}
              />
              <Bar
                dataKey="hours"
                fill="var(--chart-1)"
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
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
    const now = dayjs();
    const start = now.subtract(7, "day");
    const totals = new Map<string, number>();

    for (const session of focusSessions) {
      const at = dayjs(session.startTime);
      if (!at.isSameOrAfter(start)) continue;
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
  const { savedTags, addSavedTag, removeSavedTag } = useTag();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState("#3b82f6");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  const create = (data: any) => {
    addSavedTag(data.tagname, color);
    reset();
    setColor("#3b82f6");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs">
          Manage tags
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-xl">
        <form className="flex flex-col gap-3" onSubmit={handleSubmit(create)}>
          <Label htmlFor="tag-name" className="text-xs">
            Tag name
          </Label>
          <Input
            id="tag-name"
            className="h-8"
            {...register("tagname", { required: true })}
          />
          {errors.tagname && (
            <span className="text-xs text-red-500">Enter a tag name</span>
          )}
          <Label htmlFor="tag-color" className="text-xs">
            Color
          </Label>
          <ColorPicker id="tag-color" value={color} onChange={setColor} />
          <Button type="submit" size="sm" className="gap-1.5">
            <FaPlus className="size-2.5" />
            Add tag
          </Button>
        </form>

        {savedTags.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="mb-2 text-xs text-muted-foreground">Saved tags</p>
            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
              {savedTags.map((t) => (
                <div
                  key={t.t}
                  className="group flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted/60"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.c }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs">{t.t}</span>
                  <button
                    onClick={() => removeSavedTag(t.t)}
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    title={`Remove ${t.t}`}
                  >
                    <FaTrash className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
