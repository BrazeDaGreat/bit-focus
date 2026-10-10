/**
 * Notes store keeps all pages, including Trash, in memory with real dates.
 * Edits appear immediately; multi-page changes commit atomically in Dexie.
 */
import { create } from "zustand";
import db from "@/lib/db";
import { deleteAssetsForNotes } from "@/lib/note-assets";
import { installTracking } from "@/lib/sync/tracker";
import { childrenOf, descendantIds, isTrashed, orderBetween, type Note } from "@/lib/notes";

export type { Note } from "@/lib/notes";

export interface NotesState {
  notes: Note[];
  loaded: boolean;
  loadNotes(): Promise<void>;
  createNote(input?: { parentId?: number | null; title?: string; icon?: string; afterId?: number }): Promise<Note>;
  updateNote(id: number, fields: Partial<Pick<Note, "title" | "icon">>): Promise<void>;
  saveContent(id: number, content: string): Promise<void>;
  moveNote(id: number, target: { parentId: number | null; index: number }): Promise<void>;
  trashNote(id: number): Promise<void>;
  restoreNote(id: number): Promise<void>;
  deleteNoteForever(id: number): Promise<void>;
  emptyTrash(): Promise<void>;
  getByUid(uid: string): Note | undefined;
}

/** Repair legacy or exhausted keys only when an ordering operation needs them. */
function insertionOrder(siblings: Note[], index: number, changed: Map<number, Note>, now: Date): number {
  let ordered = siblings;
  if (siblings.some((note, i) => !Number.isFinite(note.order) ||
      (i > 0 && note.order! <= siblings[i - 1].order!))) {
    ordered = siblings.map((note, i) => {
      const next = { ...note, order: (i + 1) * 1024, updatedAt: now };
      if (note.id != null) changed.set(note.id, next);
      return next;
    });
  }
  const before = ordered[index - 1]?.order;
  const after = ordered[index]?.order;
  const order = orderBetween(before, after);
  if (!Number.isFinite(order) || (before != null && order <= before) || (after != null && order >= after)) {
    const spaced = siblings.map((note, i) => {
      const next = { ...note, order: (i + 1) * 1024, updatedAt: now };
      if (note.id != null) changed.set(note.id, next);
      return next;
    });
    return orderBetween(spaced[index - 1]?.order, spaced[index]?.order);
  }
  return order;
}

export const useNotes = create<NotesState>((set, get) => {
  let loading: Promise<void> | undefined;
  let revision = 0;
  const pending = new Set<Promise<unknown>>();
  const track = <T,>(write: Promise<T>): Promise<T> => {
    pending.add(write);
    const done = () => { pending.delete(write); revision++; };
    void write.then(done, done);
    return write;
  };
  const ensureLoaded = async () => { if (!get().loaded) await get().loadNotes(); };
  const optimistic = (changed: Map<number, Note>) => {
    const before = new Map(get().notes.filter((note) => note.id != null && changed.has(note.id)).map((note) => [note.id!, note]));
    revision++;
    set((state) => ({ notes: state.notes.map((note) => changed.get(note.id!) ?? note) }));
    return () => {
      revision++;
      set((state) => ({ notes: state.notes.map((note) =>
        note === changed.get(note.id!) ? before.get(note.id!) ?? note : note) }));
    };
  };
  const writeChanges = async (changed: Map<number, Note>) => {
    if (!changed.size) return;
    const before = new Map(get().notes.map((note) => [note.id, note]));
    const rollback = optimistic(changed);
    try {
      await track(db.transaction("rw", db.notes, async () => {
        for (const [id, note] of changed) {
          // Structural edits never rewrite an unchanged body from a stale snapshot.
          const fields = Object.fromEntries(Object.entries(note).filter(([key, value]) =>
            key !== "id" && value !== before.get(id)?.[key as keyof Note])) as Partial<Note>;
          await db.notes.update(id, fields);
        }
      }));
    } catch (error) { rollback(); throw error; }
  };
  const edit = async (id: number, fields: Partial<Note>) => {
    const before = get().notes.find((note) => note.id === id);
    if (!before) return;
    const changes = { ...fields, updatedAt: new Date() };
    const rollback = optimistic(new Map([[id, { ...before, ...changes }]]));
    try { await track(db.notes.update(id, changes)); }
    catch (error) { rollback(); throw error; }
  };
  const remove = async (ids: Set<number>) => {
    const removed = get().notes.filter((note) => ids.has(note.id!));
    const previous = get().notes;
    revision++;
    set((state) => ({ notes: state.notes.filter((note) => !ids.has(note.id!)) }));
    try {
      await track(db.transaction("rw", [db.notes, db.noteAssets], async () => {
        await deleteAssetsForNotes(removed.flatMap((note) => note.uid ? [note.uid] : []));
        await db.notes.bulkDelete([...ids]);
      }));
    } catch (error) {
      revision++;
      set((state) => {
        const current = new Map(state.notes.map((note) => [note.uid, note]));
        const oldUids = new Set(previous.map((note) => note.uid));
        return { notes: [
          ...previous.flatMap((note) => current.has(note.uid) ? [current.get(note.uid)!] : ids.has(note.id!) ? [note] : []),
          ...state.notes.filter((note) => !oldUids.has(note.uid)),
        ] };
      });
      throw error;
    }
  };

  return {
    notes: [], loaded: false,
    loadNotes: () => {
      // Track offline edits before an account attaches, including asset tombstones.
      installTracking();
      if (loading) return loading;
      loading = (async () => {
        // Sync refresh and palette opening can overlap an editor autosave.
        for (;;) {
          if (pending.size) await Promise.allSettled([...pending]);
          const readingRevision = revision;
          const rows = await db.notes.toArray();
          if (pending.size || readingRevision !== revision) continue;
          const notes = rows.map((note) => ({
            ...note,
            title: note.title ?? "",
            parentId: note.parentId ?? null,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt),
            deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
          }));
          set({ notes, loaded: true });
          return;
        }
      })().finally(() => { loading = undefined; });
      return loading;
    },
    createNote: async (input = {}) => {
      await ensureLoaded();
      const parentId = input.parentId ?? null;
      if (parentId != null && !get().notes.some((note) => note.id === parentId && !isTrashed(note)))
        throw new Error("Parent page not found");
      const siblings = childrenOf(get().notes, parentId);
      const after = input.afterId == null ? -1 : siblings.findIndex((note) => note.id === input.afterId);
      const index = after < 0 ? siblings.length : after + 1;
      const now = new Date();
      const changed = new Map<number, Note>();
      const note: Note = {
        uid: crypto.randomUUID(), title: input.title ?? "", icon: input.icon,
        type: "document", parentId, content: "", deletedAt: null,
        order: insertionOrder(siblings, index, changed, now), createdAt: now, updatedAt: now,
      };
      const rollback = optimistic(changed);
      set((state) => ({ notes: [...state.notes, note] }));
      try {
        const id = await track(db.transaction("rw", db.notes, async () => {
          for (const [id, sibling] of changed) await db.notes.update(id, { order: sibling.order, updatedAt: now });
          return db.notes.add(note);
        }));
        const saved = { ...note, id };
        set((state) => ({ notes: state.notes.map((row) => row.uid === note.uid ? { ...row, id } : row) }));
        return saved;
      } catch (error) {
        rollback();
        set((state) => ({ notes: state.notes.filter((row) => row.uid !== note.uid) }));
        throw error;
      }
    },
    updateNote: async (id, fields) => {
      await ensureLoaded();
      await edit(id, fields);
    },
    // Autosave touches one row, keeping its position and every other row reference.
    saveContent: async (id, content) => edit(id, { content }),
    moveNote: async (id, target) => {
      await ensureLoaded();
      const notes = get().notes;
      const note = notes.find((row) => row.id === id);
      if (!note || isTrashed(note)) return;
      if (target.parentId === id || descendantIds(notes, id).includes(target.parentId!))
        throw new Error("A page cannot be moved into itself or a descendant");
      if (target.parentId != null && !notes.some((row) => row.id === target.parentId && !isTrashed(row)))
        throw new Error("Parent page not found");
      const siblings = childrenOf(notes, target.parentId).filter((row) => row.id !== id);
      const index = Math.max(0, Math.min(siblings.length, Number.isFinite(target.index) ? Math.trunc(target.index) : siblings.length));
      const now = new Date();
      const changed = new Map<number, Note>();
      const order = insertionOrder(siblings, index, changed, now);
      changed.set(id, { ...note, parentId: target.parentId, order, updatedAt: now });
      await writeChanges(changed);
    },
    trashNote: async (id) => {
      await ensureLoaded();
      const notes = get().notes;
      const note = notes.find((row) => row.id === id);
      if (!note || isTrashed(note)) return;
      const ids = new Set([id, ...descendantIds(notes, id)]);
      const now = new Date();
      // Keep separately trashed descendants' stamps so restore does not revive them.
      await writeChanges(new Map(notes.filter((row) => ids.has(row.id!) && !isTrashed(row))
        .map((row) => [row.id!, { ...row, deletedAt: now, updatedAt: now }])));
    },
    restoreNote: async (id) => {
      await ensureLoaded();
      const notes = get().notes;
      const note = notes.find((row) => row.id === id);
      if (!note || !isTrashed(note)) return;
      const stamp = note.deletedAt!.getTime();
      const ids = new Set([id, ...descendantIds(notes, id)]);
      const now = new Date();
      const changed = new Map<number, Note>(notes.filter((row) => ids.has(row.id!) && row.deletedAt?.getTime() === stamp)
        .map((row) => [row.id!, { ...row, deletedAt: null, updatedAt: now }]));
      // Any restored branch whose parent remains unavailable surfaces at the root.
      for (const [rowId, restored] of [...changed]) {
        if (restored.parentId == null) continue;
        const parent = changed.get(restored.parentId) ?? notes.find((row) => row.id === restored.parentId);
        if (!parent || isTrashed(parent)) {
          const staged = notes.map((row) => changed.get(row.id!) ?? row);
          const siblings = childrenOf(staged, null).filter((row) => row.id !== rowId);
          restored.order = insertionOrder(siblings, siblings.length, changed, now);
          restored.parentId = null;
        }
      }
      await writeChanges(changed);
    },
    deleteNoteForever: async (id) => {
      await ensureLoaded();
      await remove(new Set([id, ...descendantIds(get().notes, id)]));
    },
    emptyTrash: async () => {
      await ensureLoaded();
      await remove(new Set(get().notes.filter(isTrashed).map((note) => note.id!)));
    },
    getByUid: (uid) => get().notes.find((note) => note.uid === uid),
  };
});
