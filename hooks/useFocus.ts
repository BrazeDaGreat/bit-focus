import { create } from "zustand";
import db from "@/lib/db";

// Define Zustand store
export interface FocusSession {
  id?: number;
  tag: string;
  startTime: Date;
  endTime: Date;
}
interface FocusState {
  focusSessions: FocusSession[];
  loadingFocusSessions: boolean;
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date
  ) => Promise<void>;
  loadFocusSessions: () => Promise<void>;
  removeFocusSession: (id: number) => Promise<void>;
  editFocusSession: (
    id: number,
    updatedSession: Partial<FocusSession>
  ) => Promise<void>;
}

export const useFocus = create<FocusState>((set) => ({
  focusSessions: [],
  loadingFocusSessions: true,

  addFocusSession: async (tag, startTime, endTime) => {
    const id = await db.focus.add({ tag, startTime, endTime });
    set((state) => ({
      focusSessions: [{ id, tag, startTime, endTime }, ...state.focusSessions], // Keep state ordered
    }));
  },

  loadFocusSessions: async () => {
    set({ loadingFocusSessions: true });
    try {
      const sessions = await db.focus.toArray();
      set({ focusSessions: sessions.reverse() });
    } catch (error) {
      console.error("Failed to load focus sessions:", error);
    } finally {
      set({ loadingFocusSessions: false });
    }
  },

  removeFocusSession: async (id: number) => {
    await db.focus.delete(id);
    set((state) => ({
      focusSessions: state.focusSessions.filter((session) => session.id !== id),
    }));
  },

  editFocusSession: async (
    id: number,
    updatedSession: Partial<FocusSession>
  ) => {
    await db.focus.update(id, updatedSession);
    set((state) => ({
      focusSessions: state.focusSessions.map((session) =>
        session.id === id ? { ...session, ...updatedSession } : session
      ),
    }));
  },
}));
