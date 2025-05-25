import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";

interface SavedTag {
  t: string; // tag name
  c: string; // color
}

interface TagState {
  tag: string;
  setTag: (tag: string) => void;
  removeTag: () => void;
  savedTags: SavedTag[];
  addSavedTag: (tag: string, color: string) => void;
  removeSavedTag: (tag: string) => void;
  clearSavedTags: () => void;
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
    (set, get) => ({
      tag: "",
      setTag: (tag: string) => set({ tag }),
      removeTag: () => set({ tag: "" }),
      savedTags: [],
      addSavedTag: (tag: string, color: string) => {
        const savedTags = get().savedTags;
        // Prevent duplicates by tag name
        if (!savedTags.some((t) => t.t === tag)) {
          set({ savedTags: [...savedTags, { t: tag, c: color }] });
        }
      },
      removeSavedTag: (tag: string) => {
        set({ savedTags: get().savedTags.filter((t) => t.t !== tag) });
      },
      clearSavedTags: () => set({ savedTags: [] }),
    }),
    {
      name: "tag-storage",
      storage: storage,
    }
  )
);
