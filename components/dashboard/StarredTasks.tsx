"use client";

/**
 * @fileoverview Starred tasks on Home.
 *
 * Starring records intent, not a schedule: the list keeps the order tasks were
 * starred in and never nags about them. A row click starts focus; the context
 * menu (or long-press) unstars or opens the task in Projects. Renders nothing
 * while no active task is starred.
 */

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Play, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTasks } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { usePomo } from "@/hooks/PomoContext";
import { isTaskOverdue, starredTasks, taskDeadline, type Task } from "@/lib/tasks";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { TaskRowActions } from "@/components/tasks/TaskRowActions";

/** Rows shown before the "+n more" toggle. */
const VISIBLE = 5;

export default function StarredTasks({ className }: { className?: string }): JSX.Element | null {
  const { tasks, updateTask } = useTasks();
  const { projects } = useProjects();
  const { startTask, state } = usePomo();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const starred = starredTasks(tasks);
  if (!starred.length) return null;
  const shown = expanded ? starred : starred.slice(0, VISIBLE);

  const open = (task: Task) => router.push(`/projects?task=${encodeURIComponent(task.uid!)}`);
  const focus = (task: Task) => startTask({
    uid: task.uid!,
    projectUid: projects.find((p) => p.id === task.projectId)?.uid,
    title: task.title,
    tag: task.primaryTag || task.tags[0] || "Focus",
  });
  const complete = (task: Task) =>
    void updateTask(task.id!, { completedAt: new Date() }).catch(() => toast.error("Could not complete task"));

  return (
    <section aria-label="Starred tasks" className={className}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Star className="size-3 fill-current text-primary" aria-hidden="true" />
        Starred
      </p>
      <ul>
        {shown.map((task) => {
          const project = projects.find((p) => p.id === task.projectId);
          const deadline = taskDeadline(task);
          const active = state.isRunning && state.task?.uid === task.uid;
          return (
            <li key={task.id}>
              <TaskRowActions task={task} brief openLabel="Open in Projects"
                onOpen={() => open(task)} onComplete={() => complete(task)} onFocus={() => focus(task)}>
                <div className={cn(
                  "group flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-muted/50",
                  active && "bg-primary/12",
                )}>
                  <button
                    type="button"
                    onClick={() => complete(task)}
                    aria-label={`Complete ${task.title}`}
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-md border-2 focus-visible:outline-2 focus-visible:outline-primary",
                      task.priority === 3 ? "border-destructive" : task.priority === 2 ? "border-primary/60" : "border-muted-foreground/40",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => focus(task)}
                    aria-label={`Start focus on ${task.title}`}
                    aria-pressed={active}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className={cn("min-w-0 flex-1 truncate text-sm", active && "text-primary")}>{task.title}</span>
                    {project && (
                      <span className="hidden min-w-0 max-w-[40%] items-center gap-1.5 text-[11px] text-muted-foreground min-[420px]:inline-flex">
                        <ProjectIcon name={project.icon} className="size-3.5 shrink-0" />
                        <span className="truncate">{project.title}</span>
                      </span>
                    )}
                    {deadline && (
                      <span className={cn("shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground", isTaskOverdue(task) && "text-destructive")}>
                        {format(deadline, task.dueTime ? "MMM d · h:mm a" : "MMM d")}
                      </span>
                    )}
                    <Play className={cn(
                      "size-3 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-60",
                      active && "opacity-100",
                    )} aria-hidden="true" />
                  </button>
                </div>
              </TaskRowActions>
            </li>
          );
        })}
      </ul>
      {starred.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="ml-2 mt-0.5 rounded-md px-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {expanded ? "Show less" : `+${starred.length - VISIBLE} more`}
        </button>
      )}
    </section>
  );
}
