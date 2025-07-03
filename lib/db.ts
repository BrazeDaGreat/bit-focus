/**
 * Database Configuration - IndexedDB Schema and Management
 *
 * This module defines the database schema and configuration for the BIT Focus
 * application using Dexie.js as an IndexedDB wrapper. It provides type-safe
 * database operations and handles all local data storage including focus
 * sessions, user configuration, tasks, and notes.
 *
 * Database Schema:
 * - Configuration: User settings and preferences
 * - Focus: Focus session tracking and analytics
 * - Tasks: Task management and todo functionality
 * - Notes: Document and board-style note storage
 *
 * Features:
 * - Type-safe database operations with TypeScript
 * - Automatic primary key generation
 * - Indexed fields for efficient querying
 * - Structured data models for consistency
 * - Version management for schema evolution
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
 */

import Dexie from "dexie";

/**
 * BIT Focus Database Class
 *
 * Extends Dexie to provide a type-safe database interface for the BIT Focus
 * application. Defines table schemas, relationships, and indexing strategies
 * for optimal performance and data integrity.
 *
 * The database uses a single version (v1) with four main tables, each designed
 * for specific application functionality. All tables include appropriate
 * indexing for common query patterns and efficient data retrieval.
 *
 * @class
 * @extends {Dexie}
 *
 * @example
 * ```typescript
 * // Adding a focus session
 * await db.focus.add({
 *   tag: "Work",
 *   startTime: new Date(),
 *   endTime: new Date(Date.now() + 3600000) // 1 hour later
 * });
 *
 * // Querying focus sessions by tag
 * const workSessions = await db.focus
 *   .where('tag')
 *   .equals('Work')
 *   .toArray();
 *
 * // Getting user configuration
 * const config = await db.configuration.toCollection().first();
 * ```
 *
 * @see {@link https://dexie.org/} for Dexie.js documentation
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
   * Tasks Table
   *
   * Stores task and todo items with subtasks, due dates, and categorization.
   * Indexed on duedate and tags for efficient task management queries.
   *
   * @type {Dexie.Table<TaskRecord, number>}
   */
  tasks: Dexie.Table<
    {
      id?: number;
      task: string;
      subtasks: string[];
      duedate: Date;
      tags: string[];
    },
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
   * Sets up version 1 of the database with all required tables and indexes
   * for optimal query performance.
   *
   * Index Strategy:
   * - Configuration: Primary key on name
   * - Focus: Auto-increment ID, indexes on tag, startTime, endTime
   * - Tasks: Auto-increment ID, indexes on duedate, tags
   * - Notes: Auto-increment ID, indexes on parentId, createdAt, updatedAt
   */
  constructor() {
    super("BitFocusDB");

    // Database version 1 schema definition
    this.version(1).stores({
      configuration: "name",
      focus: "++id, tag, startTime, endTime",
      tasks: "++id, task, duedate, tags",
      notes: "++id, title, type, parentId, createdAt, updatedAt",
    });

    // Table reference assignment for type safety
    this.configuration = this.table("configuration");
    this.focus = this.table("focus");
    this.tasks = this.table("tasks");
    this.notes = this.table("notes");
  }
}

// Export singleton database instance
const db = new BitFocusDB();
export default db;
