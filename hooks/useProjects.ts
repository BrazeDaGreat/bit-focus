/**
 * Project Management Hook - Comprehensive Project, Milestone, and Issue Management
 *
 * This Zustand-based hook manages all project-related data including projects,
 * milestones, and issues. It provides a complete project management system with
 * hierarchical organization and progress tracking capabilities.
 *
 * Features:
 * - Complete CRUD operations for projects, milestones, and issues
 * - Automatic progress calculation for milestones based on issue completion
 * - Hierarchical data relationships (Projects > Milestones > Issues)
 * - Type-safe data handling with TypeScript interfaces
 * - Real-time state synchronization across components
 * - Database integration with error handling
 * - Loading state management for better UX
 *
 * Data Structure:
 * - Projects: Top-level containers with markdown notes
 * - Milestones: Project subdivisions with budgets and deadlines
 * - Issues: Individual tasks within milestones with labels and descriptions
 *
 * Progress Calculation:
 * - Milestone progress = (completed issues / total issues) * 100
 * - Project progress = average of milestone progress values
 *
 * Dependencies:
 * - Zustand for state management
 * - Database instance for persistence
 * - TypeScript for type safety
 *
 * @fileoverview Comprehensive project management state and operations
 * @author BIT Focus Development Team
 * @since v0.9.0-alpha
 */

import { create } from "zustand";
import db from "@/lib/db";

/**
 * Project Data Interface
 */
export interface Project {
  /** Unique project identifier */
  id?: number;
  /** Project title */
  title: string;
  /** Project status */
  status: "Scheduled" | "Active" | "Closed";
  /** Project version */
  version: string;
  /** Markdown-enabled notes */
  notes: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Milestone Data Interface
 */
export interface Milestone {
  /** Unique milestone identifier */
  id?: number;
  /** Parent project ID */
  projectId: number;
  /** Milestone title */
  title: string;
  /** Milestone status */
  status: "Scheduled" | "Active" | "Closed";
  /** Milestone deadline */
  deadline: Date;
  /** Budget amount (in preferred currency) */
  budget: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Issue Data Interface
 */
export interface Issue {
  /** Unique issue identifier */
  id?: number;
  /** Parent milestone ID */
  milestoneId: number;
  /** Issue title */
  title: string;
  /** Issue label from predefined list */
  label: string;
  /** Issue due date */
  dueDate: Date;
  /** Issue status */
  status: "Open" | "Close";
  /** Issue description */
  description: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Enhanced Milestone with Progress Calculation
 */
export interface MilestoneWithProgress extends Milestone {
  /** Calculated progress percentage (0-100) */
  progress: number;
  /** Number of completed issues */
  completedIssues: number;
  /** Total number of issues */
  totalIssues: number;
}

/**
 * Enhanced Project with Aggregated Data
 */
export interface ProjectWithStats extends Project {
  /** Associated milestones with progress */
  milestones: MilestoneWithProgress[];
  /** Overall project progress */
  progress: number;
  /** Total project budget (sum of milestone budgets) */
  totalBudget: number;
}

/**
 * Predefined Issue Labels
 */
export const ISSUE_LABELS = [
  "Bug",
  "Feature",
  "Enhancement",
  "Documentation",
  "Question",
  "Research",
  "Design",
  "Testing",
  "Deployment",
  "Maintenance",
] as const;

export type IssueLabel = typeof ISSUE_LABELS[number];

/**
 * Projects State Management Interface
 */
interface ProjectsState {
  /** Array of all projects */
  projects: Project[];
  /** Array of all milestones */
  milestones: Milestone[];
  /** Array of all issues */
  issues: Issue[];
  /** Loading state indicator */
  loadingProjects: boolean;

  // Project operations
  /** Load all project data from database */
  loadProjects: () => Promise<void>;
  /** Create a new project */
  addProject: (title: string, status: Project["status"], version: string, notes: string) => Promise<void>;
  /** Update an existing project */
  updateProject: (id: number, updates: Partial<Project>) => Promise<void>;
  /** Delete a project and all associated data */
  deleteProject: (id: number) => Promise<void>;

  // Milestone operations
  /** Create a new milestone */
  addMilestone: (
    projectId: number,
    title: string,
    status: Milestone["status"],
    deadline: Date,
    budget: number
  ) => Promise<void>;
  /** Update an existing milestone */
  updateMilestone: (id: number, updates: Partial<Milestone>) => Promise<void>;
  /** Delete a milestone and all associated issues */
  deleteMilestone: (id: number) => Promise<void>;

  // Issue operations
  /** Create a new issue */
  addIssue: (
    milestoneId: number,
    title: string,
    label: string,
    dueDate: Date,
    description: string
  ) => Promise<void>;
  /** Update an existing issue */
  updateIssue: (id: number, updates: Partial<Issue>) => Promise<void>;
  /** Delete an issue */
  deleteIssue: (id: number) => Promise<void>;

  // Data getters with calculated fields
  /** Get project by ID with statistics */
  getProjectWithStats: (id: number) => ProjectWithStats | undefined;
  /** Get all projects with statistics */
  getAllProjectsWithStats: () => ProjectWithStats[];
  /** Get milestones for a project with progress */
  getMilestonesForProject: (projectId: number) => MilestoneWithProgress[];
  /** Get issues for a milestone */
  getIssuesForMilestone: (milestoneId: number) => Issue[];
}

/**
 * Projects Management Store
 *
 * @hook
 * @returns {ProjectsState} Project management state and operations
 */
export const useProjects = create<ProjectsState>((set, get) => ({
  // Initial state
  projects: [],
  milestones: [],
  issues: [],
  loadingProjects: true,

  /**
   * Load All Project Data
   */
  loadProjects: async () => {
    set({ loadingProjects: true });
    try {
      const [projects, milestones, issues] = await Promise.all([
        db.projects.toArray(),
        db.milestones.toArray(),
        db.issues.toArray(),
      ]);
      set({ projects, milestones, issues });
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      set({ loadingProjects: false });
    }
  },

  /**
   * Add New Project
   */
  addProject: async (title, status, version, notes) => {
    const now = new Date();
    const id = await db.projects.add({
      title,
      status,
      version,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    set((state) => ({
      projects: [...state.projects, { id, title, status, version, notes, createdAt: now, updatedAt: now }],
    }));
  },

  /**
   * Update Project
   */
  updateProject: async (id, updates) => {
    const updatedData = { ...updates, updatedAt: new Date() };
    await db.projects.update(id, updatedData);

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, ...updatedData } : project
      ),
    }));
  },

  /**
   * Delete Project and Associated Data
   */
  deleteProject: async (id) => {
    // Get all milestones for this project
    const projectMilestones = get().milestones.filter((m) => m.projectId === id);
    const milestoneIds = projectMilestones.map((m) => m.id!);

    // Delete all issues for these milestones
    await db.issues.where("milestoneId").anyOf(milestoneIds).delete();

    // Delete all milestones for this project
    await db.milestones.where("projectId").equals(id).delete();

    // Delete the project
    await db.projects.delete(id);

    // Update state
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      milestones: state.milestones.filter((m) => m.projectId !== id),
      issues: state.issues.filter((i) => !milestoneIds.includes(i.milestoneId)),
    }));
  },

  /**
   * Add New Milestone
   */
  addMilestone: async (projectId, title, status, deadline, budget) => {
    const now = new Date();
    const id = await db.milestones.add({
      projectId,
      title,
      status,
      deadline,
      budget,
      createdAt: now,
      updatedAt: now,
    });

    set((state) => ({
      milestones: [
        ...state.milestones,
        { id, projectId, title, status, deadline, budget, createdAt: now, updatedAt: now },
      ],
    }));
  },

  /**
   * Update Milestone
   */
  updateMilestone: async (id, updates) => {
    const updatedData = { ...updates, updatedAt: new Date() };
    await db.milestones.update(id, updatedData);

    set((state) => ({
      milestones: state.milestones.map((milestone) =>
        milestone.id === id ? { ...milestone, ...updatedData } : milestone
      ),
    }));
  },

  /**
   * Delete Milestone and Associated Issues
   */
  deleteMilestone: async (id) => {
    // Delete all issues for this milestone
    await db.issues.where("milestoneId").equals(id).delete();

    // Delete the milestone
    await db.milestones.delete(id);

    // Update state
    set((state) => ({
      milestones: state.milestones.filter((m) => m.id !== id),
      issues: state.issues.filter((i) => i.milestoneId !== id),
    }));
  },

  /**
   * Add New Issue
   */
  addIssue: async (milestoneId, title, label, dueDate, description) => {
    const now = new Date();
    const id = await db.issues.add({
      milestoneId,
      title,
      label,
      dueDate,
      status: "Open",
      description,
      createdAt: now,
      updatedAt: now,
    });

    set((state) => ({
      issues: [
        ...state.issues,
        {
          id,
          milestoneId,
          title,
          label,
          dueDate,
          status: "Open",
          description,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
  },

  /**
   * Update Issue
   */
  updateIssue: async (id, updates) => {
    const updatedData = { ...updates, updatedAt: new Date() };
    await db.issues.update(id, updatedData);

    set((state) => ({
      issues: state.issues.map((issue) =>
        issue.id === id ? { ...issue, ...updatedData } : issue
      ),
    }));
  },

  /**
   * Delete Issue
   */
  deleteIssue: async (id) => {
    await db.issues.delete(id);

    set((state) => ({
      issues: state.issues.filter((i) => i.id !== id),
    }));
  },

  /**
   * Get Project with Statistics
   */
  getProjectWithStats: (id) => {
    const state = get();
    const project = state.projects.find((p) => p.id === id);
    if (!project) return undefined;

    const milestones = state.getMilestonesForProject(id);
    const totalBudget = milestones.reduce((sum, m) => sum + m.budget, 0);
    const progress = milestones.length > 0 
      ? milestones.reduce((sum, m) => sum + m.progress, 0) / milestones.length 
      : 0;

    return {
      ...project,
      milestones,
      progress: Math.round(progress),
      totalBudget,
    };
  },

  /**
   * Get All Projects with Statistics
   */
  getAllProjectsWithStats: () => {
    const state = get();
    return state.projects.map((project) => state.getProjectWithStats(project.id!)!);
  },

  /**
   * Get Milestones for Project with Progress
   */
  getMilestonesForProject: (projectId) => {
    const state = get();
    const milestones = state.milestones.filter((m) => m.projectId === projectId);
    
    return milestones.map((milestone) => {
      const issues = state.issues.filter((i) => i.milestoneId === milestone.id);
      const completedIssues = issues.filter((i) => i.status === "Close").length;
      const totalIssues = issues.length;
      const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

      return {
        ...milestone,
        progress,
        completedIssues,
        totalIssues,
      };
    });
  },

  /**
   * Get Issues for Milestone
   */
  getIssuesForMilestone: (milestoneId) => {
    const state = get();
    return state.issues.filter((i) => i.milestoneId === milestoneId);
  },
}));