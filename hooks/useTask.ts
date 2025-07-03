/**
 * Task Management Hook - Enhanced Todo System with Completion Tracking
 *
 * This hook provides a Zustand store for managing tasks with enhanced
 * capabilities including priority levels, completion tracking, subtask
 * persistence, and comprehensive search functionality.
 *
 * Features:
 * - Priority-based task management (1-4 scale)
 * - Task completion tracking with separate completed tasks view
 * - Persistent subtask completion states
 * - Advanced search with tag filtering (#tagname syntax)
 * - Enhanced CRUD operations with validation
 * - Advanced sorting and filtering capabilities
 * - Type-safe task data handling
 * - Database integration with error handling
 * - Real-time state synchronization
 *
 * Priority System:
 * - Priority 1: Low priority (default)
 * - Priority 2: Medium priority
 * - Priority 3: High priority
 * - Priority 4: Urgent priority
 *
 * Completion System:
 * - Tasks can be marked as completed (not deleted)
 * - Subtask completion states are persisted
 * - Completed tasks are grouped separately
 * - Only truly deleted tasks are removed from database
 *
 * Search System:
 * - Text search across task names and descriptions
 * - Tag search using #tagname syntax
 * - Real-time filtering based on search criteria
 *
 * Dependencies:
 * - Zustand for state management
 * - Database instance for persistence
 * - TypeScript for type safety
 *
 * @fileoverview Enhanced task management with completion tracking and search
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 * @updated v0.7.1-alpha - Added completion tracking and search functionality
 */

import { create } from "zustand";
import db from "@/lib/db";

/**
 * Enhanced Task Interface with Completion Tracking
 *
 * Defines the complete structure of a task including completion tracking
 * fields for both overall task status and individual subtask states.
 */
export interface Task {
  /** Unique task identifier (auto-generated) */
  id?: number;
  /** Task title/description */
  task: string;
  /** Array of subtask descriptions */
  subtasks: string[];
  /** Task due date */
  duedate: Date;
  /** Array of category tags */
  tags: string[];
  /** Priority level (1-4, with 1 being default/low priority) */
  priority: number;
  /** Overall task completion status */
  completed: boolean;
  /** Individual subtask completion states */
  completedSubtasks: boolean[];
}

/**
 * Time-based Task Categories
 */
export enum TaskTimeCategory {
  DueToday = "Due Today",
  DueTomorrow = "Due Tomorrow",
  Next7Days = "Next 7 Days",
  Later = "7+ Days Later",
  Overdue = "Overdue",
}

/**
 * Grouped Tasks Interface
 */
export interface GroupedTasks {
  [key: string]: Task[];
}

/**
 * Enhanced Task State Interface with Search and Completion Tracking
 */
interface TaskState {
  /** Array of all tasks (active and completed) */
  tasks: Task[];
  /** Loading state indicator */
  loadingTasks: boolean;
  /** Current search query */
  searchQuery: string;

  /** Add a new task with priority support */
  addTask: (
    task: string,
    subtasks: string[],
    duedate: Date,
    tags: string[],
    priority?: number
  ) => Promise<void>;

  /** Remove a task permanently from database */
  removeTask: (id: number) => Promise<void>;

  /** Mark a task as completed (not deleted) */
  completeTask: (id: number) => Promise<void>;

  /** Mark a task as not completed */
  uncompleteTask: (id: number) => Promise<void>;

  /** Update an existing task */
  updateTask: (id: number, updates: Partial<Task>) => Promise<void>;

  /** Update subtask completion state */
  updateSubtaskCompletion: (
    taskId: number,
    subtaskIndex: number,
    completed: boolean
  ) => Promise<void>;

  /** Load all tasks from database */
  loadTasks: () => Promise<void>;

  /** Set search query */
  setSearchQuery: (query: string) => void;

  /** Get filtered tasks based on search query */
  getFilteredTasks: () => Task[];

  /** Get active (non-completed) tasks */
  getActiveTasks: () => Task[];

  /** Get completed tasks */
  getCompletedTasks: () => Task[];

  /** Get active tasks grouped by time categories */
  getTasksByTimeCategory: () => Record<TaskTimeCategory, Task[]>;

  /** Get active tasks grouped by tags */
  getTasksByTag: () => GroupedTasks;

  /** Get active tasks grouped by priority levels */
  getTasksByPriority: () => GroupedTasks;
}

/**
 * Enhanced Task Management Store with Search and Completion Tracking
 *
 * @hook
 * @returns {TaskState} Task state and management functions
 */
export const useTask = create<TaskState>((set, get) => ({
  // Initialize the store
  tasks: [],
  loadingTasks: true,
  searchQuery: "",

  /**
   * Add New Task with Enhanced Fields
   */
  addTask: async (task, subtasks, duedate, tags, priority = 1) => {
    // Validate priority range
    const validPriority = Math.max(1, Math.min(4, priority));

    // Initialize completion tracking
    const completedSubtasks = new Array(subtasks.length).fill(false);

    // Add the task to the database
    const id = await db.tasks.add({
      task,
      subtasks,
      duedate,
      tags,
      priority: validPriority,
      completed: false,
      completedSubtasks,
    });

    // Update the store with the new task
    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          id,
          task,
          subtasks,
          duedate,
          tags,
          priority: validPriority,
          completed: false,
          completedSubtasks,
        },
      ],
    }));
  },

  /**
   * Remove Task Permanently
   */
  removeTask: async (id) => {
    // Remove the task from the database
    await db.tasks.delete(id);

    // Update the store
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  /**
   * Mark Task as Completed
   */
  completeTask: async (id) => {
    // Update the task in the database
    await db.tasks.update(id, { completed: true });

    // Update the store
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, completed: true } : task
      ),
    }));
  },

  /**
   * Mark Task as Not Completed
   */
  uncompleteTask: async (id) => {
    // Update the task in the database
    await db.tasks.update(id, { completed: false });

    // Update the store
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, completed: false } : task
      ),
    }));
  },

  /**
   * Update Task with Enhanced Support
   */
  updateTask: async (id, updates) => {
    // Validate priority if being updated
    if (updates.priority !== undefined) {
      updates.priority = Math.max(1, Math.min(4, updates.priority));
    }

    // Ensure completedSubtasks array matches subtasks length
    if (updates.subtasks) {
      const currentTask = get().tasks.find((t) => t.id === id);
      if (currentTask) {
        const newLength = updates.subtasks.length;
        const oldLength = currentTask.completedSubtasks.length;

        if (newLength !== oldLength) {
          // Adjust completedSubtasks array
          const newCompletedSubtasks = [...currentTask.completedSubtasks];
          if (newLength > oldLength) {
            // Add false values for new subtasks
            newCompletedSubtasks.push(
              ...new Array(newLength - oldLength).fill(false)
            );
          } else {
            // Trim array to match new length
            newCompletedSubtasks.length = newLength;
          }
          updates.completedSubtasks = newCompletedSubtasks;
        }
      }
    }

    // Update the task in the database
    await db.tasks.update(id, updates);

    // Update the store with optimistic changes
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      ),
    }));
  },

  /**
   * Update Subtask Completion State
   */
  updateSubtaskCompletion: async (taskId, subtaskIndex, completed) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newCompletedSubtasks = [...task.completedSubtasks];
    newCompletedSubtasks[subtaskIndex] = completed;

    // Update the database
    await db.tasks.update(taskId, { completedSubtasks: newCompletedSubtasks });

    // Update the store
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, completedSubtasks: newCompletedSubtasks } : t
      ),
    }));
  },

  /**
   * Load All Tasks with Enhanced Fields
   */
  loadTasks: async () => {
    set({ loadingTasks: true });
    try {
      // Load all tasks from the database
      const tasks = await db.tasks.toArray();

      // Ensure all tasks have required fields (migration safety)
      const tasksWithDefaults = tasks.map((task) => ({
        ...task,
        priority: task.priority ?? 1,
        completed: task.completed ?? false,
        completedSubtasks:
          task.completedSubtasks ??
          new Array(task.subtasks?.length || 0).fill(false),
      }));

      // Update the store with the new list of tasks
      set({ tasks: tasksWithDefaults });
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      set({ loadingTasks: false });
    }
  },

  /**
   * Set Search Query
   */
  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  /**
   * Get Filtered Tasks Based on Search Query
   */
  getFilteredTasks: () => {
    const { tasks, searchQuery } = get();

    if (!searchQuery.trim()) {
      return tasks;
    }

    const query = searchQuery.toLowerCase().trim();

    // Check if it's a tag search (#tagname)
    if (query.startsWith("#")) {
      const tagQuery = query.slice(1); // Remove the # symbol
      return tasks.filter((task) =>
        task.tags.some((tag) => tag.toLowerCase().includes(tagQuery))
      );
    }

    // Regular text search
    return tasks.filter(
      (task) =>
        task.task.toLowerCase().includes(query) ||
        task.subtasks.some((subtask) =>
          subtask.toLowerCase().includes(query)
        ) ||
        task.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  },

  /**
   * Get Active (Non-Completed) Tasks
   */
  getActiveTasks: () => {
    const filteredTasks = get().getFilteredTasks();
    return filteredTasks.filter((task) => !task.completed);
  },

  /**
   * Get Completed Tasks
   */
  getCompletedTasks: () => {
    const filteredTasks = get().getFilteredTasks();
    return filteredTasks.filter((task) => task.completed);
  },

  /**
   * Get Active Tasks by Time Category
   */
  getTasksByTimeCategory: () => {
    const tasks = get().getActiveTasks();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const groups: Record<TaskTimeCategory, Task[]> = {
      [TaskTimeCategory.Overdue]: [],
      [TaskTimeCategory.DueToday]: [],
      [TaskTimeCategory.DueTomorrow]: [],
      [TaskTimeCategory.Next7Days]: [],
      [TaskTimeCategory.Later]: [],
    };

    tasks.forEach((task) => {
      const dueDate = new Date(task.duedate);
      const dueDateOnly = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate()
      );

      if (dueDateOnly < today) {
        groups[TaskTimeCategory.Overdue].push(task);
      } else if (dueDateOnly.getTime() === today.getTime()) {
        groups[TaskTimeCategory.DueToday].push(task);
      } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
        groups[TaskTimeCategory.DueTomorrow].push(task);
      } else if (dueDateOnly <= next7Days) {
        groups[TaskTimeCategory.Next7Days].push(task);
      } else {
        groups[TaskTimeCategory.Later].push(task);
      }
    });

    // Sort tasks within each group by priority (highest first) then by due date
    Object.values(groups).forEach((group) => {
      group.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return new Date(a.duedate).getTime() - new Date(b.duedate).getTime();
      });
    });

    return groups;
  },

  /**
   * Get Active Tasks by Tag
   */
  getTasksByTag: () => {
    const tasks = get().getActiveTasks();
    const groups: GroupedTasks = {};

    tasks.forEach((task) => {
      if (task.tags.length === 0) {
        // Group untagged tasks
        if (!groups["Untagged"]) {
          groups["Untagged"] = [];
        }
        groups["Untagged"].push(task);
      } else {
        // Group by each tag
        task.tags.forEach((tag) => {
          if (!groups[tag]) {
            groups[tag] = [];
          }
          groups[tag].push(task);
        });
      }
    });

    // Sort tasks within each group by priority then by due date
    Object.values(groups).forEach((group) => {
      group.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return new Date(a.duedate).getTime() - new Date(b.duedate).getTime();
      });
    });

    return groups;
  },

  /**
   * Get Active Tasks by Priority
   */
  getTasksByPriority: () => {
    const tasks = get().getActiveTasks();
    const groups: GroupedTasks = {
      "4": [], // Urgent
      "3": [], // High
      "2": [], // Medium
      "1": [], // Low
    };

    tasks.forEach((task) => {
      const priority = task.priority.toString();
      if (groups[priority]) {
        groups[priority].push(task);
      }
    });

    // Sort tasks within each priority group by due date
    Object.values(groups).forEach((group) => {
      group.sort(
        (a, b) => new Date(a.duedate).getTime() - new Date(b.duedate).getTime()
      );
    });

    return groups;
  },
}));
