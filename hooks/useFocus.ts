import { create } from "zustand";
import db from "@/lib/db";

// Define Zustand store
interface FocusSession {
  id?: number;
  tag: string;
  startTime: Date;
  endTime: Date;
}

interface FocusState {
  focusSessions: FocusSession[];
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date
  ) => Promise<void>;
  loadFocusSessions: () => Promise<void>;
}

export const useFocus = create<FocusState>((set) => ({
  focusSessions: [],

  addFocusSession: async (tag, startTime, endTime) => {
    const id = await db.focus.add({ tag, startTime, endTime });
    set((state) => ({
      focusSessions: [...state.focusSessions, { id, tag, startTime, endTime }],
    }));
  },

  loadFocusSessions: async () => {
    const sessions = await db.focus.toArray();
    set({ focusSessions: sessions });
  },
}));
