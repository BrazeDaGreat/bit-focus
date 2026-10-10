"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Play, X, Trash2, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { TaskNotesEditor } from "./TaskNotesEditor";
import { TaskSubtasks } from "./TaskSubtasks";
import { useTaskAttachments } from "@/hooks/useAttachments";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useTag } from "@/hooks/useTag";
import { useFocus } from "@/hooks/useFocus";
import { useTimeblocks } from "@/hooks/useTimeblocks";
import { cn } from "@/lib/utils";
import { DeadlinePicker, ProjectPicker } from "./TaskPickers";
import {
  isTaskOverdue,
  taskDeadline,
  taskMinutes,
  formatMinutes,
  type Task,
} from "@/lib/tasks";

const priorities = ["None", "Low", "Medium", "High"];

export function TaskDetails({
  task,
  onClose,
  onFocus,
  onOpenTask = () => {},
}: {
  task: Task;
  onClose: () => void;
  onFocus: (task: Task) => void;
  onOpenTask?: (task: Task) => void;
}) {
  const { tasks, updateTask, removeForever } = useTasks();
  const attachments = useTaskAttachments(task.uid);
  const parent = task.parentId != null ? tasks.find((row) => row.id === task.parentId) : undefined;
  const { projects } = useProjects();
  const { savedTags } = useTag();
  const { focusSessions } = useFocus();
  const { timeblocks } = useTimeblocks();
  const [title, setTitle] = useState(task.title);
  const [busy, setBusy] = useState(false);
  useEffect(() => setTitle(task.title), [task.title]);
  const sessions = focusSessions.filter((s) => s.taskUid === task.uid);
  const blocks = timeblocks.filter((b) => b.taskUid === task.uid);
  const deadline = taskDeadline(task);
  const save = async (updates: Partial<Task>) => {
    try {
      await updateTask(task.id!, updates);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save task",
      );
    }
  };
  const changeDeadline = (day: string | null) => {
    if (!day) {
      void save({ dueDate: null, dueDay: null, dueTime: false });
      return;
    }
    // Keep an existing time of day when only the date changes.
    const time = task.dueTime && deadline ? format(deadline, "HH:mm") : "00:00";
    void save({
      dueDate: new Date(`${day}T${time}`),
      dueDay: day,
      dueTime: !!task.dueTime,
    });
  };
  const toggleTag = (tag: string) => {
    const tags = task.tags.includes(tag)
      ? task.tags.filter((t) => t !== tag)
      : [...task.tags, tag];
    void save({
      tags,
      primaryTag:
        task.primaryTag && tags.includes(task.primaryTag)
          ? task.primaryTag
          : tags[0] || null,
    });
  };
  const moveToTrash = async () => {
    setBusy(true);
    try {
      await updateTask(task.id!, { deletedAt: new Date() });
      toast("Task deleted", {
        action: { label: "Undo", onClick: () => void save({ deletedAt: null }) },
      });
      onClose();
    } catch {
      toast.error("Could not delete task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      {parent && <button type="button" onClick={() => onOpenTask(parent)} className="rounded-lg bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Part of <span className="text-foreground">{parent.title}</span></button>}
      <div className="flex items-start gap-2">
        <Input
          aria-label="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== task.title)
              void save({ title }).then(() => {
                if (!title.trim()) setTitle(task.title);
              });
          }}
          className="h-auto flex-1 border-0 bg-transparent px-0 py-1 text-lg font-semibold shadow-none md:text-lg focus-visible:ring-2"
          disabled={!!task.deletedAt}
        />
        <button
          onClick={onClose}
          aria-label="Close task details"
          className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {task.deletedAt ? (
          <>
            <Button size="sm" onClick={() => void save({ deletedAt: null })}>
              <RotateCcw className="size-4" />
              Restore
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Permanently delete this task? Focus history will be kept.",
                  )
                )
                  return;
                setBusy(true);
                try {
                  await removeForever(task.id!);
                  onClose();
                } catch {
                  toast.error("Could not delete task");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="size-4" />
              Delete forever
            </Button>
          </>
        ) : (
          <>
            {!task.completedAt && (
              <Button size="sm" onClick={() => onFocus(task)}>
                <Play className="size-3.5" />
                Start focus
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void save({ completedAt: task.completedAt ? null : new Date() })
              }
            >
              <Check className="size-4" />
              {task.completedAt ? "Reopen" : "Complete"}
            </Button>
          </>
        )}
      </div>

      <fieldset
        disabled={!!task.deletedAt}
        className="flex flex-col gap-4 disabled:opacity-60"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="text-xs text-muted-foreground">
            Project
            <ProjectPicker
              value={task.projectId ?? null}
              projects={projects}
              onChange={(projectId) => void save({ projectId, section: "" })}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Deadline
            <DeadlinePicker
              value={deadline}
              overdue={isTaskOverdue(task)}
              onChange={changeDeadline}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`task-estimate-${task.id}`}
            className="text-xs text-muted-foreground"
          >
            Estimate
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {[15, 30, 60, 120].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={task.estimateMinutes === m}
                onClick={() =>
                  void save({
                    estimateMinutes: task.estimateMinutes === m ? 0 : m,
                  })
                }
                className={cn(
                  "h-8 rounded-lg px-2.5 font-mono text-xs tabular-nums",
                  task.estimateMinutes === m
                    ? "bg-primary/12 text-primary"
                    : "bg-muted/50 hover:bg-muted",
                )}
              >
                {formatMinutes(m)}
              </button>
            ))}
            <Input
              key={`estimate-${task.estimateMinutes}`}
              id={`task-estimate-${task.id}`}
              aria-label="Estimated minutes"
              type="number"
              min="0"
              max="100000"
              defaultValue={task.estimateMinutes || ""}
              placeholder="min"
              onBlur={(e) =>
                void save({ estimateMinutes: Number(e.target.value) })
              }
              className="h-8 w-20 font-mono text-xs tabular-nums"
            />
          </div>
        </div>

        <div role="group" aria-label="Task priority">
          <p className="text-xs text-muted-foreground">Priority</p>
          <div className="mt-1.5 inline-flex rounded-lg bg-muted/50 p-0.5">
            {priorities.map((p, i) => (
              <button
                key={p}
                type="button"
                aria-pressed={task.priority === i}
                onClick={() => void save({ priority: i })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  task.priority === i
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {(savedTags.length > 0 || task.tags.length > 0) && (
          <div role="group" aria-label="Task tags">
            <p className="text-xs text-muted-foreground">Tags</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[...new Set([...savedTags.map((t) => t.t), ...task.tags])].map(
                (tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={task.tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs",
                      task.tags.includes(tag)
                        ? "bg-primary/12 text-primary"
                        : "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        background:
                          savedTags.find((t) => t.t === tag)?.c ||
                          "var(--muted-foreground)",
                      }}
                    />
                    {tag}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
      </fieldset>

      <TaskNotesEditor key={task.uid ?? task.id} task={task} files={attachments} onSave={(description) => updateTask(task.id!, { description })} />
      <TaskSubtasks key={`subtasks-${task.id}`} task={task} onOpen={onOpenTask} />

      <div className="mt-auto space-y-1 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-mono tabular-nums">
          <span className="text-foreground">
            {formatMinutes(taskMinutes(task, focusSessions))} /{" "}
            {task.estimateMinutes ? formatMinutes(task.estimateMinutes) : "—"}
          </span>{" "}
          focused
          {sessions.length > 0 &&
            ` · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
        </p>
        {blocks.length > 0 && <p>Calendar blocks · {blocks.length}</p>}
        {task.completedAt && (
          <p>Completed {format(new Date(task.completedAt), "MMM d, yyyy")}</p>
        )}
        {!task.deletedAt && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={moveToTrash}
            className="-ml-3 mt-2 text-destructive"
          >
            <Trash2 className="size-4" />
            Delete task
          </Button>
        )}
      </div>
    </div>
  );
}
