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
    const id = await db.tasks.add(task);
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
    await db.transaction("rw", db.tasks, async () => {
      for (const id of ids) await db.tasks.update(id, changes);
    });
    set((state) => ({
      tasks: state.tasks.map((task) =>
        ids.includes(task.id!) ? { ...task, ...changes } : task,
      ),
    }));
  },
  removeForever: async (id) => {
    // Remove the source too: restoring an old issue must not recreate deleted tasks.
    await db.transaction(
      "rw",
      [db.tasks, db.issues, db.table("tasks")],
      async () => {
        const task = await db.tasks.get(id);
        if (task?.legacyIssueUid)
          await db.issues.where("uid").equals(task.legacyIssueUid).delete();
        if (task?.uid?.startsWith("old-task:"))
          await db
            .table("tasks")
            .filter((row) => `old-task:${row.uid}` === task.uid)
            .delete();
        await db.tasks.delete(id);
      },
    );
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
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
