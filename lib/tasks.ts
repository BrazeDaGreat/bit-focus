import type { FocusSession } from "@/hooks/useFocus";
import { addDays, addMonths, differenceInCalendarWeeks } from "date-fns";

/** Plain data, matching timeblock recurrence. Weeks start Monday; until is inclusive. */
export interface TaskRecurrence {
  freq: "daily" | "weekdays" | "weekly" | "monthly";
  interval?: number;
  /** JavaScript weekdays: Sunday = 0. */
  days?: number[];
  until?: string;
  /** Keeps the original monthly date through shorter months. */
  dayOfMonth?: number;
}

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
  /** Task-level time only; never creates focus sessions or earns rewards. */
  loggedMinutes?: number;
  recurrence?: TaskRecurrence | null;
  /** Retained on reopen (and after successor deletion) to prevent duplicate spawns. */
  recurrenceNextUid?: string;
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
  const logged = Number.isFinite(task.loggedMinutes) ? Math.max(0, task.loggedMinutes!) : 0;
  return logged + sessions
    .filter((s) => !!task.uid && s.taskUid === task.uid)
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

/** Accept minutes or compact durations: 2h, 90m, 1h30, 1h 30m. */
export function parseLoggedMinutes(input: string): number | null {
  const value = input.trim().toLowerCase();
  const match = value.match(/^(?:(\d+(?:\.\d+)?)h(?:\s*(\d+)m?)?|(\d+(?:\.\d+)?)m?)$/);
  if (!match) return null;
  const minutes = Math.round(match[1] ? Number(match[1]) * 60 + Number(match[2] ?? 0) : Number(match[3]));
  return Number.isSafeInteger(minutes) && minutes >= 0 ? minutes : null;
}

export function validTaskRecurrence(value: unknown): value is TaskRecurrence {
  if (!value || typeof value !== "object") return false;
  const rule = value as TaskRecurrence;
  return ["daily", "weekdays", "weekly", "monthly"].includes(rule.freq) &&
    (rule.interval === undefined || (Number.isSafeInteger(rule.interval) && rule.interval >= 1 && rule.interval <= 10000)) &&
    (rule.days === undefined || (Array.isArray(rule.days) && rule.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6))) &&
    (rule.dayOfMonth === undefined || (Number.isInteger(rule.dayOfMonth) && rule.dayOfMonth >= 1 && rule.dayOfMonth <= 31)) &&
    (rule.until === undefined || (typeof rule.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rule.until) &&
      dateInput(new Date(`${rule.until}T00:00:00`)) === rule.until));
}

export function describeTaskRecurrence(rule: TaskRecurrence) {
  const interval = rule.interval ?? 1;
  if (rule.freq === "weekdays") return "Every weekday";
  if (rule.freq === "daily") return interval === 1 ? "Every day" : `Every ${interval} days`;
  if (rule.freq === "monthly") return interval === 1 ? "Monthly" : `Every ${interval} months`;
  const days = rule.days?.length
    ? [...new Set(rule.days)].sort((a, b) => (a + 6) % 7 - (b + 6) % 7).map(day => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")
    : "";
  return `${interval === 1 ? "Weekly" : `Every ${interval} weeks`}${days ? ` · ${days}` : ""}`;
}

/** Date shifts retain timed deadlines' local clock; date-only deadlines use dueDay. */
export function taskDeadlineFields(task: Task, day: string | null): Partial<Task> {
  if (!day) return { dueDate: null, dueDay: null, dueTime: false };
  const date = new Date(`${day}T00:00:00`);
  const previous = taskDeadline(task);
  if (task.dueTime && previous) date.setHours(previous.getHours(), previous.getMinutes(), previous.getSeconds(), previous.getMilliseconds());
  return { dueDate: date, dueDay: day, dueTime: !!task.dueTime };
}

/** Advance exactly one occurrence, even if overdue. Undated tasks start on completion day. */
export function nextTaskDeadline(task: Task, completedAt = new Date()): Date | null {
  const rule = task.recurrence;
  if (!rule || !validTaskRecurrence(rule)) return null;
  const base = taskDeadline(task) ?? new Date(completedAt);
  if (!Number.isFinite(base.getTime())) return null;
  const interval = rule.interval ?? 1;
  let next: Date;
  if (rule.freq === "monthly") {
    next = addMonths(base, interval);
    const day = rule.dayOfMonth ?? base.getDate();
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
  } else if (rule.freq === "weekly") {
    const days = rule.days?.length ? rule.days : [base.getDay()];
    const candidates = days.map(day => {
      let candidate = addDays(base, (day - base.getDay() + 7) % 7 || interval * 7);
      const weeks = differenceInCalendarWeeks(candidate, base, { weekStartsOn: 1 });
      if (weeks % interval !== 0) candidate = addDays(candidate, (interval - weeks % interval) * 7);
      return candidate.getTime();
    });
    next = new Date(Math.min(...candidates));
  } else {
    next = addDays(base, rule.freq === "daily" ? interval : 1);
    if (rule.freq === "weekdays") while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
  }
  if (!Number.isFinite(next.getTime()) || (rule.until && dateInput(next) > rule.until)) return null;
  if (!task.dueTime) next.setHours(0, 0, 0, 0);
  return next;
}

/** Stable across devices completing the same occurrence while offline. */
export function taskSuccessorUid(uid: string) {
  const match = uid.match(/^(.*):repeat:(\d+)$/);
  return match ? `${match[1]}:repeat:${Number(match[2]) + 1}` : `${uid}:repeat:1`;
}

/** Subtasks are not copied; the successor starts with no logged time or legacy source. */
export function taskSuccessor(task: Task, completedAt = new Date()): Task | null {
  if (task.recurrenceNextUid || task.deletedAt || !task.uid) return null;
  const dueDate = nextTaskDeadline(task, completedAt);
  if (!dueDate) return null;
  const recurrence = { ...task.recurrence! };
  if (recurrence.days) recurrence.days = [...recurrence.days];
  if (recurrence.freq === "monthly") recurrence.dayOfMonth ??= (taskDeadline(task) ?? completedAt).getDate();
  const { id: _id, legacyIssueUid: _legacy, recurrenceNextUid: _next, ...fields } = task;
  void _id; void _legacy; void _next;
  return {
    ...fields,
    uid: taskSuccessorUid(task.uid),
    tags: [...task.tags],
    recurrence,
    dueDate,
    dueDay: dateInput(dueDate),
    dueTime: !!task.dueTime,
    loggedMinutes: 0,
    completedAt: null,
    deletedAt: null,
    createdAt: completedAt,
    updatedAt: completedAt,
    order: completedAt.getTime(),
  };
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
