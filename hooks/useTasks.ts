import { create } from "zustand";
import db from "@/lib/db";
import { migrateTasks } from "@/lib/task-migration";
import type { Task, TaskFilter, TaskCriteria } from "@/lib/tasks";
import { noteChange } from "@/lib/sync/tracker";

interface TasksState {
  tasks: Task[];
  filters: TaskFilter[];
  loading: boolean;
  error: string | null;
  loadTasks: () => Promise<void>;
  addTask: (title: string, defaults?: Partial<Task>) => Promise<number>;
  updateTask: (id: number, updates: Partial<Task>) => Promise<void>;
  updateMany: (ids: number[], updates: Partial<Task>) => Promise<void>;
  removeForever: (id: number) => Promise<void>;
  saveFilter: (name: string, criteria: TaskCriteria) => Promise<void>;
  deleteFilter: (id: number) => Promise<void>;
}

export async function ensureTaskMigration() {
  await db.transaction(
    "rw",
    [
      db.tasks,
      db.projects,
      db.milestones,
      db.issues,
      db.table("tasks"),
      db.syncState,
    ],
    migrateTasks,
  );
}

export const useTasks = create<TasksState>((set, get) => ({
  tasks: [],
  filters: [],
  loading: true,
  error: null,
  loadTasks: async () => {
    try {
      await ensureTaskMigration();
      const [tasks, filters] = await Promise.all([
        db.tasks.toArray(),
        db.taskFilters.toArray(),
      ]);
      for (const task of tasks) {
        if (task.uid && !(await db.syncState.get(["tasks", task.uid])))
          noteChange("tasks", task.uid);
      }
      set({ tasks, filters, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Could not load tasks",
      });
    } finally {
      set({ loading: false });
    }
  },
  addTask: async (title, defaults = {}) => {
    if (!title.trim()) throw new Error("Enter a task title");
    const now = new Date();
    const task: Task = {
      description: "",
      tags: [],
      estimateMinutes: 0,
      priority: 0,
      order: Date.now(),
      ...defaults,
      title: title.trim(),
      uid: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.transaction("rw", db.tasks, async () => {
      if (task.parentId != null) {
        const parent = await db.tasks.get(task.parentId);
        if (!parent || parent.deletedAt) throw new Error("Parent task not found");
        if (parent.parentId != null) throw new Error("Subtasks can only be one level deep");
        task.projectId = parent.projectId ?? null;
      }
      return db.tasks.add(task);
    });
    set((state) => ({ tasks: [...state.tasks, { ...task, id }] }));
    return id;
  },
  updateTask: async (id, updates) => get().updateMany([id], updates),
  updateMany: async (ids, updates) => {
    const { id: _id, uid: _uid, createdAt: _createdAt, ...changes } = updates;
    void _id;
    void _uid;
    void _createdAt;
    if (changes.title !== undefined) {
      changes.title = changes.title.trim();
      if (!changes.title) throw new Error("Enter a task title");
    }
    if (
      changes.estimateMinutes !== undefined &&
      (!Number.isFinite(changes.estimateMinutes) || changes.estimateMinutes < 0)
    )
      throw new Error("Estimate must be zero or more minutes");
    changes.updatedAt = new Date();
    const changed = new Map<number, Task>();
    await db.transaction("rw", db.tasks, async () => {
      const rows = await db.tasks.toArray();
      const staged = new Map(rows.map((task) => [task.id!, { ...task }]));
      const selected = new Set(ids);
      for (const id of selected) {
        const task = staged.get(id);
        if (task) Object.assign(task, changes);
      }
      for (const before of rows.filter((task) => selected.has(task.id!))) {
        const current = staged.get(before.id!)!;
        if (changes.parentId != null) {
          const parent = staged.get(changes.parentId);
          if (!parent || parent.deletedAt) throw new Error("Parent task not found");
          if (changes.projectId === undefined) current.projectId = parent.projectId ?? null;
        }
        for (const child of staged.values()) {
          if (child.parentId !== before.id) continue;
          if (changes.projectId !== undefined) child.projectId = current.projectId ?? null;
          if (changes.deletedAt && !child.deletedAt && !child.completedAt)
            child.deletedAt = changes.deletedAt;
          if (changes.deletedAt === null && before.deletedAt && child.deletedAt &&
              new Date(child.deletedAt).getTime() === new Date(before.deletedAt).getTime())
            child.deletedAt = null;
        }
      }
      for (const task of staged.values()) {
        if (task.parentId == null) continue;
        const parent = staged.get(task.parentId);
        if (!parent || parent.id === task.id || parent.parentId != null)
          throw new Error("Subtasks can only be one level deep");
        if ((task.projectId ?? null) !== (parent.projectId ?? null))
          throw new Error("Subtasks must stay in their parent's project");
      }
      for (const before of rows) {
        const next = staged.get(before.id!)!;
        if (selected.has(before.id!) || next.projectId !== before.projectId || next.deletedAt !== before.deletedAt) {
          next.updatedAt = changes.updatedAt!;
          await db.tasks.put(next);
          changed.set(before.id!, next);
        }
      }
    });
    set((state) => ({
      tasks: state.tasks.map((task) =>
        changed.get(task.id!) ?? task,
      ),
    }));
  },
  removeForever: async (id) => {
    const removed = new Set<number>();
    // Remove the source too: restoring an old issue must not recreate deleted tasks.
    await db.transaction(
      "rw",
      [db.tasks, db.taskAttachments, db.issues, db.table("tasks")],
      async () => {
        const parent = await db.tasks.get(id);
        const children = await db.tasks.where("parentId").equals(id).toArray();
        for (const task of [...(parent ? [parent] : []), ...children]) {
          if (task.legacyIssueUid)
            await db.issues.where("uid").equals(task.legacyIssueUid).delete();
          if (task.uid?.startsWith("old-task:"))
            await db.table("tasks").filter((row) => `old-task:${row.uid}` === task.uid).delete();
          if (task.uid) await db.taskAttachments.where("taskUid").equals(task.uid).delete();
          await db.tasks.delete(task.id!);
          removed.add(task.id!);
        }
      },
    );
    set((state) => ({ tasks: state.tasks.filter((t) => !removed.has(t.id!)) }));
  },
  saveFilter: async (name, criteria) => {
    const now = new Date();
    const filter: TaskFilter = {
      name: name.trim(),
      criteria,
      uid: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    if (!filter.name) throw new Error("Enter a filter name");
    const id = await db.taskFilters.add(filter);
    set((state) => ({ filters: [...state.filters, { ...filter, id }] }));
  },
  deleteFilter: async (id) => {
    await db.taskFilters.delete(id);
    set((state) => ({ filters: state.filters.filter((f) => f.id !== id) }));
  },
}));
