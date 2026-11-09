"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  ChevronRight,
  CircleDashed,
  ListChecks,
  Plus,
} from "lucide-react";
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

function entriesFor({ projects, tasks, stats, scope }: NavigationProps) {
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
  if (scope === "none" || (none?.open || 0) + (none?.done || 0) > 0)
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

/**
 * Mobile project filter: a horizontally scrolling row of chips above the task
 * list. Projects act as filters on one to-do list rather than as a separate
 * index page, so the list is always one tap away.
 */
export function ProjectChips(props: NavigationProps) {
  const [showArchived, setShowArchived] = useState(false);
  const activeRef = useRef<HTMLButtonElement>(null);
  const archived = props.projects.filter((p) => p.status === "Closed");
  const archivedSelected = archived.some((p) => p.id === props.scope);
  useEffect(() => {
    if (archivedSelected) setShowArchived(true);
  }, [archivedSelected]);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [props.scope, showArchived]);
  const chip = (
    scope: ProjectScope,
    title: string,
    tasks: Task[],
    icon?: string,
  ) => {
    const stats = props.stats.get(scope) || { open: 0, done: 0 };
    const overdue = deadlineHint(tasks).overdue;
    const active = props.scope === scope;
    return (
      <button
        key={scope}
        ref={active ? activeRef : undefined}
        type="button"
        aria-pressed={active}
        onClick={() => props.onSelect(scope)}
        className={cn(
          "flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100",
          active
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <ScopeIcon scope={scope} icon={icon} className="size-3.5 shrink-0" />
        <span className="max-w-40 truncate">{title}</span>
        {stats.open > 0 && (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              active ? "text-primary/80" : "text-muted-foreground/80",
            )}
          >
            {stats.open}
          </span>
        )}
        {overdue && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-destructive"
            aria-label="Has overdue tasks"
          />
        )}
      </button>
    );
  };
  return (
    <div className="-mx-3 mb-4 sm:-mx-6 lg:hidden">
      <nav
        aria-label="Filter by project"
        className="no-scroll-wheel flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain scroll-px-3 px-3 py-1 sm:scroll-px-6 sm:px-6"
      >
        {entriesFor(props).map((entry) =>
          chip(entry.scope, entry.title, entry.tasks, entry.icon),
        )}
        {archived.length > 0 && (
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived(!showArchived)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Archive className="size-3.5" />
            Archived
            <span className="font-mono text-xs tabular-nums">
              {archived.length}
            </span>
            <ChevronRight
              className={cn(
                "size-3.5 motion-safe:transition-transform",
                showArchived && "rotate-180",
              )}
            />
          </button>
        )}
        {showArchived &&
          archived.map((p) =>
            chip(
              p.id!,
              p.title,
              props.tasks.filter((t) => t.projectId === p.id),
              p.icon,
            ),
          )}
        <button
          type="button"
          onClick={props.onNew}
          aria-label="New project"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Plus className="size-3.5" />
          Project
        </button>
      </nav>
    </div>
  );
}
