/**
 * Database Configuration - IndexedDB Schema and Management (Enhanced with Project Management + Quick Links)
 *
 * This module defines the database schema and configuration for the BIT Focus
 * application using Dexie.js as an IndexedDB wrapper. Updated to include
 * project management functionality with projects, milestones, issues, and quick links.
 *
 * Database Schema:
 * - Configuration: User settings including preferred currency
 * - Focus: Focus session tracking and analytics
 * - Notes: Document and board-style note storage
 * - Projects: Project management with markdown notes and quick links
 * - Milestones: Project milestones with budgets and deadlines
 * - Issues: Issue tracking within milestones
 *
 * Features:
 * - Type-safe database operations with TypeScript
 * - Automatic primary key generation
 * - Indexed fields for efficient querying
 * - Structured data models for consistency
 * - Version management for schema evolution
 * - Project management with hierarchical structure
 * - Quick links for project-related URLs
 *
 * Dependencies:
 * - Dexie.js for IndexedDB abstraction
 * - TypeScript for type safety
 *
 * @fileoverview Database schema with project management and quick links capabilities
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 * @updated v0.10.2-lts - Added quick links support to projects
 */

import Dexie from "dexie";

/**
 * Quick Link Interface
 *
 * Defines the structure of a quick link within a project.
 */
export interface QuickLink {
  /** Unique identifier for the quick link */
  id?: string;
  /** Display title for the link */
  title: string;
  /** Target URL */
  url: string;
}

/**
 * BIT Focus Database Class with Project Management and Quick Links
 *
 * Extends Dexie to provide a type-safe database interface for the BIT Focus
 * application including comprehensive project management capabilities and quick links.
 *
 * @class
 * @extends {Dexie}
 */
class BitFocusDB extends Dexie {
  /**
   * Configuration Table (Enhanced with Currency)
   */
  configuration: Dexie.Table<
    { name: string; dob: Date; webhook: string; currency: string },
    string
  >;

  /**
   * Focus Sessions Table
   */
  focus: Dexie.Table<
    { id?: number; tag: string; startTime: Date; endTime: Date },
    number
  >;

  /**
   * Notes Table
   */
  notes: Dexie.Table<
    {
      id?: number;
      title: string;
      type: "document" | "board";
      parentId?: number | null;
      content?: string;
      boardData?: { category: string; children: number[] }[];
      createdAt: Date;
      updatedAt: Date;
    },
    number
  >;

  /**
   * Projects Table (Enhanced with Quick Links)
   */
  projects: Dexie.Table<
    {
      id?: number;
      title: string;
      status: "Scheduled" | "Active" | "Closed";
      notes: string;
      version: string;
      quickLinks: QuickLink[];
      createdAt: Date;
      updatedAt: Date;
    },
    number
  >;

  /**
   * Milestones Table
   */
  milestones: Dexie.Table<
    {
      id?: number;
      projectId: number;
      title: string;
      status: "Scheduled" | "Active" | "Closed" | "Paid";
      deadline?: Date;
      budget: number;
      createdAt: Date;
      updatedAt: Date;
    },
    number
  >;

  /**
   * Issues Table
   */
  issues: Dexie.Table<
    {
      id?: number;
      milestoneId: number;
      title: string;
      label: string;
      dueDate?: Date;
      status: "Open" | "Close";
      description: string;
      createdAt: Date;
      updatedAt: Date;
    },
    number
  >;

  constructor() {
    super("BitFocusDB");

    // Database version 1 schema definition (original)
    this.version(1).stores({
      configuration: "name",
      focus: "++id, tag, startTime, endTime",
      tasks: "++id, task, duedate, tags",
      notes: "++id, title, type, parentId, createdAt, updatedAt",
    });

    // Database version 2 schema definition (add priority to tasks)
    this.version(2)
      .stores({
        configuration: "name",
        focus: "++id, tag, startTime, endTime",
        tasks: "++id, task, duedate, tags, priority",
        notes: "++id, title, type, parentId, createdAt, updatedAt",
      })
      .upgrade((tx) => {
        return tx
          .table("tasks")
          .toCollection()
          .modify((task) => {
            if (task.priority === undefined) {
              task.priority = 1;
            }
          });
      });

    // Database version 3 schema definition (add completion tracking)
    this.version(3)
      .stores({
        configuration: "name",
        focus: "++id, tag, startTime, endTime",
        tasks: "++id, task, duedate, tags, priority, completed",
        notes: "++id, title, type, parentId, createdAt, updatedAt",
      })
      .upgrade((tx) => {
        return tx
          .table("tasks")
          .toCollection()
          .modify((task) => {
            if (task.completed === undefined) {
              task.completed = false;
            }
            if (task.completedSubtasks === undefined) {
              task.completedSubtasks = new Array(
                task.subtasks?.length || 0
              ).fill(false);
            }
          });
      });

    // Database version 4 schema definition (add project management and currency)
    this.version(4)
      .stores({
        configuration: "name",
        focus: "++id, tag, startTime, endTime",
        tasks: "++id, task, duedate, tags, priority, completed",
        notes: "++id, title, type, parentId, createdAt, updatedAt",
        projects: "++id, title, status, createdAt, updatedAt",
        milestones: "++id, projectId, title, status, deadline, createdAt, updatedAt",
        issues: "++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt",
      })
      .upgrade((tx) => {
        // Add currency field to existing configurations
        return tx
          .table("configuration")
          .toCollection()
          .modify((config) => {
            if (config.currency === undefined) {
              config.currency = "USD"; // Default currency
            }
          });
      });

    // Database version 5 schema definition (add quick links to projects)
    this.version(5)
      .stores({
        configuration: "name",
        focus: "++id, tag, startTime, endTime",
        tasks: "++id, task, duedate, tags, priority, completed",
        notes: "++id, title, type, parentId, createdAt, updatedAt",
        projects: "++id, title, status, createdAt, updatedAt",
        milestones: "++id, projectId, title, status, deadline, createdAt, updatedAt",
        issues: "++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt",
      })
      .upgrade((tx) => {
        // Add quickLinks field to existing projects
        return tx
          .table("projects")
          .toCollection()
          .modify((project) => {
            if (project.quickLinks === undefined) {
              project.quickLinks = [];
            }
          });
      });

    // Table reference assignment
    this.configuration = this.table("configuration");
    this.focus = this.table("focus");
    this.notes = this.table("notes");
    this.projects = this.table("projects");
    this.milestones = this.table("milestones");
    this.issues = this.table("issues");
  }
}

// Export singleton database instance
const db = new BitFocusDB();
export default db;