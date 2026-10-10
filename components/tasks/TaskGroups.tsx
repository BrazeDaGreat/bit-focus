"use client";

import { useState, type ReactNode } from "react";
import { differenceInCalendarDays, endOfWeek } from "date-fns";
import { ChevronRight } from "lucide-react";
import { isTaskOverdue, taskDeadline, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export interface TaskRowExtras {
  parentTitle?: string;
  subtaskProgress?: { done: number; total: number };
  expanded?: boolean;
  onToggleSubtasks?: () => void;
}

const zones = [
  "Overdue",
  "Today",
  "Tomorrow",
  "This week",
  "Later",
  "No date",
] as const;
function deadlineZone(task: Task) {
  if (isTaskOverdue(task)) return "Overdue";
  const due = taskDeadline(task);
  if (!due) return "No date";
  const now = new Date();
  const days = differenceInCalendarDays(due, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (due <= endOfWeek(now, { weekStartsOn: 1 })) return "This week";
  return "Later";
}

export function TaskGroups({
  open,
  done,
  trashed,
  allTasks,
  archived,
  renderRow,
  expanded,
  onToggleSubtasks,
}: {
  open: Task[];
  done: Task[];
  trashed: Task[];
  allTasks: Task[];
  archived?: boolean;
  renderRow: (task: Task, extras: TaskRowExtras) => ReactNode;
  expanded: Set<number>;
  onToggleSubtasks: (id: number) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const byId = new Map(allTasks.map((task) => [task.id, task]));
  const openIds = new Set(open.map((task) => task.id));
  const doneVisible = done.filter(
    (task) => !task.parentId || !openIds.has(task.parentId),
  );
  const openOrDoneIds = new Set([...open, ...done].map((task) => task.id));
  const doneIds = new Set(doneVisible.map((task) => task.id));
  const trashIds = new Set(trashed.map((task) => task.id));
  const childrenByParent = new Map<number, Task[]>();
  for (const task of allTasks) {
    if (task.parentId == null || task.parentId === task.id) continue;
    const siblings = childrenByParent.get(task.parentId) || [];
    siblings.push(task);
    childrenByParent.set(task.parentId, siblings);
  }
  for (const siblings of childrenByParent.values())
    siblings.sort((a, b) => a.order - b.order || a.id! - b.id!);
  const roots = (collection: Task[]) => {
    const ids = new Set(collection.map((task) => task.id));
    return collection.filter(
      (task) =>
        !task.parentId || task.parentId === task.id || !ids.has(task.parentId),
    );
  };
  const nestedRow = (task: Task, collection: Task[]) => {
    // Completed children remain under their open parent; open children of a
    // completed parent instead become roots in their own deadline zone.
    const candidates = childrenByParent.get(task.id!) || [];
    const visibleIds =
      collection === open
        ? openOrDoneIds
        : collection === doneVisible
          ? doneIds
          : trashIds;
    const children = candidates.filter((child) => visibleIds.has(child.id));
    const progressChildren = candidates.filter(
      (child) => task.deletedAt || !child.deletedAt,
    );
    const parent = task.parentId ? byId.get(task.parentId) : undefined;
    const isExpanded = expanded.has(task.id!);
    return (
      <div key={task.id} className="min-w-0">
        {renderRow(task, {
          parentTitle: parent?.title,
          ...(children.length > 0 && {
            subtaskProgress: {
              done: progressChildren.filter((child) => child.completedAt)
                .length,
              total: progressChildren.length,
            },
            expanded: isExpanded,
            onToggleSubtasks: () => onToggleSubtasks(task.id!),
          }),
        })}
        {isExpanded && children.length > 0 && (
          <div className="relative min-w-0 pl-8">
            <span
              aria-hidden
              className="absolute bottom-2 left-4 top-0 w-px bg-border"
            />
            {children.map((child) => (
              <div key={child.id}>{renderRow(child, {})}</div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const openRoots = roots(open);
  return (
    <div className="min-w-0">
      {open.length === 0 && (
        <div className="rounded-xl bg-muted/40 p-5">
          <p className="text-sm font-medium">
            {done.length ? "Everything here is done" : "No open tasks yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {archived
              ? "Restore this project from its options to add new tasks."
              : "Add your next task above. Give it a deadline to see it on the runway."}
          </p>
        </div>
      )}
      {zones.map((zone) => {
        const tasks = openRoots.filter((task) => deadlineZone(task) === zone);
        if (!tasks.length) return null;
        return (
          <section key={zone} aria-label={zone} className="mb-5 last:mb-0">
            <div className="mb-2 flex items-center gap-2.5">
              <h3
                className={cn(
                  "text-[11px] font-medium uppercase tracking-[0.1em]",
                  zone === "Overdue"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {zone}
              </h3>
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  zone === "Overdue"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {tasks.length}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {tasks.map((task) => nestedRow(task, open))}
          </section>
        );
      })}
      {doneVisible.length > 0 && (
        <FoldSection
          label="Completed"
          count={doneVisible.length}
          open={showDone}
          onToggle={() => setShowDone(!showDone)}
        >
          {roots(doneVisible).map((task) => nestedRow(task, doneVisible))}
        </FoldSection>
      )}
      {trashed.length > 0 && (
        <FoldSection
          label="Trash"
          count={trashed.length}
          open={showTrash}
          onToggle={() => setShowTrash(!showTrash)}
        >
          {roots(trashed).map((task) => nestedRow(task, trashed))}
        </FoldSection>
      )}
    </div>
  );
}

function FoldSection({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ChevronRight
          className={cn(
            "size-3.5 motion-safe:transition-transform",
            open && "rotate-90",
          )}
        />
        {label}
        <span className="font-mono tabular-nums">{count}</span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </section>
  );
}
