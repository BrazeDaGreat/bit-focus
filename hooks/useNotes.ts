import { create } from "zustand";
import db from "@/lib/db";

export interface Note {
  id?: number;
  title: string;
  type: "document" | "board";
  content: string;
  parentId?: number | null;
  boardData?: { category: string; children: number[] }[];
  createdAt: Date;
  updatedAt: Date;
}

interface NotesState {
  notes: Note[];
  loadNotes: () => Promise<void>;
  addNote: (
    note: Omit<Note, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  updateNote: (id: number, updatedFields: Partial<Note>) => Promise<void>;
  getNoteById: (id: number) => Note | undefined;
  getChildNotes: (parentId?: number | null) => Note[];
}

export const useNotes = create<NotesState>((set, get) => ({
  notes: [],

  loadNotes: async () => {
    const notes = await db.notes.toArray();
    set({
      notes: notes.map((note) => ({
        ...note,
        content: note.content ?? "", // Ensure content is always a string
      })),
    });
  },

  addNote: async (note) => {
    const newNote = {
      ...note,
      content: note.content ?? "", // Default content
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const id = await db.notes.add(newNote);
    set((state) => ({ notes: [{ id, ...newNote }, ...state.notes] }));
  },

  updateNote: async (id, updatedFields) => {
    await db.notes.update(id, { ...updatedFields, updatedAt: new Date() });
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...updatedFields, updatedAt: new Date() } : n
      ),
    }));
  },

  getNoteById: (id) => {
    return get().notes.find((note) => note.id === id);
  },

  getChildNotes: (parentId = null) => {
    return get().notes.filter((note) => note.parentId === parentId);
  },
}));
