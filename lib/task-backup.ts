import type { Task, TaskFilter } from "./tasks";
import type { TaskAttachment } from "./db";

export interface SavedTask extends Omit<
  Task,
  "dueDate" | "completedAt" | "deletedAt" | "createdAt" | "updatedAt"
> {
  dueDate?: string | null;
  completedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  parentUid?: string | null;
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

/** Portable parent links; numeric IDs remain only as row keys in the backup. */
export function serializeTasks(tasks: Task[]): SavedTask[] {
  return tasks.map((task) => {
    const saved = serializeTask(task);
    delete saved.parentId;
    if (task.parentId != null) {
      const parent = tasks.find((row) => row.id === task.parentId);
      if (!parent?.uid) throw new Error("Cannot back up a task with a missing parent");
      saved.parentUid = parent.uid;
    }
    return saved;
  });
}

export function deserializeTasks(saved: SavedTask[]): Task[] {
  const tasks = saved.map(deserializeTask);
  let nextId = Math.max(0, ...tasks.map((task) => task.id ?? 0)) + 1;
  const byUid = new Map<string, Task>();
  for (const task of tasks) {
    task.id ??= nextId++;
    if (task.uid) byUid.set(task.uid, task);
  }
  tasks.forEach((task, index) => {
    const parentUid = saved[index].parentUid;
    delete (task as Task & { parentUid?: string | null }).parentUid;
    if (parentUid != null) {
      const parent = byUid.get(parentUid);
      if (!parent) throw new Error("Backup contains an invalid task parent");
      task.parentId = parent.id;
    }
  });
  for (const task of tasks) {
    if (task.parentId == null) continue;
    const parent = tasks.find((row) => row.id === task.parentId);
    if (!parent || parent === task || parent.parentId != null ||
        (task.projectId ?? null) !== (parent.projectId ?? null))
      throw new Error("Backup contains an invalid task parent");
  }
  return tasks;
}

export interface SavedTaskAttachment extends Omit<TaskAttachment, "blob" | "createdAt"> {
  base64: string;
  createdAt: string;
}

export async function serializeAttachment(attachment: TaskAttachment): Promise<SavedTaskAttachment> {
  const { blob, ...metadata } = attachment;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192)
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  return { ...metadata, createdAt: attachment.createdAt.toISOString(), base64: btoa(chunks.join("")) };
}

export function deserializeAttachment(saved: SavedTaskAttachment): TaskAttachment {
  const { base64, ...metadata } = saved;
  const createdAt = new Date(saved.createdAt);
  if (!saved.uid || !saved.taskUid || typeof saved.name !== "string" || typeof saved.type !== "string" ||
      !Number.isFinite(createdAt.getTime()) || !Number.isInteger(saved.size) || saved.size < 0 ||
      saved.size > 25 * 1024 * 1024 || typeof base64 !== "string")
    throw new Error("Backup contains an invalid task attachment");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  if (bytes.length !== saved.size) throw new Error("Backup contains an invalid task attachment size");
  return { ...metadata, createdAt, blob: new Blob([bytes], { type: saved.type }) };
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
