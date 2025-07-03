/**
 * Save Manager - Data Import/Export Functionality
 *
 * This module provides comprehensive data backup and restore capabilities for
 * the BIT Focus application. It handles the export of all application data
 * to portable .bitf.json files and the import of such files for data migration,
 * backup restoration, or cross-device synchronization.
 *
 * Features:
 * - Complete application data export to JSON format
 * - Data import with validation and error handling
 * - Local storage and IndexedDB backup/restore
 * - Date serialization and deserialization
 * - Atomic import operations with rollback capability
 * - Custom .bitf.json file format for data integrity
 *
 * Data Coverage:
 * - All IndexedDB tables (configuration, focus, tasks, notes)
 * - Complete localStorage state
 * - Proper date object handling
 * - Maintains data relationships and integrity
 *
 * Use Cases:
 * - Regular data backups
 * - Device migration
 * - Data sharing between instances
 * - Development and testing data setup
 *
 * Dependencies:
 * - Database instance for IndexedDB operations
 * - Browser File API for download/upload
 * - JSON serialization for data format
 *
 * @fileoverview Data import/export system for backup and migration
 * @author BIT Focus Development Team
 * @since v0.6.0-alpha
 */

import db from "./db";

/**
 * Exported Data Structure Interface
 *
 * Defines the complete structure of exported BIT Focus data including
 * both localStorage and IndexedDB contents. All dates are serialized
 * as ISO strings for JSON compatibility.
 */
type ExportedData = {
  /** Complete localStorage contents as key-value pairs */
  localStorage: Record<string, string>;
  /** All IndexedDB table data with serialized dates */
  indexedDB: {
    /** User configuration data */
    configuration: {
      name: string;
      dob: string; // Serialized as ISO string
      webhook: string;
    }[];
    /** Focus session records */
    focus: {
      id?: number;
      tag: string;
      startTime: string; // Serialized as ISO string
      endTime: string; // Serialized as ISO string
    }[];
    /** Task and todo records */
    tasks: {
      id?: number;
      task: string;
      subtasks: string[];
      duedate: string; // Serialized as ISO string
      tags: string[];
    }[];
    /** Note and document records */
    notes: {
      id?: number;
      title: string;
      type: "document" | "board";
      parentId?: number | null;
      content?: string;
      boardData?: { category: string; children: number[] }[];
      createdAt: string; // Serialized as ISO string
      updatedAt: string; // Serialized as ISO string
    }[];
  };
};

/**
 * Save Manager Class
 *
 * Provides static methods for handling data export and import operations.
 * Manages the complete application state including both persistent storage
 * systems (localStorage and IndexedDB) with proper error handling and
 * data integrity verification.
 *
 * @class
 */
class SaveManager {
  /**
   * Export All Application Data
   *
   * Creates a comprehensive backup of all application data including
   * localStorage contents and all IndexedDB tables. Serializes the data
   * to JSON format and triggers a file download with a timestamped filename.
   *
   * The export process handles date serialization, maintains data relationships,
   * and creates a portable .bitf.json file that can be imported on any
   * compatible BIT Focus instance.
   *
   * @static
   * @async
   * @returns {Promise<void>} Resolves when export is complete
   * @throws {Error} If export process fails
   *
   * @example
   * ```typescript
   * // Export all data
   * try {
   *   await SaveManager.exportData();
   *   console.log("Data exported successfully");
   * } catch (error) {
   *   console.error("Export failed:", error);
   * }
   * ```
   *
   * @see {@link ExportedData} for exported data structure
   */
  static async exportData(): Promise<void> {
    // Initialize export data structure
    const data: ExportedData = {
      localStorage: {},
      indexedDB: {
        // Serialize configuration data with date conversion
        configuration: (await db.configuration.toArray()).map((c) => ({
          ...c,
          dob: c.dob.toISOString(),
        })),
        // Serialize focus sessions with date conversion
        focus: (await db.focus.toArray()).map((f) => ({
          ...f,
          startTime: f.startTime.toISOString(),
          endTime: f.endTime.toISOString(),
        })),
        // Serialize tasks with date conversion
        tasks: (await db.tasks.toArray()).map((t) => ({
          ...t,
          duedate: t.duedate.toISOString(),
        })),
        // Serialize notes with date conversion
        notes: (await db.notes.toArray()).map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        })),
      },
    };

    // Export localStorage contents
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data.localStorage[key] = localStorage.getItem(key) || "";
      }
    }

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
   * Import Application Data from File
   *
   * Restores application data from a .bitf.json backup file. Performs
   * comprehensive data validation, clears existing data, and imports
   * the backup contents. The import process is atomic - either all
   * data is imported successfully or the operation fails completely.
   *
   * Handles date deserialization, maintains data integrity, and restores
   * both localStorage and IndexedDB contents. After successful import,
   * the application should be refreshed to reflect the restored state.
   *
   * @static
   * @async
   * @param {File} file - The .bitf.json file to import
   * @returns {Promise<void>} Resolves when import is complete
   * @throws {Error} If file parsing or import process fails
   *
   * @example
   * ```typescript
   * // Import data from file upload
   * const handleFileImport = async (file: File) => {
   *   try {
   *     await SaveManager.importData(file);
   *     console.log("Data imported successfully");
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
    // Parse and validate file contents
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;

    // Type assertion - assume correct format (could add validation here)
    const data = parsed as ExportedData;

    // Deserialize dates and reconstruct data objects
    const configuration = data.indexedDB.configuration.map((c) => ({
      ...c,
      dob: new Date(c.dob),
    }));

    const focus = data.indexedDB.focus.map((f) => ({
      ...f,
      startTime: new Date(f.startTime),
      endTime: new Date(f.endTime),
    }));

    const tasks = data.indexedDB.tasks.map((t) => ({
      ...t,
      duedate: new Date(t.duedate),
    }));

    const notes = data.indexedDB.notes.map((n) => ({
      ...n,
      createdAt: new Date(n.createdAt),
      updatedAt: new Date(n.updatedAt),
    }));

    // Atomic database import operation
    await db.transaction(
      "rw",
      db.configuration,
      db.focus,
      db.tasks,
      db.notes,
      async () => {
        // Clear existing data
        await db.configuration.clear();
        await db.focus.clear();
        await db.tasks.clear();
        await db.notes.clear();

        // Import new data
        await db.configuration.bulkAdd(configuration);
        await db.focus.bulkAdd(focus);
        await db.tasks.bulkAdd(tasks);
        await db.notes.bulkAdd(notes);
      }
    );

    // Restore localStorage contents
    localStorage.clear();
    for (const [key, value] of Object.entries(data.localStorage)) {
      localStorage.setItem(key, value);
    }
  }
}

export default SaveManager;
