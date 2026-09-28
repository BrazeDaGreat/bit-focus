/**
 * Pomodoro Outcome Log
 *
 * Records how each Pomodoro focus block ended — run to the end, or stopped
 * early — so the Home page can show a completion rate. Focus sessions
 * themselves carry no such flag, and a stopped block may be split into
 * several sessions, so the outcome is kept here, one entry per block.
 *
 * Persisted to localStorage (`pomodoro-log`) and synced like other
 * preferences. Entries older than {@link LOG_RETENTION_DAYS} are dropped.
 *
 * @fileoverview Completed vs stopped Pomodoro blocks
 * @author BIT Focus Development Team
 * @since v0.23.0
 */

import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";

export const LOG_RETENTION_DAYS = 90;

export interface PomodoroOutcome {
  /** When the block ended (ms) */
  at: number;
  /** True when the block ran its full length */
  completed: boolean;
  /** Focused seconds in the block */
  seconds: number;
}

interface PomodoroLogState {
  entries: PomodoroOutcome[];
  /** Record how a focus block ended */
  record: (outcome: PomodoroOutcome) => void;
}

const storage: PersistStorage<PomodoroLogState> = {
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

export const usePomodoroLog = create<PomodoroLogState>()(
  persist(
    (set) => ({
      entries: [],
      record: (outcome) =>
        set((state) => {
          const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
          return {
            entries: [...state.entries.filter((e) => e.at >= cutoff), outcome],
          };
        }),
    }),
    {
      name: "pomodoro-log",
      storage,
      partialize: (state) => ({ entries: state.entries }) as PomodoroLogState,
    }
  )
);
