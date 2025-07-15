/**
 * User Configuration Hook - Settings and Preferences Management
 *
 * This Zustand-based hook manages user configuration data including personal
 * information, application preferences, and external service integrations.
 * It provides a centralized store for user settings with persistent storage
 * via IndexedDB and real-time updates across the application.
 *
 * Features:
 * - Persistent user configuration storage
 * - Automatic data loading and synchronization
 * - Type-safe configuration management
 * - Loading state handling for UI feedback
 * - Database integration with error handling
 * - Single source of truth for user preferences
 *
 * Configuration Data:
 * - User name and personal information
 * - Date of birth for age calculations
 * - Discord webhook URL for notifications
 * - Future extensibility for additional settings
 *
 * Storage Architecture:
 * - Uses IndexedDB via Dexie for persistence
 * - Single configuration record per application instance
 * - Automatic overwrite of existing configuration
 * - Zustand for reactive state management
 *
 * Dependencies:
 * - Zustand for state management
 * - Database instance for persistence
 * - TypeScript for type safety
 *
 * @fileoverview User configuration management with persistent storage
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 */

import { create } from "zustand";
import db from "@/lib/db";

/**
 * Configuration State Interface
 *
 * Defines the complete structure of user configuration state including
 * data properties, loading states, and available actions for configuration
 * management throughout the application.
 */
interface ConfigState {
  /** User's display name */
  name: string;
  /** User's date of birth for age calculations */
  dob: Date;
  /** Discord webhook URL for notifications */
  webhook: string;
  /** User's preferred currency */
  currency: string;
  /** Loading state indicator for UI feedback */
  loadingConfig: boolean;
  /** Function to update configuration with new values */
  setConfig: (name: string, dob: Date, webhook: string, currency: string) => Promise<void>;
  /** Function to load configuration from database */
  loadConfig: () => Promise<void>;
}

/**
 * User Configuration Store
 *
 * Creates a Zustand store for managing user configuration data with
 * persistent storage and reactive updates. The store handles both
 * local state management and database operations for configuration
 * persistence across application sessions.
 *
 * The store maintains a single configuration record and automatically
 * overwrites existing configuration when updated. This ensures data
 * consistency and prevents configuration conflicts.
 *
 * @hook
 * @returns {ConfigState} Configuration state and management functions
 *
 * @example
 * ```tsx
 * // Basic configuration usage
 * function UserProfile() {
 *   const { name, dob, webhook, loadingConfig, setConfig, loadConfig } = useConfig();
 *
 *   useEffect(() => {
 *     loadConfig();
 *   }, [loadConfig]);
 *
 *   if (loadingConfig) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>Welcome, {name}</h1>
 *       <p>Age: {calculateAge(dob)} years</p>
 *     </div>
 *   );
 * }
 *
 * // Configuration form
 * function SettingsForm() {
 *   const { setConfig } = useConfig();
 *
 *   const handleSubmit = async (formData) => {
 *     await setConfig(
 *       formData.name,
 *       new Date(formData.birthDate),
 *       formData.webhookUrl
 *     );
 *   };
 *
 *   return <ConfigForm onSubmit={handleSubmit} />;
 * }
 * ```
 *
 * @see {@link db} for database operations
 * @see {@link https://github.com/pmndrs/zustand} for Zustand documentation
 */
export const useConfig = create<ConfigState>((set) => ({
  name: "NULL",
  dob: new Date(),
  webhook: "",
  currency: "USD", // Add this line
  loadingConfig: true,

  /**
   * Set User Configuration
   *
   * Updates the user configuration with new values and persists them
   * to the database. Automatically overwrites any existing configuration
   * to maintain data consistency and prevent duplicate records.
   *
   * The function handles database operations with proper error logging
   * and updates the local state immediately after successful database
   * operations for responsive UI feedback.
   *
   * @async
   * @param {string} name - User's display name
   * @param {Date} dob - User's date of birth
   * @param {string} webhook - Discord webhook URL
   * @param {string} currency - User's preferred currency
   * @returns {Promise<void>} Resolves when configuration is saved
   *
   * @example
   * ```typescript
   * // Update user configuration
   * await setConfig(
   *   "John Doe",
   *   new Date("1990-01-15"),
   *   "https://discord.com/api/webhooks/...",
   *   "USD"
   * );
   * ```
   */
  setConfig: async (name, dob, webhook, currency) => {
    console.log(name, dob, webhook);

    // Remove existing configuration to prevent duplicates
    const existingConfig = await db.configuration.toCollection().first();
    if (existingConfig) {
      await db.configuration.delete(existingConfig.name);
      console.log("Previous entry deleted.");
    }

    // Add new configuration to database
    await db.configuration.add({ name, dob, webhook, currency });
    console.log("Config added successfully.");

    // Update local state
    set({ name, dob, webhook, currency });
  },

  /**
   * Load User Configuration
   *
   * Retrieves user configuration from the database and updates the
   * local state. Handles cases where no configuration exists and
   * provides proper error handling for database operations.
   *
   * Sets loading state during the operation to provide UI feedback
   * and ensures the loading state is cleared regardless of operation
   * success or failure.
   *
   * @async
   * @returns {Promise<void>} Resolves when configuration is loaded
   *
   * @example
   * ```typescript
   * // Load configuration on component mount
   * useEffect(() => {
   *   loadConfig();
   * }, [loadConfig]);
   * ```
   */
  loadConfig: async () => {
    set({ loadingConfig: true });
    try {
      // Fetch first (and only) configuration record
      const config = await db.configuration.toCollection().first();
      if (config) {
        set({
          name: config.name,
          dob: config.dob,
          webhook: config.webhook || "", // Handle optional webhook
          currency: config.currency || "USD", // Handle optional currency
        });
      }
    } catch (error) {
      console.error("Failed to load configuration:", error);
    } finally {
      // Always clear loading state
      set({ loadingConfig: false });
    }
  },
}));
