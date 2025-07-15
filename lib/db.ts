/**
 * Database Configuration - IndexedDB Schema and Management (Enhanced)
 *
 * This module defines the database schema and configuration for the BIT Focus
 * application using Dexie.js as an IndexedDB wrapper. Updated to include
 * priority field and subtask completion tracking for enhanced task management.
 *
 * Database Schema:
 * - Configuration: User settings and preferences
 * - Focus: Focus session tracking and analytics
 * - Notes: Document and board-style note storage
 *
 * Features:
 * - Type-safe database operations with TypeScript
 * - Automatic primary key generation
 * - Indexed fields for efficient querying
 * - Structured data models for consistency
 * - Version management for schema evolution
 * - Subtask completion state persistence
 *
 * Storage Architecture:
 * - Client-side only storage using IndexedDB
 * - No external database dependencies
 * - Offline-first functionality
 * - Cross-browser compatibility via Dexie.js
 *
 * Dependencies:
 * - Dexie.js for IndexedDB abstraction
 * - TypeScript for type safety
 *
 * @fileoverview Database schema and configuration for local data storage
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 * @updated v0.8.2-alpha
 */

import Dexie from "dexie";

/**
 * BIT Focus Database Class
 *
 * Extends Dexie to provide a type-safe database interface for the BIT Focus
 * application. Defines table schemas, relationships, and indexing strategies
 * for optimal performance and data integrity.
 *
 * The database uses version 3 to accommodate the new completion tracking fields.
 * All tables include appropriate indexing for common query patterns and
 * efficient data retrieval.
 *
 * @class
 * @extends {Dexie}
 */
class BitFocusDB extends Dexie {
  /**
   * Configuration Table
   *
   * Stores user configuration data including personal information and
   * application settings. Uses name as primary key to ensure single
   * configuration record per user.
   *
   * @type {Dexie.Table<ConfigurationRecord, string>}
   */
  configuration: Dexie.Table<
    { name: string; dob: Date; webhook: string },
    string
  >;

  /**
   * Focus Sessions Table
   *
   * Stores individual focus session records with automatic ID generation.
   * Indexed on tag, startTime, and endTime for efficient filtering and
   * analytics queries.
   *
   * @type {Dexie.Table<FocusRecord, number>}
   */
  focus: Dexie.Table<
    { id?: number; tag: string; startTime: Date; endTime: Date },
    number
  >;

  /**
   * Notes Table
   *
   * Stores document and board-style notes with hierarchical organization.
   * Supports both simple documents and complex board structures with
   * parent-child relationships and timestamps.
   *
   * @type {Dexie.Table<NoteRecord, number>}
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
   * Database Constructor
   *
   * Initializes the database with schema definition and table configuration.
   * Includes migrations from previous versions to add new completion tracking
   * fields to existing tasks.
   *
   * Index Strategy:
   * - Configuration: Primary key on name
   * - Focus: Auto-increment ID, indexes on tag, startTime, endTime
   * - Tasks: Auto-increment ID, indexes on duedate, tags, priority, completed
   * - Notes: Auto-increment ID, indexes on parentId, createdAt, updatedAt
   */
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
        // Migrate existing tasks to include default priority
        return tx
          .table("tasks")
          .toCollection()
          .modify((task) => {
            if (task.priority === undefined) {
              task.priority = 1; // Set default priority for existing tasks
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
        // Migrate existing tasks to include completion tracking
        return tx
          .table("tasks")
          .toCollection()
          .modify((task) => {
            if (task.completed === undefined) {
              task.completed = false; // Set default completed status
            }
            if (task.completedSubtasks === undefined) {
              // Initialize subtask completion array based on existing subtasks
              task.completedSubtasks = new Array(
                task.subtasks?.length || 0
              ).fill(false);
            }
          });
      });

    // Table reference assignment for type safety
    this.configuration = this.table("configuration");
    this.focus = this.table("focus");
    this.notes = this.table("notes");
  }
}

// Export singleton database instance
const db = new BitFocusDB();
export default db;
