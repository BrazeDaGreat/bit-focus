import type { FocusSession } from "@/hooks/useFocus";

export interface Task {
  id?: number;
  uid?: string;
  projectId?: number | null;
  /** Parent task (local id). Subtasks are one level deep: a subtask never has children. */
  parentId?: number | null;
  title: string;
  description: string;
  tags: string[];
  primaryTag?: string | null;
  dueDate?: Date | null;
  dueTime?: boolean;
  dueDay?: string | null;
  estimateMinutes: number;
  priority: number;
  order: number;
  section?: string;
  completedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  legacyIssueUid?: string;
  legacyLabel?: string;
}

export interface TaskCriteria {
  projectId?: number | null;
  tag?: string;
  priority?: number;
  date?: "any" | "today" | "overdue" | "upcoming" | "undated";
  completion?: "active" | "completed" | "all";
  maxEstimate?: number;
}

export interface TaskFilter {
  id?: number;
  uid?: string;
  name: string;
  criteria: TaskCriteria;
  createdAt: Date;
  updatedAt: Date;
}

export function subtaskProgress(tasks: Task[], parentId: number) {
  const children = tasks.filter((task) => task.parentId === parentId && !task.deletedAt);
  return { done: children.filter((task) => !!task.completedAt).length, total: children.length };
}

/** Plain text for search, previews and AI; works without a browser during SSR. */
export function descriptionText(html: string) {
  if (!html.trimStart().startsWith("<")) return html;
  const text = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? match;
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  }).replace(/\n{3,}/g, "\n\n").trim();
}

export function dayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Date-only deadlines become overdue the following local day. */
export function isTaskOverdue(task: Task, now = new Date()) {
  if (!task.dueDate || task.completedAt || task.deletedAt) return false;
  return taskDeadline(task)! < (task.dueTime ? now : dayBounds(now).start);
}

export function taskDeadline(task: Task) {
  if (!task.dueDate) return null;
  return !task.dueTime && task.dueDay
    ? new Date(`${task.dueDay}T00:00:00`)
    : new Date(task.dueDate);
}

export function matchesTask(
  task: Task,
  criteria: TaskCriteria,
  now = new Date(),
) {
  if (task.deletedAt) return false;
  if (
    criteria.projectId !== undefined &&
    (task.projectId ?? null) !== criteria.projectId
  )
    return false;
  if (criteria.tag && !task.tags.includes(criteria.tag)) return false;
  if (criteria.priority !== undefined && task.priority !== criteria.priority)
    return false;
  if (
    criteria.maxEstimate !== undefined &&
    (!task.estimateMinutes || task.estimateMinutes > criteria.maxEstimate)
  )
    return false;
  if (
    criteria.completion === "completed"
      ? !task.completedAt
      : criteria.completion !== "all" && !!task.completedAt
  )
    return false;
  const { start, end } = dayBounds(now);
  const due = taskDeadline(task);
  if (criteria.date === "today" && (!due || due < start || due >= end))
    return false;
  if (criteria.date === "overdue" && !isTaskOverdue(task, now)) return false;
  if (criteria.date === "upcoming" && (!due || due < end)) return false;
  if (criteria.date === "undated" && due) return false;
  return true;
}

export function taskMinutes(task: Task, sessions: FocusSession[]) {
  if (!task.uid) return 0;
  return sessions
    .filter((s) => s.taskUid === task.uid)
    .reduce(
      (sum, s) =>
        sum +
        Math.max(
          0,
          (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) /
            60000,
        ),
      0,
    );
}

export function formatMinutes(minutes: number) {
  const rounded = Math.round(minutes);
  return rounded >= 60
    ? `${Math.floor(rounded / 60)}h${rounded % 60 ? ` ${rounded % 60}m` : ""}`
    : `${rounded}m`;
}

/** Local date input without UTC conversion (which shifts dates west of UTC). */
export function dateInput(date?: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
