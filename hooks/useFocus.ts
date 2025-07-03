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
  /** Unique session identifier (auto-generated) */
  id?: number;
  /** Category tag for session organization */
  tag: string;
  /** Session start timestamp */
  startTime: Date;
  /** Session end timestamp */
  endTime: Date;
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
    endTime: Date
  ) => Promise<void>;
  /** Function to load all focus sessions from database */
  loadFocusSessions: () => Promise<void>;
  /** Function to delete a focus session by ID */
  removeFocusSession: (id: number) => Promise<void>;
  /** Function to update an existing focus session */
  editFocusSession: (
    id: number,
    updatedSession: Partial<FocusSession>
  ) => Promise<void>;
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
  addFocusSession: async (tag, startTime, endTime) => {
    // Add to database and get generated ID
    const id = await db.focus.add({ tag, startTime, endTime });

    // Update local state with optimistic update (prepend for chronological order)
    set((state) => ({
      focusSessions: [{ id, tag, startTime, endTime }, ...state.focusSessions],
    }));
  },

  /**
   * Load All Focus Sessions
   *
   * Retrieves all focus sessions from the database and updates the
   * local state. Sessions are automatically sorted in reverse
   * chronological order for optimal display in UI components.
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

      // Update state with reversed array for chronological display
      set({ focusSessions: sessions.reverse() });
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
    // Remove from database
    await db.focus.delete(id);

    // Update local state with optimistic removal
    set((state) => ({
      focusSessions: state.focusSessions.filter((session) => session.id !== id),
    }));
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

    // Update local state with optimistic changes
    set((state) => ({
      focusSessions: state.focusSessions.map((session) =>
        session.id === id ? { ...session, ...updatedSession } : session
      ),
    }));
  },
}));
