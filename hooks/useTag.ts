import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";

interface TagState {
  tag: string;
  setTag: (tag: string) => void;
  removeTag: () => void; // Add removeTag function
}

const storage: PersistStorage<TagState> = {
  getItem: (key) => {
    const value = localStorage.getItem(key);
    if (value) {
      return JSON.parse(value);
    }
    return null;
  },
  setItem: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
};

export const useTag = create<TagState>()(
  persist(
    (set) => ({
      tag: "",
      setTag: (tag: string) => set({ tag }),
      removeTag: () => set({ tag: "" }), // Reset tag to an empty string
    }),
    {
      name: "tag-storage",
      storage: storage,
    }
  )
);
