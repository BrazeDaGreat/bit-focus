/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { FocusSession, useFocus } from "@/hooks/useFocus";
import {
  cn,
  durationFromSeconds,
  formatDate,
  formatTimeNew,
  reduceSessions,
} from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FaChevronDown,
  FaChevronUp,
  FaHashtag,
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
import { type JSX, useState, useEffect, useMemo } from "react";
import { Issue, Milestone, Project, useProjects } from "@/hooks/useProjects";
import { useRouter } from "next/navigation";
import FocusHeatmap from "@/components/FocusHeatmap";
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

function focusInHours(sessions: FocusSession[], hours: number): number {
  const cutoff = dayjs().subtract(hours, "hour");
  return reduceSessions(
    sessions.filter((s) => dayjs(s.startTime).isSameOrAfter(cutoff))
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────

export default function Home(): JSX.Element {
  const { theme } = useTheme();
  const { loadFocusSessions } = useFocus();

  useEffect(() => {
    loadFocusSessions();
  }, [loadFocusSessions]);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">
      {/* ── Header strip ── */}
      <div className="flex items-baseline justify-between pb-6 border-b mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting} Here&apos;s your week.
        </h1>
        <span className="text-sm text-muted-foreground hidden sm:block shrink-0 ml-4">
          {dateStr}
        </span>
      </div>

      {/* ── Stats row ── */}
      <StatsRow />

      {/* ── Two-column content ── */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-0">
        {/* Activity — left 2/3 */}
        <div className="flex flex-col gap-6 lg:pr-6">
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Activity
            </p>
            <FocusHeatmap />
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Focus Trend — Last 30 Days
            </p>
            <FocusTrendChart />
          </section>
        </div>

        {/* Workload — right 1/3 */}
        <div className="lg:border-l lg:pl-6 flex flex-col gap-0 mt-8 lg:mt-0">
          <UpcomingIssuesSection />
          <TagsSection />
        </div>
      </div>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow(): JSX.Element {
  const { focusSessions, loadingFocusSessions } = useFocus();

  const stats = useMemo(
    () => [
      {
        label: "Last 24h",
        value: formatTimeNew(
          durationFromSeconds(focusInHours(focusSessions, 24)),
          "H:M:S",
          "text"
        ),
      },
      {
        label: "7 Days",
        value: formatTimeNew(
          durationFromSeconds(focusInHours(focusSessions, 168)),
          "H:M:S",
          "text"
        ),
      },
      {
        label: "30 Days",
        value: formatTimeNew(
          durationFromSeconds(focusInHours(focusSessions, 720)),
          "H:M:S",
          "text"
        ),
      },
    ],
    [focusSessions]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((card) => (
        <div key={card.label} className="border rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {card.label}
          </p>
          {loadingFocusSessions ? (
            <Skeleton className="h-10 w-28" />
          ) : (
            <p className="text-4xl font-semibold font-mono tracking-tight">
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Focus Trend Chart ─────────────────────────────────────────────────────────

function FocusTrendChart(): JSX.Element {
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

  // Theme-aware colors for chart elements
  const chartColors = {
    tickFill: "var(--muted-foreground)",
    axisStroke: "var(--border)",
    barFill: "var(--chart-1)",
  };

  if (loadingFocusSessions) {
    return <Skeleton className="h-[120px] w-full" />;
  }

  return (
    <div className="h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: chartColors.tickFill }}
            tickLine={false}
            axisLine={{ stroke: chartColors.axisStroke }}
            interval={6}
          />
          <YAxis
            tick={{ fontSize: 10, fill: chartColors.tickFill }}
            tickLine={false}
            axisLine={{ stroke: chartColors.axisStroke }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(v: number) => [`${v}h`, "Focus"]}
          />
          <Bar
            dataKey="hours"
            fill={chartColors.barFill}
            radius={[2, 2, 0, 0]}
            maxBarSize={12}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Upcoming Issues Section ───────────────────────────────────────────────────

function UpcomingIssuesSection(): JSX.Element {
  const { getUpcomingIssues, loadingProjects } = useProjects();
  const router = useRouter();

  if (loadingProjects) {
    return (
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Workload
        </p>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-3/4" />
        </div>
      </div>
    );
  }

  const { overdue, today, tomorrow, next7days } = getUpcomingIssues();
  const totalIssues =
    overdue.length + today.length + tomorrow.length + next7days.length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Workload
        </p>
        <button
          onClick={() => router.push("/projects")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all →
        </button>
      </div>

      {totalIssues === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No issues due this week. All clear.
        </p>
      ) : (
        <>
          <IssueGroup label="Overdue" issues={overdue} />
          <IssueGroup label="Today" issues={today} />
          <IssueGroup label="Tomorrow" issues={tomorrow} />
          <IssueGroup label="Next 7 Days" issues={next7days} />
        </>
      )}
    </div>
  );
}

function IssueGroup({
  label,
  issues,
}: {
  label: string;
  issues: (Issue & { milestone: Milestone; project: Project })[];
}): JSX.Element {
  if (issues.length === 0) return <></>;

  return (
    <div className="mb-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5 pl-0.5">
        {label}
      </p>
      {issues.map((issue) => (
        <IssueRow key={issue.id} issue={issue} />
      ))}
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
        "border-b border-dashed last:border-0",
        issue.status === "Close" && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2 py-1.5">
        <button
          onClick={handleToggle}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Toggle status"
        >
          {issue.status === "Open" ? (
            <FaRegCircle className="size-3.5" />
          ) : (
            <FaRegCircleCheck className="size-3.5" />
          )}
        </button>
        <span
          className={cn(
            "text-sm flex-1 min-w-0 truncate",
            issue.status === "Close" && "line-through"
          )}
        >
          {issue.title}
        </span>
        {issue.dueDate && (
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            {formatDate(issue.dueDate)}
          </span>
        )}
        {issue.description && (
          <button
            onClick={() => setShowDescription(!showDescription)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
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
        <p className="text-xs text-muted-foreground pl-6 pb-1.5">
          {issue.description}
        </p>
      )}
    </div>
  );
}

// ── Tags Section ──────────────────────────────────────────────────────────────

function TagsSection(): JSX.Element {
  const { savedTags, addSavedTag, removeSavedTag } = useTag();
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const create = (data: any) => {
    addSavedTag(data.tagname, data.color);
    reset();
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-t pt-4 mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Tags
        </p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs px-2"
            >
              <FaPlus className="size-2.5" />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <form
              className="flex flex-col gap-3"
              onSubmit={handleSubmit(create)}
            >
              <Label htmlFor="tag-name" className="text-xs">
                Tag Name
              </Label>
              <Input
                id="tag-name"
                className="h-8"
                {...register("tagname", { required: true })}
              />
              {errors.tagname && (
                <span className="text-red-500 text-xs">Required</span>
              )}
              <Label htmlFor="tag-color" className="text-xs">
                Color HEX
              </Label>
              <Input
                id="tag-color"
                className="h-8"
                placeholder="#3b82f6"
                {...register("color", {
                  pattern: {
                    value: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
                    message: "Enter a valid HEX color",
                  },
                })}
              />
              {errors.color && (
                <span className="text-red-500 text-xs">{`${errors.color.message}`}</span>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Create
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>

      {savedTags.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {savedTags.map((t) => (
            <span
              key={t.t}
              className="group relative flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
              style={{
                backgroundColor: t.c + "22",
                color: t.c,
                border: `1px solid ${t.c}44`,
              }}
            >
              <FaHashtag className="size-2.5 opacity-70" />
              {t.t}
              <button
                onClick={() => removeSavedTag(t.t)}
                className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                title={`Remove ${t.t}`}
              >
                <FaTrash className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
