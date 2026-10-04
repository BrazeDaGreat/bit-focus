/**
 * Focus Sessions Management Hook - Core Productivity Data Store
 *
 * This Zustand-based hook manages focus session data including creation,
 * retrieval, editing, and deletion of focus tracking records. It serves
 * as the central data store for all productivity analytics and session
 * management throughout the BIT Focus application.
 *
 * Features:
 * - Complete CRUD operations for focus sessions
 * - Real-time session data synchronization
 * - Optimistic UI updates for responsive interactions
 * - Loading state management for better UX
 * - Type-safe session data handling
 * - Database integration with error handling
 *
 * Session Data Structure:
 * - Unique session identifiers
 * - Tag-based categorization system
 * - Precise start and end timestamps
 * - Duration calculations and analytics
 * - Chronological ordering for timeline views
 *
 * Storage Architecture:
 * - IndexedDB persistence via Dexie
 * - Zustand for reactive state management
 * - Optimistic updates with database sync
 * - Error handling and rollback capabilities
 *
 * Dependencies:
 * - Zustand for state management
 * - Database instance for persistence
 * - TypeScript interfaces for type safety
 *
 * @fileoverview Focus session data management and analytics store
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 */

import { create } from "zustand";
import db from "@/lib/db";

/**
 * Focus Session Data Interface
 *
 * Defines the structure of a focus session record including all
 * necessary fields for session tracking, categorization, and
 * analytics calculations.
 */
export interface FocusSession {
  taskUid?: string;
  projectUid?: string;
  /** Unique session identifier (auto-generated) */
  id?: number;
  /** Category tag for session organization */
  tag: string;
  /** Session start timestamp */
  startTime: Date;
  /** Session end timestamp */
  endTime: Date;
  /** Sync identity (set by the sync tracker; kept so undo restores the same row) */
  uid?: string;
}

/** Newest first, by when the session started. */
function byStartDesc(a: FocusSession, b: FocusSession): number {
  return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
}

/**
 * Focus State Management Interface
 *
 * Defines the complete state structure and available operations
 * for focus session management including data arrays, loading
 * states, and CRUD operation functions.
 */
interface FocusState {
  /** Array of all focus sessions in reverse chronological order */
  focusSessions: FocusSession[];
  /** Loading state indicator for UI feedback */
  loadingFocusSessions: boolean;
  /** Function to create a new focus session */
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date,
    attribution?: { taskUid?: string; projectUid?: string }
  ) => Promise<void>;
  /** Function to load all focus sessions from database */
  loadFocusSessions: () => Promise<void>;
  /** Function to delete a focus session by ID; resolves with the removed row */
  removeFocusSession: (id: number) => Promise<FocusSession | undefined>;
  /** Function to update an existing focus session */
  editFocusSession: (
    id: number,
    updatedSession: Partial<FocusSession>
  ) => Promise<void>;
  /** Function to delete multiple focus sessions by ID; resolves with the removed rows */
  bulkRemoveFocusSessions: (ids: number[]) => Promise<FocusSession[]>;
  /** Function to re-tag multiple focus sessions at once; resolves with each previous tag */
  bulkUpdateTag: (ids: number[], tag: string) => Promise<Map<number, string>>;
  /** Put previously removed sessions back exactly as they were (undo) */
  restoreFocusSessions: (sessions: FocusSession[]) => Promise<void>;
  /** Give sessions back their previous tags (undo of a bulk re-tag) */
  restoreTags: (previous: Map<number, string>) => Promise<void>;
}

/**
 * Focus Sessions Store
 *
 * Creates a Zustand store for managing focus session data with full
 * CRUD capabilities and database persistence. The store maintains
 * sessions in reverse chronological order for optimal UI display
 * and provides optimistic updates for responsive user interactions.
 *
 * All database operations include proper error handling and state
 * management to ensure data consistency and provide feedback for
 * failed operations.
 *
 * @hook
 * @returns {FocusState} Focus session state and management functions
 *
 * @example
 * ```tsx
 * // Basic session management
 * function FocusTracker() {
 *   const {
 *     focusSessions,
 *     loadingFocusSessions,
 *     addFocusSession,
 *     loadFocusSessions
 *   } = useFocus();
 *
 *   useEffect(() => {
 *     loadFocusSessions();
 *   }, [loadFocusSessions]);
 *
 *   const handleSessionEnd = async () => {
 *     await addFocusSession(
 *       "Work",
 *       startTime,
 *       new Date()
 *     );
 *   };
 *
 *   if (loadingFocusSessions) {
 *     return <SessionSkeleton />;
 *   }
 *
 *   return (
 *     <div>
 *       {focusSessions.map(session => (
 *         <SessionCard key={session.id} session={session} />
 *       ))}
 *     </div>
 *   );
 * }
 *
 * // Session editing
 * function SessionEditor({ sessionId }) {
 *   const { editFocusSession } = useFocus();
 *
 *   const handleEdit = async (updates) => {
 *     await editFocusSession(sessionId, {
 *       tag: updates.newTag,
 *       startTime: updates.newStartTime
 *     });
 *   };
 *
 *   return <EditForm onSubmit={handleEdit} />;
 * }
 * ```
 *
 * @see {@link FocusSession} for session data structure
 * @see {@link db} for database operations
 * @see {@link https://github.com/pmndrs/zustand} for Zustand documentation
 */
export const useFocus = create<FocusState>((set) => ({
  // Initial state
  focusSessions: [],
  loadingFocusSessions: true,

  /**
   * Add New Focus Session
   *
   * Creates a new focus session record in the database and updates
   * the local state with optimistic updates. The new session is
   * prepended to the sessions array to maintain reverse chronological
   * ordering for optimal UI display.
   *
   * @async
   * @param {string} tag - Category tag for the session
   * @param {Date} startTime - Session start timestamp
   * @param {Date} endTime - Session end timestamp
   * @returns {Promise<void>} Resolves when session is created
   *
   * @example
   * ```typescript
   * // Add a completed focus session
   * await addFocusSession(
   *   "Deep Work",
   *   new Date("2024-01-15T09:00:00"),
   *   new Date("2024-01-15T10:30:00")
   * );
   * ```
   */
  addFocusSession: async (tag, startTime, endTime, attribution = {}) => {
    // Add to database and get generated ID
    const id = await db.focus.add({ tag, startTime, endTime, ...attribution });

    // Insert and keep newest-first order (manual sessions can be in the past)
    set((state) => ({
      focusSessions: [{ id, tag, startTime, endTime, ...attribution }, ...state.focusSessions].sort(byStartDesc),
    }));
  },

  /**
   * Load All Focus Sessions
   *
   * Retrieves all focus sessions from the database and updates the
   * local state. Sessions are sorted newest first by start time, so
   * sessions added or edited by hand land in the right place.
   *
   * Manages loading state to provide UI feedback during the
   * database operation and handles errors gracefully with
   * proper error logging.
   *
   * @async
   * @returns {Promise<void>} Resolves when sessions are loaded
   *
   * @example
   * ```typescript
   * // Load sessions on component mount
   * useEffect(() => {
   *   loadFocusSessions();
   * }, [loadFocusSessions]);
   * ```
   */
  loadFocusSessions: async () => {
    set({ loadingFocusSessions: true });
    try {
      // Fetch all sessions from database
      const sessions = await db.focus.toArray();

      set({ focusSessions: sessions.sort(byStartDesc) });
    } catch (error) {
      console.error("Failed to load focus sessions:", error);
    } finally {
      // Always clear loading state
      set({ loadingFocusSessions: false });
    }
  },

  /**
   * Remove Focus Session
   *
   * Deletes a focus session from both the database and local state.
   * Uses optimistic updates to immediately remove the session from
   * the UI while the database operation completes in the background.
   *
   * @async
   * @param {number} id - Unique identifier of the session to remove
   * @returns {Promise<void>} Resolves when session is deleted
   *
   * @example
   * ```typescript
   * // Delete a session
   * const handleDelete = async (sessionId: number) => {
   *   await removeFocusSession(sessionId);
   * };
   * ```
   */
  removeFocusSession: async (id: number) => {
    // Keep the full row (uid included) so the delete can be undone
    const removed = await db.focus.get(id);
    await db.focus.delete(id);

    set((state) => ({
      focusSessions: state.focusSessions.filter((session) => session.id !== id),
    }));
    return removed;
  },

  /**
   * Edit Focus Session
   *
   * Updates an existing focus session with partial data changes.
   * Supports updating any combination of session fields while
   * maintaining data consistency and providing optimistic UI updates.
   *
   * The function uses partial updates to allow flexible editing
   * of individual session properties without requiring complete
   * session data reconstruction.
   *
   * @async
   * @param {number} id - Unique identifier of the session to edit
   * @param {Partial<FocusSession>} updatedSession - Partial session data with updates
   * @returns {Promise<void>} Resolves when session is updated
   *
   * @example
   * ```typescript
   * // Update session tag
   * await editFocusSession(sessionId, {
   *   tag: "New Category"
   * });
   *
   * // Update session duration
   * await editFocusSession(sessionId, {
   *   startTime: new Date("2024-01-15T09:00:00"),
   *   endTime: new Date("2024-01-15T11:00:00")
   * });
   *
   * // Update multiple fields
   * await editFocusSession(sessionId, {
   *   tag: "Work",
   *   startTime: adjustedStartTime,
   *   endTime: adjustedEndTime
   * });
   * ```
   */
  editFocusSession: async (
    id: number,
    updatedSession: Partial<FocusSession>
  ) => {
    // Update database record
    await db.focus.update(id, updatedSession);

    // Update local state; an edited start time can move the session
    set((state) => ({
      focusSessions: state.focusSessions
        .map((session) =>
          session.id === id ? { ...session, ...updatedSession } : session
        )
        .sort(byStartDesc),
    }));
  },

  /**
   * Bulk Remove Focus Sessions
   *
   * Deletes multiple focus sessions in a single database operation
   * and removes them from local state.
   *
   * @async
   * @param {number[]} ids - Identifiers of the sessions to remove
   * @returns {Promise<void>} Resolves when all sessions are deleted
   */
  bulkRemoveFocusSessions: async (ids: number[]) => {
    const removed = await db.transaction("rw", db.focus, async () => {
      const rows = (await db.focus.bulkGet(ids)).filter(
        (row): row is NonNullable<typeof row> => !!row
      );
      await db.focus.bulkDelete(ids);
      return rows;
    });

    const idSet = new Set(ids);
    set((state) => ({
      focusSessions: state.focusSessions.filter(
        (session) => !idSet.has(session.id!)
      ),
    }));
    return removed;
  },

  /**
   * Bulk Update Session Tag
   *
   * Re-tags multiple focus sessions at once, persisting each change
   * to the database before updating local state.
   *
   * @async
   * @param {number[]} ids - Identifiers of the sessions to re-tag
   * @param {string} tag - New tag to apply to every session
   * @returns {Promise<void>} Resolves when all sessions are updated
   */
  bulkUpdateTag: async (ids: number[], tag: string) => {
    // One transaction: every session is re-tagged, or none is
    const previous = await db.transaction("rw", db.focus, async () => {
      const before = new Map<number, string>();
      for (const row of await db.focus.bulkGet(ids)) {
        if (row?.id !== undefined) before.set(row.id, row.tag);
      }
      await Promise.all(ids.map((id) => db.focus.update(id, { tag })));
      return before;
    });

    const idSet = new Set(ids);
    set((state) => ({
      focusSessions: state.focusSessions.map((session) =>
        idSet.has(session.id!) ? { ...session, tag } : session
      ),
    }));
    return previous;
  },

  /**
   * Restore Focus Sessions
   *
   * Writes removed sessions back with their original ids and sync uids, so
   * an undo is indistinguishable from the delete never having happened.
   *
   * @async
   * @param {FocusSession[]} sessions - Rows returned by a remove call
   */
  restoreFocusSessions: async (sessions: FocusSession[]) => {
    if (sessions.length === 0) return;
    await db.focus.bulkPut(sessions);

    const restoredIds = new Set(sessions.map((s) => s.id));
    set((state) => ({
      focusSessions: [
        ...state.focusSessions.filter((s) => !restoredIds.has(s.id)),
        ...sessions,
      ].sort(byStartDesc),
    }));
  },

  /**
   * Restore Tags
   *
   * Undoes a bulk re-tag by giving each session its previous tag back.
   *
   * @async
   * @param {Map<number, string>} previous - Previous tag per session id
   */
  restoreTags: async (previous: Map<number, string>) => {
    await db.transaction("rw", db.focus, async () => {
      await Promise.all(
        Array.from(previous, ([id, tag]) => db.focus.update(id, { tag }))
      );
    });

    set((state) => ({
      focusSessions: state.focusSessions.map((session) =>
        session.id !== undefined && previous.has(session.id)
          ? { ...session, tag: previous.get(session.id)! }
          : session
      ),
    }));
  },
}));
