import { create } from "zustand";
import db from "@/lib/db";
import type { TimeBlock } from "@/lib/db";

export type { TimeBlock };

interface TimeblocksState {
  timeblocks: TimeBlock[];
  loadingTimeblocks: boolean;
  addTimeblock: (tag: string, startTime: Date, endTime: Date, title?: string) => Promise<void>;
  loadTimeblocks: () => Promise<void>;
  removeTimeblock: (id: number) => Promise<void>;
  editTimeblock: (id: number, updates: Partial<TimeBlock>) => Promise<void>;
}

export const useTimeblocks = create<TimeblocksState>((set) => ({
  timeblocks: [],
  loadingTimeblocks: true,

  addTimeblock: async (tag, startTime, endTime, title) => {
    const id = await db.timeblocks.add({ tag, startTime, endTime, title });
    set((state) => ({
      timeblocks: [{ id, tag, startTime, endTime, title }, ...state.timeblocks],
    }));
  },

  loadTimeblocks: async () => {
    set({ loadingTimeblocks: true });
    try {
      const blocks = await db.timeblocks.toArray();
      set({ timeblocks: blocks.reverse() });
    } catch (err) {
      console.error("Failed to load timeblocks:", err);
    } finally {
      set({ loadingTimeblocks: false });
    }
  },

  removeTimeblock: async (id) => {
    await db.timeblocks.delete(id);
    set((state) => ({
      timeblocks: state.timeblocks.filter((b) => b.id !== id),
    }));
  },

  editTimeblock: async (id, updates) => {
    await db.timeblocks.update(id, updates);
    set((state) => ({
      timeblocks: state.timeblocks.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    }));
  },
}));
