/**
 * App Preferences Store
 *
 * Small opt-in behaviours that are not tied to a profile: whether the timer
 * keeps running across a reload, whether phase changes raise a system
 * notification, whether Pomodoro phases start on their own, which sound
 * each phase ending plays and how loud, and whether the app downloads a
 * daily backup.
 *
 * Persisted to localStorage (`app-preferences`) through zustand's persist
 * middleware, the same way {@link useFocusGoal} is, so it rides along with
 * backups and sync like every other synced preference.
 *
 * @fileoverview Toggleable timer, notification and backup preferences
 * @author BIT Focus Development Team
 * @since v0.23.0-beta
 */

import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";
import type { SoundPreset } from "@/lib/sound";

export interface Preferences {
  /** Keep a running timer running through a reload or a closed tab */
  resumeTimerOnReload: boolean;
  /** Show a system notification when a Pomodoro phase ends */
  phaseNotifications: boolean;
  /** Start the break on its own when a focus block ends */
  autoStartBreaks: boolean;
  /** Start the next focus block on its own when a break ends */
  autoStartFocus: boolean;
  /** Download a backup file once every 24 hours */
  autoBackup: boolean;
  /** Sound played when a focus block ends and the break starts */
  focusEndSound: SoundPreset;
  /** Sound played when a break ends and focus starts */
  breakEndSound: SoundPreset;
  /** Phase sound volume, 0–100 */
  soundVolume: number;
  /** Fade phase sounds in rather than starting at full volume */
  gentleSound: boolean;
}

export type PreferenceKey = keyof Preferences;

interface PreferencesState extends Preferences {
  /** Set a single preference */
  setPreference: <K extends PreferenceKey>(key: K, value: Preferences[K]) => void;
}

export const DEFAULT_PREFERENCES: Preferences = {
  resumeTimerOnReload: false,
  phaseNotifications: false,
  autoStartBreaks: false,
  autoStartFocus: false,
  autoBackup: false,
  focusEndSound: "chime",
  breakEndSound: "chime",
  soundVolume: 100,
  gentleSound: false,
};

const storage: PersistStorage<PreferencesState> = {
  getItem: (key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  setItem: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      setPreference: (key, value) => set({ [key]: value }),
    }),
    {
      name: "app-preferences",
      storage,
    }
  )
);
