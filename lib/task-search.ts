import { descriptionText, isTaskOverdue, type Task } from "./tasks";

export interface TaskSearchFilters {
  text: string;
  tag: string;
  priority: string;
  overdue: boolean;
}

export const EMPTY_TASK_FILTERS: TaskSearchFilters = { text: "", tag: "", priority: "", overdue: false };

export function hasTaskFilters(filters: TaskSearchFilters) {
  return !!(filters.text.trim() || filters.tag || filters.priority || filters.overdue);
}

export function taskSearchTags(task: Task) {
  return [...new Set([...task.tags, ...(task.primaryTag ? [task.primaryTag] : [])])];
}

/** Filter within the current project scope; retain ancestors as navigable context. */
export function filterTaskTree(tasks: Task[], filters: TaskSearchFilters, now = new Date()) {
  if (!hasTaskFilters(filters)) return { tasks, expanded: new Set<number>(), matches: tasks.length };
  const tokens = filters.text.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visible = new Set<Task>();
  const expanded = new Set<number>();
  let matches = 0;
  for (const task of tasks) {
    const tags = taskSearchTags(task);
    const text = `${task.title} ${descriptionText(task.description)} ${tags.join(" ")}`.toLocaleLowerCase();
    if (!tokens.every((token) => text.includes(token)) ||
      (filters.tag && !tags.some((tag) => tag.toLocaleLowerCase() === filters.tag.toLocaleLowerCase())) ||
      (filters.priority && task.priority !== Number(filters.priority)) ||
      (filters.overdue && !isTaskOverdue(task, now))) continue;
    matches++;
    visible.add(task);
    const seen = new Set<number>();
    let parentId = task.parentId;
    while (parentId != null && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      // Trash and live tasks should never reveal each other as context.
      if (!parent || !!parent.deletedAt !== !!task.deletedAt) break;
      visible.add(parent);
      expanded.add(parentId);
      parentId = parent.parentId;
    }
  }
  return { tasks: tasks.filter((task) => visible.has(task)), expanded, matches };
}
