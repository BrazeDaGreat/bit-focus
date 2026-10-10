"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronRight, CircleDashed, ListChecks, Plus } from "lucide-react";
import type { Project } from "@/hooks/useProjects";
import { isTaskOverdue, taskDeadline, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { ProjectIcon } from "./ProjectIcon";

export type ProjectScope = "all" | "none" | number;
export interface ScopeStats {
  open: number;
  done: number;
}
interface NavigationProps {
  projects: Project[];
  tasks: Task[];
  stats: Map<ProjectScope, ScopeStats>;
  scope: ProjectScope;
  onSelect: (scope: ProjectScope) => void;
  onNew: () => void;
}

function deadlineHint(tasks: Task[]) {
  const open = tasks.filter((task) => !task.completedAt && !task.deletedAt);
  const overdue = open.filter((task) => isTaskOverdue(task)).length;
  if (overdue) return { label: `Overdue ${overdue}`, overdue: true };
  const deadline = open
    .map(taskDeadline)
    .filter((date): date is Date => !!date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return {
    label: deadline ? `Due ${format(deadline, "EEE")}` : "No deadlines",
    overdue: false,
  };
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  return (
    <svg
      aria-label={`${done} of ${total} tasks done`}
      role="img"
      viewBox="0 0 20 20"
      className="size-5 shrink-0 -rotate-90"
    >
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="var(--muted)"
        strokeWidth="2"
      />
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${total ? (done / total) * 100 : 0} 100`}
      />
    </svg>
  );
}

function entriesFor({ projects, tasks, stats }: NavigationProps) {
  const closedIds = new Set(
    projects.filter((p) => p.status === "Closed").map((p) => p.id),
  );
  const entries: {
    scope: ProjectScope;
    title: string;
    icon?: string;
    tasks: Task[];
  }[] = [
    {
      scope: "all",
      title: "All tasks",
      tasks: tasks.filter((t) => !closedIds.has(t.projectId ?? undefined)),
    },
  ];
  const none = stats.get("none");
  if ((none?.open || 0) + (none?.done || 0) > 0)
    entries.push({
      scope: "none",
      title: "No project",
      icon: undefined,
      tasks: tasks.filter((t) => !t.projectId),
    });
  for (const project of projects.filter((p) => p.status !== "Closed"))
    entries.push({
      scope: project.id!,
      title: project.title,
      icon: project.icon,
      tasks: tasks.filter((t) => t.projectId === project.id),
    });
  return entries;
}

function ScopeIcon({
  scope,
  icon,
  className,
}: {
  scope: ProjectScope;
  icon?: string;
  className: string;
}) {
  if (scope === "all") return <ListChecks className={className} aria-hidden />;
  if (scope === "none")
    return <CircleDashed className={className} aria-hidden />;
  return <ProjectIcon name={icon} className={className} />;
}

export function ProjectRail(props: NavigationProps) {
  const [showArchived, setShowArchived] = useState(false);
  const archived = props.projects.filter((p) => p.status === "Closed");
  const archivedSelected = archived.some((p) => p.id === props.scope);
  useEffect(() => {
    if (archivedSelected) setShowArchived(true);
  }, [archivedSelected]);
  const row = (
    scope: ProjectScope,
    title: string,
    tasks: Task[],
    icon?: string,
  ) => {
    const stats = props.stats.get(scope) || { open: 0, done: 0 };
    const hint = deadlineHint(tasks);
    const active = props.scope === scope;
    return (
      <button
        key={scope}
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={() => props.onSelect(scope)}
        className={cn(
          "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary",
          active ? "bg-primary/12" : "hover:bg-muted/50",
        )}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg bg-muted",
            active ? "text-primary" : "text-muted-foreground",
          )}
        >
          <ScopeIcon scope={scope} icon={icon} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span
            className={cn(
              "mt-0.5 block text-xs",
              hint.overdue
                ? "font-mono tabular-nums text-destructive"
                : "text-muted-foreground",
            )}
          >
            {hint.label}
          </span>
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {stats.open}
        </span>
        <span className={active ? "text-primary" : "text-muted-foreground"}>
          <ProgressRing done={stats.done} total={stats.done + stats.open} />
        </span>
      </button>
    );
  };
  return (
    <aside className="sticky top-0 hidden max-h-[calc(100dvh-7rem)] w-64 shrink-0 flex-col rounded-2xl border bg-card p-5 shadow-xs lg:flex xl:w-72">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-sm font-semibold tracking-tight">Projects</h1>
        <button
          type="button"
          onClick={props.onNew}
          className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Plus className="size-4" />
          New project
        </button>
      </div>
      <nav
        aria-label="Projects"
        className="min-h-0 space-y-1 overflow-y-auto overscroll-contain"
      >
        {entriesFor(props).map((entry) =>
          row(entry.scope, entry.title, entry.tasks, entry.icon),
        )}
        {props.projects.every((p) => p.status === "Closed") && (
          <div className="mt-3 rounded-xl bg-muted/40 p-3">
            <p className="text-sm font-medium">Room for your projects</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create one for University, Work, or whatever comes next.
            </p>
          </div>
        )}
        {archived.length > 0 && (
          <div className="mt-4 border-t pt-2">
            <button
              type="button"
              aria-expanded={showArchived}
              onClick={() => setShowArchived(!showArchived)}
              className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ChevronRight
                className={cn(
                  "size-3.5 motion-safe:transition-transform",
                  showArchived && "rotate-90",
                )}
              />
              Archived
              <span className="ml-auto font-mono text-xs tabular-nums">
                {archived.length}
              </span>
            </button>
            {showArchived &&
              archived.map((p) =>
                row(
                  p.id!,
                  p.title,
                  props.tasks.filter((t) => t.projectId === p.id),
                  p.icon,
                ),
              )}
          </div>
        )}
      </nav>
    </aside>
  );
}

export function ProjectTiles(props: NavigationProps) {
  const [showArchived, setShowArchived] = useState(false);
  const archived = props.projects.filter((p) => p.status === "Closed");
  const tile = (
    scope: ProjectScope,
    title: string,
    tasks: Task[],
    icon?: string,
  ) => {
    const stats = props.stats.get(scope) || { open: 0, done: 0 };
    const total = stats.open + stats.done;
    const hint = deadlineHint(tasks);
    return (
      <button
        key={scope}
        type="button"
        onClick={() => props.onSelect(scope)}
        className="flex min-w-0 flex-col rounded-xl bg-muted/40 p-4 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="mb-3 flex w-full items-center justify-between gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
            <ScopeIcon scope={scope} icon={icon} className="size-4" />
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {stats.open} open
          </span>
        </span>
        <span className="w-full truncate text-sm font-medium">{title}</span>
        <span
          className={cn(
            "mt-1 text-xs",
            hint.overdue
              ? "font-mono tabular-nums text-destructive"
              : "text-muted-foreground",
          )}
        >
          {hint.label}
        </span>
        <span
          role="progressbar"
          aria-label={`${title} completion`}
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-valuenow={stats.done}
          className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-muted-foreground/50"
            style={{ width: `${total ? (stats.done / total) * 100 : 0}%` }}
          />
        </span>
      </button>
    );
  };
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-xs lg:hidden">
      <header className="mb-5 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            A place for everything on your list.
          </p>
        </div>
        <button
          type="button"
          onClick={props.onNew}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Plus className="size-4" />
          New project
        </button>
      </header>
      <nav aria-label="Projects" className="grid min-w-0 grid-cols-2 gap-2">
        {entriesFor(props).map((entry) =>
          tile(entry.scope, entry.title, entry.tasks, entry.icon),
        )}
      </nav>
      {props.projects.every((p) => p.status === "Closed") && (
        <div className="mt-4 rounded-xl bg-muted/40 p-4">
          <p className="text-sm font-medium">Make space for a project</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add University or Work, then give it an icon you recognise.
          </p>
        </div>
      )}
      {archived.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived(!showArchived)}
            className="flex h-10 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ChevronRight
              className={cn(
                "size-3.5 motion-safe:transition-transform",
                showArchived && "rotate-90",
              )}
            />
            Archived
            <span className="font-mono text-xs tabular-nums">
              {archived.length}
            </span>
          </button>
          {showArchived && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {archived.map((p) =>
                tile(
                  p.id!,
                  p.title,
                  props.tasks.filter((t) => t.projectId === p.id),
                  p.icon,
                ),
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
