"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTasks } from "@/hooks/useTasks";
import { isTaskOverdue, subtaskProgress, taskDeadline, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function TaskSubtasks({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { tasks, addTask, updateTask } = useTasks();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (task.parentId != null || task.id == null) return null;
  const children = tasks.filter((child) => child.parentId === task.id && !child.deletedAt).sort((a, b) => a.order - b.order);
  const progress = subtaskProgress(tasks, task.id);
  return (
    <section className="space-y-2" aria-label="Subtasks">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">Subtasks</h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{progress.done}/{progress.total}</span>
      </div>
      <div className="rounded-xl bg-muted/40 p-1">
        {children.map((child) => {
          const due = taskDeadline(child);
          return <div key={child.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50">
            <button type="button" role="checkbox" aria-checked={!!child.completedAt} aria-label={child.completedAt ? `Reopen ${child.title}` : `Complete ${child.title}`}
              disabled={!!task.deletedAt} onClick={() => void updateTask(child.id!, { completedAt: child.completedAt ? null : new Date() }).catch(() => toast.error("Could not update subtask"))}
              className={cn("grid size-4 shrink-0 place-items-center rounded-full ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", child.completedAt ? "bg-primary text-primary-foreground ring-primary" : "ring-muted-foreground/40 hover:ring-primary")}>
              {child.completedAt && <Check className="size-3" />}
            </button>
            <button type="button" onClick={() => onOpen(child)} className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className={cn("truncate text-sm", child.completedAt && "text-muted-foreground line-through")}>{child.title}</p>
              {due && <p className={cn("font-mono text-xs tabular-nums", isTaskOverdue(child) ? "text-destructive" : "text-muted-foreground")}>{format(due, child.dueTime ? "MMM d · HH:mm" : "MMM d")}</p>}
            </button>
          </div>;
        })}
        {!task.deletedAt && <form onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim() || busy) return;
          setBusy(true);
          try { await addTask(title, { parentId: task.id }); setTitle(""); }
          catch (error) { toast.error(error instanceof Error ? error.message : "Could not add subtask"); }
          finally { setBusy(false); input.current?.focus(); }
        }}>
          <input ref={input} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Add a subtask" placeholder="Add a subtask"
            readOnly={busy} className="h-9 w-full rounded-lg bg-transparent px-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </form>}
      </div>
    </section>
  );
}
