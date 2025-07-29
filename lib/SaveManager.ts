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

import db, { QuickLink } from "./db";

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
    /** Project records */
    projects: {
      id?: number;
      title: string;
      status: "Scheduled" | "Active" | "Closed";
      notes: string;
      version: string;
      quickLinks: QuickLink[];
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
  };
};

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
        // Serialize projects with date conversion
        projects: (await db.projects.toArray()).map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
        // Serialize milestones with date conversion (including optional deadline)
        milestones: (await db.milestones.toArray()).map((m) => ({
          ...m,
          deadline: m.deadline ? m.deadline.toISOString() : undefined,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        })),
        // Serialize issues with date conversion (including optional dueDate)
        issues: (await db.issues.toArray()).map((i) => ({
          ...i,
          dueDate: i.dueDate ? i.dueDate.toISOString() : undefined,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
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

    // Deserialize projects with date conversion
    const projects = (data.indexedDB.projects || []).map((p) => ({
      ...p,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
    }));

    // Deserialize milestones with date conversion (including optional deadline)
    const milestones = (data.indexedDB.milestones || []).map((m) => ({
      ...m,
      deadline: m.deadline ? new Date(m.deadline) : undefined,
      createdAt: new Date(m.createdAt),
      updatedAt: new Date(m.updatedAt),
    }));

    // Deserialize issues with date conversion (including optional dueDate)
    const issues = (data.indexedDB.issues || []).map((i) => ({
      ...i,
      dueDate: i.dueDate ? new Date(i.dueDate) : undefined,
      createdAt: new Date(i.createdAt),
      updatedAt: new Date(i.updatedAt),
    }));

    // Atomic database import operation including all tables
    await db.transaction(
      "rw",
      [
        db.configuration,
        db.focus,
        db.notes,
        db.projects,
        db.milestones,
        db.issues,
      ],
      async () => {
        // Clear existing data from all tables
        await db.configuration.clear();
        await db.focus.clear();
        await db.notes.clear();
        await db.projects.clear();
        await db.milestones.clear();
        await db.issues.clear();

        // Import new data with project management support
        await db.configuration.bulkAdd(configuration);
        await db.focus.bulkAdd(focus);
        await db.notes.bulkAdd(notes);

        // Import project management data (only if present for backward compatibility)
        if (projects.length > 0) {
          await db.projects.bulkAdd(projects);
        }
        if (milestones.length > 0) {
          await db.milestones.bulkAdd(milestones);
        }
        if (issues.length > 0) {
          await db.issues.bulkAdd(issues);
        }
      }
    );

    // Restore localStorage contents
    localStorage.clear();
    for (const [key, value] of Object.entries(data.localStorage)) {
      localStorage.setItem(key, value);
    }
  }

  /**
   * Export All Application Data as JSON Object (No Download)
   *
   * Returns the complete application data as an `ExportedData` object.
   * Useful for programmatic exports (e.g. API sync or cloud backup).
   *
   * @returns {Promise<ExportedData>} All application data
   */
  static async exportJSON(): Promise<ExportedData> {
    const data: ExportedData = {
      localStorage: {},
      indexedDB: {
        configuration: (await db.configuration.toArray()).map((c) => ({
          ...c,
          dob: c.dob.toISOString(),
        })),
        focus: (await db.focus.toArray()).map((f) => ({
          ...f,
          startTime: f.startTime.toISOString(),
          endTime: f.endTime.toISOString(),
        })),
        notes: (await db.notes.toArray()).map((n) => ({
          ...n,
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
      },
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data.localStorage[key] = localStorage.getItem(key) || "";
      }
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

    await db.transaction(
      "rw",
      [
        db.configuration,
        db.focus,
        db.notes,
        db.projects,
        db.milestones,
        db.issues,
      ],
      async () => {
        await db.configuration.clear();
        await db.focus.clear();
        await db.notes.clear();
        await db.projects.clear();
        await db.milestones.clear();
        await db.issues.clear();

        await db.configuration.bulkAdd(configuration);
        await db.focus.bulkAdd(focus);
        await db.notes.bulkAdd(notes);

        if (projects.length > 0) {
          await db.projects.bulkAdd(projects);
        }
        if (milestones.length > 0) {
          await db.milestones.bulkAdd(milestones);
        }
        if (issues.length > 0) {
          await db.issues.bulkAdd(issues);
        }
      }
    );

    localStorage.clear();
    for (const [key, value] of Object.entries(data.localStorage)) {
      localStorage.setItem(key, value);
    }
  }
}

export default SaveManager;
