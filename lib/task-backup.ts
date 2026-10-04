import type { Task, TaskFilter } from "./tasks";

export interface SavedTask extends Omit<
  Task,
  "dueDate" | "completedAt" | "deletedAt" | "createdAt" | "updatedAt"
> {
  dueDate?: string | null;
  completedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SavedTaskFilter extends Omit<
  TaskFilter,
  "createdAt" | "updatedAt"
> {
  createdAt: string;
  updatedAt: string;
}
export function serializeTask(task: Task): SavedTask {
  return {
    ...task,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    deletedAt: task.deletedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
export function deserializeTask(task: SavedTask): Task {
  const date = (value: string) => {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()))
      throw new Error("Backup contains an invalid task date");
    return parsed;
  };
  if (
    typeof task.title !== "string" ||
    !task.title.trim() ||
    typeof task.description !== "string" ||
    !Number.isFinite(task.estimateMinutes) ||
    task.estimateMinutes < 0 ||
    !Number.isInteger(task.priority) ||
    task.priority < 0 ||
    task.priority > 3 ||
    !Number.isFinite(task.order) ||
    !Array.isArray(task.tags) ||
    task.tags.some((tag) => typeof tag !== "string")
  )
    throw new Error("Backup contains an invalid task");
  if (
    task.dueDay &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDay) ||
      new Date(`${task.dueDay}T00:00:00Z`).toISOString().slice(0, 10) !==
        task.dueDay)
  )
    throw new Error("Backup contains an invalid task deadline");
  return {
    ...task,
    dueDate: task.dueDate ? date(task.dueDate) : null,
    completedAt: task.completedAt ? date(task.completedAt) : null,
    deletedAt: task.deletedAt ? date(task.deletedAt) : null,
    createdAt: date(task.createdAt),
    updatedAt: date(task.updatedAt),
  };
}

export function deserializeTaskFilter(filter: SavedTaskFilter): TaskFilter {
  const createdAt = new Date(filter.createdAt),
    updatedAt = new Date(filter.updatedAt);
  const c = filter.criteria;
  if (
    typeof filter.name !== "string" ||
    !filter.name.trim() ||
    !c ||
    !Number.isFinite(createdAt.getTime()) ||
    !Number.isFinite(updatedAt.getTime()) ||
    (c.projectId != null && !Number.isInteger(c.projectId)) ||
    (c.tag !== undefined && typeof c.tag !== "string") ||
    (c.priority !== undefined &&
      (!Number.isInteger(c.priority) || c.priority < 0 || c.priority > 3)) ||
    (c.date !== undefined &&
      !["any", "today", "overdue", "upcoming", "undated"].includes(c.date)) ||
    (c.completion !== undefined &&
      !["active", "completed", "all"].includes(c.completion)) ||
    (c.maxEstimate !== undefined &&
      (!Number.isFinite(c.maxEstimate) || c.maxEstimate < 0))
  )
    throw new Error("Backup contains an invalid task filter");
  return { ...filter, createdAt, updatedAt };
}
