import { create } from "zustand";
import db from "@/lib/db";

// Define Zustand store
interface Task {
  id?: number;
  task: string;
  subtasks: string[];
  duedate: Date;
  tags: string[];
}

interface TaskState {
  tasks: Task[];
  addTask: (
    task: string,
    subtasks: string[],
    duedate: Date,
    tags: string[]
  ) => Promise<void>;
  removeTask: (id: number) => Promise<void>;
  loadTasks: () => Promise<void>;
}

export const useTask = create<TaskState>((set) => ({
  tasks: [],

  addTask: async (task, subtasks, duedate, tags) => {
    const id = await db.tasks.add({ task, subtasks, duedate, tags });
    set((state) => ({
      tasks: [...state.tasks, { id, task, subtasks, duedate, tags }],
    }));
  },

  removeTask: async (id) => {
    await db.tasks.delete(id);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  loadTasks: async () => {
    const tasks = await db.tasks.toArray();
    set({ tasks });
  },
}));
