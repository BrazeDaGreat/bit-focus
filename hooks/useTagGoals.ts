/**
 * Tag Goals Store
 *
 * Optional weekly focus targets per tag, in minutes — "10h on #uni this
 * week". A goal is something a person sets for themselves; it is never
 * compared against planned timeblocks, and any focus on the tag counts toward
 * it whether or not it was planned.
 *
 * Weeks run Monday to Sunday, matching the calendar and task grouping.
 *
 * Persisted in localStorage beside the saved tags, so goals follow a person
 * between devices through sync.
 */

import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";
import { startOfWeek, addWeeks } from "date-fns";
import type { FocusSession } from "@/hooks/useFocus";
import { reduceSessions } from "@/lib/utils";

/** Smallest and largest weekly goal, in minutes (one minute to a full week). */
export const TAG_GOAL_MIN_MINUTES = 1;
export const TAG_GOAL_MAX_MINUTES = 7 * 24 * 60;

interface TagGoalState {
  /** Weekly target in minutes, keyed by tag name. */
  goals: Record<string, number>;
  /** Set a tag's goal. Values outside the allowed range are ignored. */
  setGoal: (tag: string, minutes: number) => void;
  /** Remove a tag's goal. */
  removeGoal: (tag: string) => void;
}

const storage: PersistStorage<TagGoalState> = {
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

export const useTagGoals = create<TagGoalState>()(
  persist(
    (set, get) => ({
      goals: {},
      setGoal: (tag: string, minutes: number) => {
        const name = tag.trim();
        if (!name || !Number.isFinite(minutes)) return;
        const rounded = Math.round(minutes);
        if (rounded < TAG_GOAL_MIN_MINUTES || rounded > TAG_GOAL_MAX_MINUTES) return;
        set({ goals: { ...get().goals, [name]: rounded } });
      },
      removeGoal: (tag: string) => {
        const goals = { ...get().goals };
        delete goals[tag.trim()];
        set({ goals });
      },
    }),
    {
      name: "tag-weekly-goals",
      storage,
    }
  )
);

/**
 * Parse a goal typed by hand into minutes.
 *
 * Accepts "10h", "90m", "1h30", "1h 30m", "1.5h" and "1:30". A bare number is
 * read as hours, since weekly goals are almost always whole hours.
 *
 * @returns Minutes, or null when the text is not a duration in range.
 */
export function parseGoalDuration(text: string): number | null {
  const value = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!value) return null;

  let minutes: number | null = null;
  const clock = value.match(/^(\d+):(\d{1,2})$/);
  const units = value.match(/^(?:(\d+(?:\.\d+)?)h(?:rs?|ours?)?)?(?:(\d+(?:\.\d+)?)(?:m(?:ins?|inutes?)?)?)?$/);

  if (/^\d+(?:\.\d+)?$/.test(value)) {
    minutes = parseFloat(value) * 60;
  } else if (clock) {
    minutes = parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);
  } else if (units && (units[1] || units[2])) {
    minutes = (units[1] ? parseFloat(units[1]) * 60 : 0) + (units[2] ? parseFloat(units[2]) : 0);
  }

  if (minutes === null || !Number.isFinite(minutes)) return null;
  const rounded = Math.round(minutes);
  if (rounded < TAG_GOAL_MIN_MINUTES || rounded > TAG_GOAL_MAX_MINUTES) return null;
  return rounded;
}

/** "10h", "1h 30m", "45m" — the form a goal is shown and edited in. */
export function formatGoalMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The current Monday-to-Monday week as a half-open window [start, end). */
export function currentGoalWeek(now: Date = new Date()): { start: Date; end: Date } {
  const start = startOfWeek(now, { weekStartsOn: 1 });
  return { start, end: addWeeks(start, 1) };
}

/**
 * Focus seconds per tag inside a window, counting a session by when it
 * started. Untagged sessions are skipped — a goal always names a tag.
 */
export function weeklyTagSeconds(
  sessions: FocusSession[],
  start: Date,
  end: Date
): Map<string, number> {
  const from = start.getTime();
  const to = end.getTime();
  const totals = new Map<string, number>();
  for (const session of sessions) {
    const at = new Date(session.startTime).getTime();
    if (at < from || at >= to) continue;
    const tag = session.tag?.trim();
    if (!tag) continue;
    totals.set(tag, (totals.get(tag) ?? 0) + reduceSessions([session]));
  }
  return totals;
}
