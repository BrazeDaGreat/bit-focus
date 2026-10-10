/**
 * Save Manager - Enhanced Data Import/Export with Project Management Support
 *
 * This module provides comprehensive data backup and restore capabilities for
 * the BIT Focus application. Updated to support the complete project management
 * system including projects, milestones, and issues while maintaining backward
 * compatibility with existing data exports.
 *
 * Features:
 * - Complete application data export to JSON format
 * - Data import with validation and error handling
 * - Local storage and IndexedDB backup/restore
 * - Date serialization and deserialization
 * - Atomic import operations with rollback capability
 * - Custom .bitf.json file format for data integrity
 * - Full project management data support
 *
 * Data Coverage:
 * - All IndexedDB tables (configuration, focus, notes, projects, milestones, issues)
 * - Complete localStorage state
 * - Proper date object handling including optional dates
 * - Maintains data relationships and integrity
 * - Project hierarchy and issue tracking persistence
 *
 * Use Cases:
 * - Regular data backups including project data
 * - Device migration with complete project portfolios
 * - Data sharing between instances
 * - Development and testing data setup
 * - Project portfolio backup and restore
 *
 * Dependencies:
 * - Database instance for IndexedDB operations
 * - Browser File API for download/upload
 * - JSON serialization for data format
 *
 * @fileoverview Enhanced data import/export system with complete project management support
 * @author BIT Focus Development Team
 * @since v0.6.0-alpha
 * @updated v0.9.7-alpha
 */

import Dexie from "dexie";
import db, { type AIConfig, QuickLink } from "./db";
import type { NoteAsset } from "./notes";
import { serializeTasks, deserializeTasks, serializeAttachment, deserializeAttachment, deserializeTaskFilter, type SavedTask, type SavedTaskFilter, type SavedTaskAttachment } from "./task-backup";
import { migrateTasks } from "./task-migration";
import { PB_AUTH_STORAGE_KEY } from "./pocketbase";

/**
 * localStorage keys that survive an import.
 *
 * Restoring a backup replaces localStorage wholesale, which would otherwise
 * sign the user out of the account they are restoring from and reset the sync
 * bookkeeping mid-operation. These keys belong to the device and the session,
 * not to the data being restored.
 */
const PROTECTED_LOCAL_KEYS: readonly string[] = [
  PB_AUTH_STORAGE_KEY,
  "bitfocus.sync.state",
  "bitfocus.sync.device",
];

/** True when a localStorage key belongs to the device rather than the backup. */
export function isProtectedLocalKey(key: string): boolean {
  return key.startsWith("bitfocus.sync.") || key === "pomoTask" || PROTECTED_LOCAL_KEYS.includes(key);
}

/**
 * Replace localStorage with the imported contents, keeping device-owned keys.
 *
 * @param entries - Key/value pairs from the backup.
 */
function restoreLocalStorage(entries: Record<string, string>): void {
  const preserved = new Map<string, string>();
  const protectedKeys = [...PROTECTED_LOCAL_KEYS];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isProtectedLocalKey(key)) protectedKeys.push(key);
  }
  for (const key of protectedKeys) {
    const value = localStorage.getItem(key);
    if (value !== null) preserved.set(key, value);
  }

  localStorage.clear();

  for (const [key, value] of Object.entries(entries)) {
    if (isProtectedLocalKey(key)) continue;
    localStorage.setItem(key, value);
  }
  for (const [key, value] of preserved) {
    localStorage.setItem(key, value);
  }
}

/**
 * Enhanced Exported Data Structure Interface
 *
 * Defines the complete structure of exported BIT Focus data including
 * both localStorage and IndexedDB contents. Updated to include the
 * complete project management system with projects, milestones, and issues
 * while maintaining backward compatibility.
 */
type ExportedData = {
  /** Complete localStorage contents as key-value pairs */
  localStorage: Record<string, string>;
  /** All IndexedDB table data with serialized dates */
  indexedDB: {
    tasks?: SavedTask[];
    taskAttachments?: SavedTaskAttachment[];
    /** Images are included when a manual backup opts into attachments. */
    noteAssets?: (Omit<NoteAsset, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string })[];
    taskFilters?: SavedTaskFilter[];
    legacyTasks?: Record<string, unknown>[];
    /** User configuration data */
    configuration: {
      name: string;
      dob: string | null; // Serialized as ISO string or null
      webhook: string;
      currency: string;
    }[];
    /** Focus session records */
    focus: {
      id?: number;
      tag: string;
      taskUid?: string;
      projectUid?: string;
      startTime: string; // Serialized as ISO string
      endTime: string; // Serialized as ISO string
    }[];
    /** Note and document records */
    notes: {
      id?: number;
      uid?: string;
      title: string;
      type: "document" | "board";
      icon?: string;
      order?: number;
      deletedAt?: string | null;
      parentId?: number | null;
      content?: string;
      boardData?: { category: string; children: number[] }[];
      createdAt: string; // Serialized as ISO string
      updatedAt: string; // Serialized as ISO string
    }[];
    /** Project records */
    projects: {
      id?: number;
      title: string;
      status: "Scheduled" | "Active" | "Closed";
      notes: string;
      version: string;
      quickLinks: QuickLink[];
      icon?: string;
      createdAt: string; // Serialized as ISO string
      updatedAt: string; // Serialized as ISO string
    }[];
    /** Milestone records */
    milestones: {
      id?: number;
      projectId: number;
      title: string;
      status: "Scheduled" | "Active" | "Closed" | "Paid";
      deadline?: string; // Serialized as ISO string (optional)
      budget: number;
      createdAt: string; // Serialized as ISO string
      updatedAt: string; // Serialized as ISO string
    }[];
    /** Issue records */
    issues: {
      id?: number;
      milestoneId: number;
      title: string;
      label: string;
      dueDate?: string; // Serialized as ISO string (optional)
      status: "Open" | "Close";
      description: string;
      createdAt: string; // Serialized as ISO string
      updatedAt: string; // Serialized as ISO string
    }[];
    rewards: {
      id?: number;
      title: string;
      description?: string;
      cost: number;
      category?: string;
      emoji?: string;
      createdAt: string;
      updatedAt: string;
    }[];
    discounts: {
      id?: number;
      title: string;
      percentage: number;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }[];
    /** AI chat records */
    aiChats: {
      id: string;
      title: string;
      modelId: string;
      provider: string;
      messages: string;
      createdAt: string;
      updatedAt: string;
    }[];
    /** AI config */
    aiConfig: AIConfig[];
    /** Calendar timeblock records */
    timeblocks?: {
      id?: number;
      tag: string;
      taskUid?: string;
      projectUid?: string;
      startTime: string; // Serialized as ISO string
      endTime: string; // Serialized as ISO string
      title?: string;
    }[];
  };
};

export type { ExportedData };

/**
 * Enhanced Save Manager Class
 *
 * Provides static methods for handling data export and import operations
 * with support for the complete project management system. Maintains backward
 * compatibility while providing enhanced functionality for the comprehensive
 * project management features including projects, milestones, and issues.
 *
 * @class
 */
class SaveManager {
  /**
   * Export All Application Data (Enhanced with Project Management)
   *
   * Creates a comprehensive backup of all application data including
   * localStorage contents and all IndexedDB tables. Updated to include
   * the complete project management system with proper date serialization
   * for all project-related entities while maintaining compatibility
   * with the existing export format.
   *
   * @static
   * @async
   * @returns {Promise<void>} Resolves when export is complete
   * @throws {Error} If export process fails
   *
   * @example
   * ```typescript
   * // Export all data including complete project management system
   * try {
   *   await SaveManager.exportData();
   *   console.log("Data exported successfully with project management support");
   * } catch (error) {
   *   console.error("Export failed:", error);
   * }
   * ```
   *
   * @see {@link ExportedData} for exported data structure
   */
  static async exportData(options: { includeAttachments?: boolean } = {}): Promise<void> {
    // Manual export opts in; automatic downloads and cloud snapshots omit files.
    const data = await SaveManager.exportJSON(options);

    // Create and download backup file
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data-${new Date().toISOString()}.bitf.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import Application Data from File (Enhanced with Project Management)
   *
   * Restores application data from a .bitf.json backup file with enhanced
   * support for the complete project management system. Handles projects,
   * milestones, and issues with proper date deserialization including
   * optional date fields. Provides backward compatibility for legacy exports
   * while supporting the new project management features.
   *
   * @static
   * @async
   * @param {File} file - The .bitf.json file to import
   * @returns {Promise<void>} Resolves when import is complete
   * @throws {Error} If file parsing or import process fails
   *
   * @example
   * ```typescript
   * // Import data with complete project management support
   * const handleFileImport = async (file: File) => {
   *   try {
   *     await SaveManager.importData(file);
   *     console.log("Data imported successfully with project management support");
   *     // Refresh application to reflect changes
   *     window.location.reload();
   *   } catch (error) {
   *     console.error("Import failed:", error);
   *   }
   * };
   * ```
   *
   * @see {@link ExportedData} for expected file structure
   */
  static async importData(file: File): Promise<void> {
    await SaveManager.importJSON(JSON.parse(await file.text()) as ExportedData);
  }

  /**
   * Export All Application Data as JSON Object (No Download)
   *
   * Returns the complete application data as an `ExportedData` object.
   * Useful for programmatic exports (e.g. API sync or cloud backup).
   *
   * @returns {Promise<ExportedData>} All application data
   */
  static async exportJSON(options: { includeAttachments?: boolean } = {}): Promise<ExportedData> {
    const data: ExportedData = {
      localStorage: {},
      indexedDB: {
        tasks: serializeTasks(await db.tasks.toArray()),
        taskFilters: (await db.taskFilters.toArray()).map((f) => ({ ...f, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() })),
        legacyTasks: await db.table("tasks").toArray(),
        configuration: (await db.configuration.toArray()).map((c) => ({
          ...c,
          dob: c.dob ? c.dob.toISOString() : null,
        })),
        focus: (await db.focus.toArray()).map((f) => ({
          ...f,
          startTime: f.startTime.toISOString(),
          endTime: f.endTime.toISOString(),
        })),
        notes: (await db.notes.toArray()).map((n) => ({
          ...n,
          deletedAt: n.deletedAt ? n.deletedAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        })),
        projects: (await db.projects.toArray()).map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
        milestones: (await db.milestones.toArray()).map((m) => ({
          ...m,
          deadline: m.deadline ? m.deadline.toISOString() : undefined,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        })),
        issues: (await db.issues.toArray()).map((i) => ({
          ...i,
          dueDate: i.dueDate ? i.dueDate.toISOString() : undefined,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
        })),
        rewards: (await db.rewards.toArray()).map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        discounts: (await db.discounts.toArray()).map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        aiChats: (await db.aiChats.toArray()).map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
        aiConfig: await db.aiConfig.toArray(),
        // Serialize calendar timeblocks with date conversion
        timeblocks: (await db.timeblocks.toArray()).map((t) => ({
          ...t,
          startTime: t.startTime.toISOString(),
          endTime: t.endTime.toISOString(),
        })),
      },
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Session tokens and sync bookkeeping are device-owned: they never leave
      // this browser, in a backup file or a cloud snapshot.
      if (key && !isProtectedLocalKey(key)) {
        data.localStorage[key] = localStorage.getItem(key) || "";
      }
    }

    // Automatic snapshots omit large files; note assets still sync per row.
    if (options.includeAttachments) {
      data.indexedDB.noteAssets = (await db.noteAssets.toArray()).map((asset) => ({
        ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(),
      }));
      data.indexedDB.taskAttachments = [];
      // Encode one file at a time to avoid loading every blob into memory together.
      for (const attachment of await db.taskAttachments.toArray())
        data.indexedDB.taskAttachments.push(await serializeAttachment(attachment));
    }
    return data;
  }

  /**
   * Import Application Data from JSON Object (No File)
   *
   * Restores application data from a parsed `ExportedData` object.
   * Useful for programmatic imports (e.g. API sync or cloud restore).
   *
   * @param {ExportedData} data - Parsed export JSON object
   * @returns {Promise<void>}
   */
  static async importJSON(data: ExportedData): Promise<void> {
    const configuration = data.indexedDB.configuration.map((c) => ({
      ...c,
      dob: c.dob ? new Date(c.dob) : null,
    }));

    const focus = data.indexedDB.focus.map((f) => ({
      ...f,
      startTime: new Date(f.startTime),
      endTime: new Date(f.endTime),
    }));

    const notes = data.indexedDB.notes.map((n) => ({
      ...n,
      deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
      createdAt: new Date(n.createdAt),
      updatedAt: new Date(n.updatedAt),
    }));

    const tasks = deserializeTasks(data.indexedDB.tasks || []);
    // Validate blobs before starting the destructive part of the restore.
    const attachments = data.indexedDB.taskAttachments?.map(deserializeAttachment);
    const noteAssets = data.indexedDB.noteAssets?.map((asset) => ({
      ...asset, createdAt: new Date(asset.createdAt), updatedAt: new Date(asset.updatedAt),
    }));
    const taskFilters = (data.indexedDB.taskFilters || []).map(deserializeTaskFilter);
    const legacyTasks = data.indexedDB.legacyTasks || [];
    const projects = (data.indexedDB.projects || []).map((p) => ({
      ...p,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
    }));

    const milestones = (data.indexedDB.milestones || []).map((m) => ({
      ...m,
      deadline: m.deadline ? new Date(m.deadline) : undefined,
      createdAt: new Date(m.createdAt),
      updatedAt: new Date(m.updatedAt),
    }));

    const issues = (data.indexedDB.issues || []).map((i) => ({
      ...i,
      dueDate: i.dueDate ? new Date(i.dueDate) : undefined,
      createdAt: new Date(i.createdAt),
      updatedAt: new Date(i.updatedAt),
    }));

    const rewards = (data.indexedDB.rewards || []).map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }));

    const discounts = (data.indexedDB.discounts || []).map((d) => ({
      ...d,
      createdAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt),
    }));

    const aiChats = (data.indexedDB.aiChats || []).map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    }));

    const aiConfig = data.indexedDB.aiConfig || [];

    // Deserialize timeblocks with date conversion
    const timeblocks = (data.indexedDB.timeblocks || []).map((t) => ({
      ...t,
      startTime: new Date(t.startTime),
      endTime: new Date(t.endTime),
    }));

    await db.transaction(
      "rw",
      [
        db.configuration,
        db.focus,
        db.notes,
        db.noteAssets,
        db.projects,
        db.milestones,
        db.issues,
        db.rewards,
        db.discounts,
        db.aiChats,
        db.aiConfig,
        db.timeblocks,
        db.tasks,
        db.taskFilters,
        db.taskAttachments,
        db.table("tasks"),
        db.syncState,
      ],
      async () => {
        await db.configuration.clear();
        await db.focus.clear();
        await db.notes.clear();
        // Older backups and automatic snapshots leave existing note images intact.
        if (noteAssets) await db.noteAssets.clear();
        await db.projects.clear();
        await db.milestones.clear();
        await db.issues.clear();
        await db.rewards.clear();
        await db.discounts.clear();
        await db.aiChats.clear();
        await db.aiConfig.clear();
        await db.timeblocks.clear();
        await db.tasks.clear();
        await db.taskFilters.clear();
        // Snapshots without files preserve local attachments for matching task UIDs.
        if (attachments) await db.taskAttachments.clear();
        await db.table("tasks").clear();

        await db.configuration.bulkAdd(configuration);
        await db.focus.bulkAdd(focus);
        await db.notes.bulkAdd(notes);
        if (noteAssets) await db.noteAssets.bulkAdd(noteAssets);

        if (projects.length > 0) {
          await db.projects.bulkAdd(projects);
        }
        if (milestones.length > 0) {
          await db.milestones.bulkAdd(milestones);
        }
        if (issues.length > 0) {
          await db.issues.bulkAdd(issues);
        }
        if (rewards.length > 0) {
          await db.rewards.bulkAdd(rewards);
        }
        if (discounts.length > 0) {
          await db.discounts.bulkAdd(discounts);
        }
        if (aiChats.length > 0) {
          await db.aiChats.bulkAdd(aiChats);
        }
        if (aiConfig.length > 0) {
          await db.aiConfig.bulkAdd(aiConfig);
        }
        if (timeblocks.length > 0) {
          await db.timeblocks.bulkAdd(timeblocks);
        }
        await db.tasks.bulkAdd(tasks);
        if (attachments) await db.taskAttachments.bulkAdd(attachments);
        await db.taskFilters.bulkAdd(taskFilters);
        await db.table("tasks").bulkAdd(legacyTasks);
        if (!data.indexedDB.tasks) await migrateTasks(Dexie.currentTransaction!, true);
        const taskUids = new Set((await db.tasks.toArray()).map((task) => task.uid));
        await db.taskAttachments.filter((attachment) => !taskUids.has(attachment.taskUid)).delete();
      },
    );

    restoreLocalStorage(data.localStorage);
  }
}

export default SaveManager;
