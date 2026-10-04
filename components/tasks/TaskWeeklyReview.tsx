"use client";

import { useTasks } from "@/hooks/useTasks";
import { useFocus } from "@/hooks/useFocus";
import { useConfig } from "@/hooks/useConfig";
import { useProjects } from "@/hooks/useProjects";
import { formatMinutes, isTaskOverdue, taskMinutes } from "@/lib/tasks";
import { Skeleton } from "@/components/ui/skeleton";

/** Uses the same rolling seven-day window as the existing Home review. */
export function TaskWeeklyReview() {
  const { tasks, loading } = useTasks();
  const { focusSessions } = useFocus();
  const projectsEnabled = useConfig((s) => s.featureToggles.projects);
  const { projects } = useProjects();
  if (!projectsEnabled) return null;
  if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const previous = new Date(start);
  previous.setDate(previous.getDate() - 7);
  const kept = tasks.filter((t) => !t.deletedAt);
  const completed = kept.filter(
    (t) =>
      t.completedAt &&
      new Date(t.completedAt) >= start &&
      new Date(t.completedAt) <= now,
  );
  const lastWeek = kept.filter(
    (t) =>
      t.completedAt &&
      new Date(t.completedAt) >= previous &&
      new Date(t.completedAt) < start,
  );
  const overdue = kept.filter(
    (t) =>
      isTaskOverdue(t, now) &&
      !projects.some((p) => p.id === t.projectId && p.status === "Closed"),
  );
  const estimated = completed.filter((t) => t.estimateMinutes > 0);
  const estimate = estimated.reduce((sum, t) => sum + t.estimateMinutes, 0);
  const actual = estimated.reduce(
    (sum, t) => sum + taskMinutes(t, focusSessions),
    0,
  );
  const weekSessions = focusSessions.filter(
    (s) =>
      s.taskUid &&
      new Date(s.startTime) >= start &&
      new Date(s.startTime) <= now,
  );
  const weekMinutes = weekSessions.reduce(
    (sum, s) =>
      sum +
      (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000,
    0,
  );
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="mb-3 text-xs font-medium">Tasks this week</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="font-mono text-xl tabular-nums">{completed.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Completed · {lastWeek.length} previous week
          </p>
        </div>
        <div>
          <p className="font-mono text-xl tabular-nums">{overdue.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Still overdue</p>
        </div>
        <div>
          <p className="font-mono text-xl tabular-nums">
            {formatMinutes(weekMinutes)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Task focus time</p>
        </div>
        <div>
          <p className="font-mono text-xl tabular-nums">
            {estimate
              ? `${formatMinutes(actual)} / ${formatMinutes(estimate)}`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Actual / estimate · finished tasks
          </p>
        </div>
      </div>
      {completed.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Finished:{" "}
          {completed
            .slice(0, 5)
            .map((t) => t.title)
            .join(" · ")}
          {completed.length > 5 ? ` · +${completed.length - 5} more` : ""}
        </p>
      )}
    </div>
  );
}
