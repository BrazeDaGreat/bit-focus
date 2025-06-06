/**
 * This hook provides a Zustand store for managing tasks.
 *
 * The store provides the following actions:
 *
 * - `addTask`: Adds a new task to the store.
 * - `removeTask`: Removes a task from the store.
 * - `loadTasks`: Loads all tasks from the database and updates the store.
 *
 * The store also provides the following state:
 *
 * - `tasks`: An array of tasks.
 *
 * The `addTask` and `removeTask` actions are asynchronous, and return a promise that resolves when the action is complete.
 */

import { create } from "zustand";
import db from "@/lib/db";

// Define the shape of a task
interface Task {
  id?: number;
  task: string;
  subtasks: string[];
  duedate: Date;
  tags: string[];
}

// Define the shape of the Zustand store
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

/**
 * Creates a Zustand store for managing tasks
 */
export const useTask = create<TaskState>((set) => ({
  // Initialize the store with an empty array of tasks
  tasks: [],

  /**
   * Adds a new task to the store
   */
  addTask: async (task, subtasks, duedate, tags) => {
    // Add the task to the database
    const id = await db.tasks.add({ task, subtasks, duedate, tags });
    // Update the store with the new task
    set((state) => ({
      tasks: [...state.tasks, { id, task, subtasks, duedate, tags }],
    }));
  },

  /**
   * Removes a task from the store
   */
  removeTask: async (id) => {
    // Remove the task from the database
    await db.tasks.delete(id);
    // Update the store with the new list of tasks
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  /**
   * Loads all tasks from the database and updates the store
   */
  loadTasks: async () => {
    // Load all tasks from the database
    const tasks = await db.tasks.toArray();
    // Update the store with the new list of tasks
    set({ tasks });
  },
}));
