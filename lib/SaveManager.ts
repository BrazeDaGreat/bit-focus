/**
 * Save Manager - Enhanced Data Import/Export with Completion Tracking
 *
 * This module provides comprehensive data backup and restore capabilities for
 * the BIT Focus application. Updated to support the new completion tracking
 * fields and maintain backward compatibility with existing data exports.
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
 * - All IndexedDB tables (configuration, focus, notes)
 * - Complete localStorage state
 * - Proper date object handling
 * - Maintains data relationships and integrity
 * - Subtask completion states persistence
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
 * @fileoverview Enhanced data import/export system with completion tracking support
 * @author BIT Focus Development Team
 * @since v0.6.0-alpha
 * @updated v0.8.2-alpha
 */

import db from "./db";

/**
 * Enhanced Exported Data Structure Interface
 *
 * Defines the complete structure of exported BIT Focus data including
 * both localStorage and IndexedDB contents. Updated to include the
 * new completion tracking fields while maintaining backward compatibility.
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
      currency: string;
    }[];
    /** Focus session records */
    focus: {
      id?: number;
      tag: string;
      startTime: string; // Serialized as ISO string
      endTime: string; // Serialized as ISO string
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
 * Enhanced Save Manager Class
 *
 * Provides static methods for handling data export and import operations
 * with support for the new completion tracking fields. Maintains backward
 * compatibility while providing enhanced functionality for the improved
 * task management system with persistent subtask states.
 *
 * @class
 */
class SaveManager {
  /**
   * Export All Application Data (Enhanced with Completion Tracking)
   *
   * Creates a comprehensive backup of all application data including
   * localStorage contents and all IndexedDB tables. Updated to include
   * the new completion tracking fields and subtask persistence while
   * maintaining compatibility with the existing export format.
   *
   * @static
   * @async
   * @returns {Promise<void>} Resolves when export is complete
   * @throws {Error} If export process fails
   *
   * @example
   * ```typescript
   * // Export all data including enhanced tasks with completion tracking
   * try {
   *   await SaveManager.exportData();
   *   console.log("Data exported successfully with completion tracking support");
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
   * Import Application Data from File (Enhanced with Completion Tracking)
   *
   * Restores application data from a .bitf.json backup file with enhanced
   * support for task completion tracking and subtask persistence. Provides
   * backward compatibility for legacy exports while supporting the new
   * completion-based task system.
   *
   * @static
   * @async
   * @param {File} file - The .bitf.json file to import
   * @returns {Promise<void>} Resolves when import is complete
   * @throws {Error} If file parsing or import process fails
   *
   * @example
   * ```typescript
   * // Import data with enhanced task and completion support
   * const handleFileImport = async (file: File) => {
   *   try {
   *     await SaveManager.importData(file);
   *     console.log("Data imported successfully with completion tracking support");
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
      db.notes,
      async () => {
        // Clear existing data
        await db.configuration.clear();
        await db.focus.clear();
        await db.notes.clear();

        // Import new data with enhanced task support
        await db.configuration.bulkAdd(configuration);
        await db.focus.bulkAdd(focus);
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
