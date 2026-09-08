/**
 * Focus Goal Store
 *
 * A session-length target for the standard timer, in minutes. Pomodoro has its
 * own durations, so the goal only applies to standard mode.
 *
 * The goal is a target, not a limit: once the timer passes it the session keeps
 * running and the ring reports overflow instead of stopping.
 *
 * Persisted in localStorage so the target survives reloads, like the timer state
 * and tags it sits beside.
 */

import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";

/** Goal presets offered in the picker, in minutes. */
export const GOAL_PRESETS = [25, 45, 60, 90, 120] as const;

/** Shortest and longest goal a person can set, in minutes. */
export const GOAL_MIN_MINUTES = 1;
export const GOAL_MAX_MINUTES = 600;

interface FocusGoalState {
  /** Target session length in minutes, or null when no goal is set. */
  goalMinutes: number | null;
  /** Set the goal. Values outside the allowed range are ignored. */
  setGoal: (minutes: number) => void;
  /** Remove the goal; the ring falls back to its hourly sweep. */
  clearGoal: () => void;
}

const storage: PersistStorage<FocusGoalState> = {
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

export const useFocusGoal = create<FocusGoalState>()(
  persist(
    (set) => ({
      goalMinutes: null,
      setGoal: (minutes: number) => {
        if (!Number.isFinite(minutes)) return;
        const rounded = Math.round(minutes);
        if (rounded < GOAL_MIN_MINUTES || rounded > GOAL_MAX_MINUTES) return;
        set({ goalMinutes: rounded });
      },
      clearGoal: () => set({ goalMinutes: null }),
    }),
    {
      name: "focus-goal",
      storage,
    }
  )
);
