import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface TaskPreferences {
  capacityMinutes: number;
  setCapacity: (minutes: number) => void;
}
export const useTaskPreferences = create<TaskPreferences>()(
  persist(
    (set) => ({
      capacityMinutes: 480,
      setCapacity: (minutes) =>
        set({ capacityMinutes: Math.max(0, Math.min(1440, minutes)) }),
    }),
    {
      name: "task-preferences",
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
