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
import type { ComponentProps } from "react";
import type { Excalidraw as ExcalidrawComponent } from "@excalidraw/excalidraw";

/**
 * Globally Unique Row Identity
 *
 * Local primary keys are auto-incrementing numbers, which means two devices
 * independently mint focus session 7 and neither can tell them apart. Every
 * syncable row therefore also carries a `uid`: a UUID minted once, on the
 * device that created the row, and never reused. Sync speaks only in uids.
 *
 * Optional on the type because rows created before v0.21.0 predate it; the
 * database upgrade backfills them, so a row without one exists only inside
 * that migration.
 */
export interface Syncable {
  /** Stable cross-device identity for this row. */
  uid?: string;
}

/**
 * Per-Row Sync Bookkeeping
 *
 * One entry per syncable row, holding the causal stamp of its last known
 * change and whether that change still needs pushing. Kept beside the domain
 * tables rather than inside them so sync metadata never leaks into exports,
 * UI state, or the shape a feature expects to read back.
 */
export interface SyncStateRow {
  /** Registry key of the collection the row belongs to. */
  col: string;
  /** The row's stable identity. */
  uid: string;
  /** Hybrid logical clock stamp of the row's last known change. */
  hlc: string;
  /** 1 when the local version has not been pushed yet. Indexed, so 0/1. */
  dirty: number;
  /** 1 when the row has been deleted locally and awaits a tombstone push. */
  deleted: number;
}

/** Engine bookkeeping that outlives a reload: pull cursor, seed status. */
export interface SyncMetaRow {
  key: string;
  value: string;
}

/** A full pre-migration copy of local data, kept as a recovery net. */
export interface SyncBackupRow {
  id?: number;
  createdAt: Date;
  label: string;
  payload: string;
}

export interface TimeBlock extends Syncable {
  id?: number;
  tag: string;
  startTime: Date;
  endTime: Date;
  title?: string;
}

export interface AIChat extends Syncable {
  id: string;
  title: string;
  modelId: string;
  provider: string;
  messages: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConfig {
  key: string;
  groqApiKey: string;
  googleApiKey: string;
  customContextEnabled: boolean;
  customPrompt: string;
  defaultModelId: string;
}

type ExcalidrawInitialData = Awaited<
  Exclude<
    NonNullable<ComponentProps<typeof ExcalidrawComponent>["initialData"]>,
    (...args: never[]) => unknown
  >
>;

export type ExcalidrawSceneData = ExcalidrawInitialData;

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
 * Reward Item Interface
 *
 * Defines the structure of items in the rewards shop
 */
export interface RewardItem extends Syncable {
  id?: number;
  title: string;
  description?: string;
  cost: number;
  category?: string;
  emoji?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Special Discount Interface
 *
 * Defines discount configurations for the rewards system
 */
export interface SpecialDiscount extends Syncable {
  id?: number;
  title: string;
  percentage: number; // 0-100
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Excalidraw Scene Data Interface
 *
 * Defines the structure of saved Excalidraw drawings
 */
export interface ExcalidrawScene extends Syncable {
  id?: number | string;
  title: string;
  sceneData: ExcalidrawSceneData | string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
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
    { name: string; dob: Date | null; webhook: string; currency: string; sendWebhookUpdates?: boolean; featureToggles?: Record<string, boolean> } & Syncable,
    string
  >;

  /**
   * Focus Sessions Table
   */
  focus: Dexie.Table<
    { id?: number; tag: string; startTime: Date; endTime: Date } & Syncable,
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
    } & Syncable,
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
    } & Syncable,
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
    } & Syncable,
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
    } & Syncable,
    number
  >;

  /**
   * Reward Items Table
   */
  rewards: Dexie.Table<RewardItem, number>;

  /**
   * Special Discounts Table
   */
  discounts: Dexie.Table<SpecialDiscount, number>;

  /**
   * Excalidraw Scenes Table
   */
  excalidraw: Dexie.Table<ExcalidrawScene, string | number>;

  timeblocks: Dexie.Table<TimeBlock, number>;
  aiChats: Dexie.Table<AIChat, string>;
  aiConfig: Dexie.Table<AIConfig, string>;

  /**
   * Per-Row Sync Bookkeeping Table
   *
   * Compound-keyed on `[col+uid]`. Every syncable row that has ever been
   * touched has an entry here recording when it last changed and whether that
   * change still owes the server a push. Deleted rows keep their entry as a
   * tombstone — without one, a delete looks exactly like a row that has not
   * arrived yet, and the next pull would resurrect it.
   */
  syncState: Dexie.Table<SyncStateRow, [string, string]>;

  /** Engine bookkeeping: pull cursor, seed status, last successful sync. */
  syncMeta: Dexie.Table<SyncMetaRow, string>;

  /** Pre-migration copies of local data, kept as a recovery net. */
  syncBackup: Dexie.Table<SyncBackupRow, number>;

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
                task.subtasks?.length || 0,
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
        milestones:
          "++id, projectId, title, status, deadline, createdAt, updatedAt",
        issues:
          "++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt",
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
        milestones:
          "++id, projectId, title, status, deadline, createdAt, updatedAt",
        issues:
          "++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt",
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

    // Database version 6 schema definition (add rewards system)
    this.version(6).stores({
      configuration: "name",
      focus: "++id, tag, startTime, endTime",
      tasks: "++id, task, duedate, tags, priority, completed",
      notes: "++id, title, type, parentId, createdAt, updatedAt",
      projects: "++id, title, status, createdAt, updatedAt",
      milestones:
        "++id, projectId, title, status, deadline, createdAt, updatedAt",
      issues:
        "++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt",
      rewards: "++id, title, cost, category, createdAt, updatedAt",
      discounts: "++id, title, percentage, active, createdAt, updatedAt",
    });

    // Database version 7 schema definition (add excalidraw scenes)
    this.version(7).stores({
      configuration: "name",
      focus: "++id, tag, startTime, endTime",
      tasks: "++id, task, duedate, tags, priority, completed",
      notes: "++id, title, type, parentId, createdAt, updatedAt",
      projects: "++id, title, status, createdAt, updatedAt",
      milestones:
        "++id, projectId, title, status, deadline, createdAt, updatedAt",
      issues:
        "++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt",
      rewards: "++id, title, cost, category, createdAt, updatedAt",
      discounts: "++id, title, percentage, active, createdAt, updatedAt",
      excalidraw: "++id, title, createdAt, updatedAt",
    });

    // Database version 8 schema definition (flexible excalidraw IDs)
    // We can't change primary key of 'excalidraw', so we create 'excalidraw_v2'
    this.version(8).stores({
      excalidraw: null, // Delete old table
      excalidraw_v2: "id, title, createdAt, updatedAt",
    });

    // Database version 9 schema definition (AI chat)
    this.version(9).stores({
      ai_chats: "id, createdAt, updatedAt",
      ai_config: "key",
    });

    // Database version 10 schema definition (add sendWebhookUpdates toggle)
    this.version(10)
      .stores({})
      .upgrade((tx) => {
        return tx
          .table("configuration")
          .toCollection()
          .modify((config) => {
            if (config.sendWebhookUpdates === undefined) {
              config.sendWebhookUpdates = true;
            }
          });
      });

    // Database version 11 schema definition (add calendar timeblocks)
    this.version(11).stores({
      timeblocks: "++id, tag, startTime, endTime",
    });

    // Database version 12 schema definition (cross-device sync identity)
    //
    // Auto-incrementing keys are local facts: device A and device B both mint
    // focus session 7 for entirely different sessions. Every syncable table
    // gains a `uid` — unique so the database itself rejects a duplicate rather
    // than quietly forking a record — plus the three tables the sync engine
    // needs to track causality, its pull position, and a recovery copy.
    this.version(12)
      .stores({
        configuration: "name, &uid",
        focus: "++id, tag, startTime, endTime, &uid",
        notes: "++id, title, type, parentId, createdAt, updatedAt, &uid",
        projects: "++id, title, status, createdAt, updatedAt, &uid",
        milestones:
          "++id, projectId, title, status, deadline, createdAt, updatedAt, &uid",
        issues:
          "++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt, &uid",
        rewards: "++id, title, cost, category, createdAt, updatedAt, &uid",
        discounts: "++id, title, percentage, active, createdAt, updatedAt, &uid",
        excalidraw_v2: "id, title, createdAt, updatedAt, &uid",
        timeblocks: "++id, tag, startTime, endTime, &uid",
        sync_state: "[col+uid], col, dirty",
        sync_meta: "key",
        sync_backup: "++id, createdAt",
      })
      .upgrade(async (tx) => {
        // Mint an identity for every row that predates sync. Done inside the
        // upgrade transaction so a row can never be observed without one.
        const mint = () =>
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

        const tables = [
          "configuration",
          "focus",
          "notes",
          "projects",
          "milestones",
          "issues",
          "rewards",
          "discounts",
          "excalidraw_v2",
          "timeblocks",
        ];

        for (const name of tables) {
          await tx
            .table(name)
            .toCollection()
            .modify((row: Syncable) => {
              if (!row.uid) row.uid = mint();
            });
        }
      });

    // Table reference assignment
    this.timeblocks = this.table("timeblocks");
    this.configuration = this.table("configuration");
    this.focus = this.table("focus");
    this.notes = this.table("notes");
    this.projects = this.table("projects");
    this.milestones = this.table("milestones");
    this.issues = this.table("issues");
    this.rewards = this.table("rewards");
    this.discounts = this.table("discounts");
    this.excalidraw = this.table("excalidraw_v2");
    this.aiChats = this.table("ai_chats");
    this.aiConfig = this.table("ai_config");
    this.syncState = this.table("sync_state");
    this.syncMeta = this.table("sync_meta");
    this.syncBackup = this.table("sync_backup");
  }
}

// Export singleton database instance
const db = new BitFocusDB();
export default db;
