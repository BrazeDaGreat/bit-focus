/**
 * This file defines the tags store, which is used to store the current tag
 * being used and an array of saved tags. The store is persisted using local
 * storage.
 */

import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";

// Interface for a saved tag
export interface SavedTag {
  t: string; // Tag name
  c: string; // Color
}

// State interface defining the tags store
interface TagState {
  tag: string; // Current tag being used
  setTag: (tag: string) => void; // Function to set the current tag
  removeTag: () => void; // Function to clear the current tag
  savedTags: SavedTag[]; // Array of saved tags
  addSavedTag: (tag: string, color: string) => void; // Function to add a new tag and its color
  removeSavedTag: (tag: string) => void; // Function to remove a tag from the list
  clearSavedTags: () => void; // Function to clear all saved tags
}

// Define a storage instance that uses local storage for persistence
const storage: PersistStorage<TagState> = {
  // Retrieve item from local storage
  getItem: (key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  // Store item in local storage
  setItem: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  // Remove item from local storage
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
};

// Use the create function from zustand to define the store
export const useTag = create<TagState>()(
  persist(
    // Persist the store with the given options
    (set, get) => ({
      tag: "", // The current tag that is being used.
      setTag: (tag: string) => set({ tag }), // Function to set the current tag
      removeTag: () => set({ tag: "" }), // Function to clear the current tag
      savedTags: [], // Array of saved tags
      addSavedTag: (tag: string, color: string) => {
        const savedTags = get().savedTags; // Get the list of saved tags
        // Prevent duplicates by tag name.
        if (!savedTags.some((t) => t.t === tag)) {
          set({ savedTags: [...savedTags, { t: tag, c: color }] });
        }
      },
      removeSavedTag: (tag: string) => {
        set({ savedTags: get().savedTags.filter((t) => t.t !== tag) }); // Update the list of saved tags.
      },
      clearSavedTags: () => set({ savedTags: [] }), // Function to clear all saved tags
    }),
    {
      name: "tag-storage", // Name for the store's persistence
      storage: storage, // The persisting storage instance
    }
  )
);
