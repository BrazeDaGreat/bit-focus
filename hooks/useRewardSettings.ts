/**
 * Rewards Settings Store
 *
 * Earn rates (overall and per tag), shop categories, the debt cap, loan
 * defaults and webhook switches. Kept in browser storage under
 * `reward-settings`, which syncs between devices and goes into backups like
 * other preferences.
 *
 * @fileoverview Persisted rewards preferences
 * @author BIT Focus Development Team
 * @since v0.25.0-beta
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_REWARD_SETTINGS, type RewardSettings } from "@/lib/rewards";

/** Highest earn rate accepted, in gems per hour. */
export const MAX_RATE = 100;

interface RewardSettingsState extends RewardSettings {
  /** Change some settings. Numbers are clamped to sensible ranges. */
  update: (changes: Partial<RewardSettings>) => void;
  /** Give a tag its own rate, or pass null to use the overall rate again. */
  setTagRate: (tag: string, rate: number | null) => void;
  /** Move a tag's rate up or down, starting from the overall rate. */
  nudgeTagRate: (tag: string, delta: number) => void;
  /** Add a category at the end. Ignores blanks and duplicates. */
  addCategory: (name: string) => boolean;
  /** Move a category to a new position. */
  moveCategory: (from: number, to: number) => void;
  /**
   * Rename a category in the list only. Use `useRewards.renameCategory`,
   * which also moves the items in it.
   */
  replaceCategory: (from: string, to: string) => void;
  /** Remove a category from the list only (see `useRewards.deleteCategory`). */
  removeCategory: (name: string) => void;
}

/** Rates are kept to two decimals and within 0–MAX_RATE. */
function cleanRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.round(Math.min(MAX_RATE, Math.max(0, rate)) * 100) / 100;
}

function cleanPercent(value: number): number {
  return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : 0;
}

function cleanAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export const useRewardSettings = create<RewardSettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_REWARD_SETTINGS,

      update: (changes) => {
        const next: Partial<RewardSettings> = { ...changes };
        if (next.rate !== undefined) next.rate = cleanRate(next.rate);
        if (next.debtCap !== undefined) next.debtCap = cleanAmount(next.debtCap);
        if (next.webhookEarnMin !== undefined) next.webhookEarnMin = cleanAmount(next.webhookEarnMin);
        if (next.loanInterestPercent !== undefined) next.loanInterestPercent = cleanPercent(next.loanInterestPercent);
        if (next.loanRepayPercent !== undefined) next.loanRepayPercent = cleanPercent(next.loanRepayPercent);
        set(next);
      },

      setTagRate: (tag, rate) => {
        const tagRates = { ...get().tagRates };
        if (rate === null) delete tagRates[tag];
        else tagRates[tag] = cleanRate(rate);
        set({ tagRates });
      },

      nudgeTagRate: (tag, delta) => {
        const { tagRates, rate } = get();
        get().setTagRate(tag, (tagRates[tag] ?? rate) + delta);
      },

      addCategory: (name) => {
        const trimmed = name.trim();
        const { categories } = get();
        if (!trimmed || categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return false;
        set({ categories: [...categories, trimmed] });
        return true;
      },

      moveCategory: (from, to) => {
        const categories = [...get().categories];
        if (from < 0 || from >= categories.length || to < 0 || to >= categories.length) return;
        const [moved] = categories.splice(from, 1);
        categories.splice(to, 0, moved);
        set({ categories });
      },

      replaceCategory: (from, to) => {
        set({ categories: get().categories.map((c) => (c === from ? to : c)) });
      },

      removeCategory: (name) => {
        set({ categories: get().categories.filter((c) => c !== name) });
      },
    }),
    {
      name: "reward-settings",
      version: 1,
      partialize: (state) => {
        const settings: Partial<RewardSettingsState> = {};
        for (const key of Object.keys(DEFAULT_REWARD_SETTINGS) as (keyof RewardSettings)[]) {
          (settings as Record<string, unknown>)[key] = state[key];
        }
        return settings as RewardSettings;
      },
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch {}
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch {}
        },
      })),
    },
  ),
);

/** Current settings without the actions, for pure helpers. */
export function rewardSettings(): RewardSettings {
  const state = useRewardSettings.getState();
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_REWARD_SETTINGS)) out[key] = state[key as keyof RewardSettings];
  return out as unknown as RewardSettings;
}
