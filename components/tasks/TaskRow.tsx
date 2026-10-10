"use client";

import { Check, Play, Clock3, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  formatMinutes,
  isTaskOverdue,
  taskDeadline,
  type Task,
} from "@/lib/tasks";
import { useTag } from "@/hooks/useTag";
import { ProjectIcon } from "./ProjectIcon";

interface TaskRowProps {
  task: Task;
  project?: string;
  projectIcon?: string;
  parentTitle?: string;
  subtaskProgress?: { done: number; total: number };
  expanded?: boolean;
  onToggleSubtasks?: () => void;
  actualMinutes: number;
  active?: boolean;
  selected?: boolean;
  onSelect: () => void;
  onComplete: () => void;
  onFocus: () => void;
}
export function TaskRow({
  task,
  project,
  projectIcon,
  parentTitle,
  subtaskProgress,
  expanded,
  onToggleSubtasks,
  actualMinutes,
  active,
  selected,
  onSelect,
  onComplete,
  onFocus,
}: TaskRowProps) {
  const savedTags = useTag((s) => s.savedTags);
  const deadline = taskDeadline(task);
  return (
    <div
      className={cn(
        "group flex min-w-0 items-start gap-2.5 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted/50",
        selected && "bg-primary/12",
        task.completedAt && "opacity-60",
      )}
    >
      {subtaskProgress && (
        <button
          type="button"
          onClick={onToggleSubtasks}
          aria-expanded={!!expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} subtasks of ${task.title}`}
          className="grid size-6 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronRight
            className={cn(
              "size-3.5 motion-safe:transition-transform",
              expanded && "rotate-90",
            )}
          />
        </button>
      )}
      <button
        onClick={onComplete}
        disabled={!!task.deletedAt}
        aria-pressed={!!task.completedAt}
        aria-label={
          task.completedAt ? `Reopen ${task.title}` : `Complete ${task.title}`
        }
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-primary",
          task.completedAt
            ? "border-primary bg-primary text-primary-foreground"
            : task.priority === 3
              ? "border-destructive"
              : task.priority === 2
                ? "border-primary/60"
                : "border-muted-foreground/40",
        )}
      >
        {task.completedAt && <Check className="size-3" />}
      </button>
      <button
        onClick={onSelect}
        aria-label={`Open ${task.title}`}
        className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-primary rounded-lg"
      >
        <span
          className={cn(
            "block text-sm font-medium break-words",
            task.completedAt && "line-through",
          )}
        >
          {task.title}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {subtaskProgress && (
            <span
              className="font-mono tabular-nums"
              aria-label={`${subtaskProgress.done} of ${subtaskProgress.total} subtasks done`}
            >
              {subtaskProgress.done}/{subtaskProgress.total}
            </span>
          )}
          {parentTitle && (
            <span className="max-w-full truncate">↳ {parentTitle}</span>
          )}
          {project && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
              <ProjectIcon name={projectIcon} className="size-3.5 shrink-0" />
              <span className="truncate">{project}</span>
            </span>
          )}
          {deadline && (
            <span
              className={cn(
                "font-mono tabular-nums",
                isTaskOverdue(task) && "text-destructive",
              )}
            >
              {format(deadline, task.dueTime ? "MMM d · h:mm a" : "MMM d")}
            </span>
          )}
          {(task.estimateMinutes > 0 || actualMinutes > 0) && (
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Clock3 className="size-3" />
              {actualMinutes > 0 ? `${formatMinutes(actualMinutes)} / ` : ""}
              {task.estimateMinutes
                ? formatMinutes(task.estimateMinutes)
                : "No estimate"}
            </span>
          )}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex min-w-0 max-w-full items-center gap-1"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    savedTags.find((t) => t.t === tag)?.c ||
                    "var(--muted-foreground)",
                }}
              />
              <span className="truncate">{tag}</span>
            </span>
          ))}
        </span>
      </button>
      {!task.completedAt && !task.deletedAt && (
        <button
          onClick={onFocus}
          aria-label={`Start focus on ${task.title}`}
          title="Start focus"
          aria-pressed={!!active}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-primary/12 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
            active && "bg-primary/12 text-primary",
          )}
        >
          <Play className="size-3.5" />
        </button>
      )}
    </div>
  );
}
