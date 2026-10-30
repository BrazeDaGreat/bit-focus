export const TASK_NOTES_DRAFT_PREFIX = "bitfocus.notes.taskBodyDraft.";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface TaskNotesSnapshot {
  content: string;
  status: "saved" | "pending" | "saving" | "error";
  draftStored: boolean;
  readOnly: boolean;
}

// Editors can unmount and remount while IndexedDB is still writing. Keep the
// queue outside React so every mounted generation of a task shares write order.
const saves = new Map<string, Promise<void>>();
function serializeSave(identity: string, save: () => Promise<void>) {
  const previous = saves.get(identity) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(save);
  const settled = next.catch(() => {});
  saves.set(identity, settled);
  void settled.then(() => { if (saves.get(identity) === settled) saves.delete(identity); });
  return next;
}

function browserStorage(): DraftStorage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

/** One editor session. Content stays pending until its exact revision commits. */
export function createTaskNotesDraft(options: {
  identity: string;
  uid?: string;
  content: string;
  readOnly?: boolean;
  save: (content: string) => Promise<void>;
  canSave?: () => boolean;
  storage?: DraftStorage;
}) {
  const storage = options.storage ?? browserStorage();
  const key = options.uid ? `${TASK_NOTES_DRAFT_PREFIX}${options.uid}` : undefined;
  const listeners = new Set<() => void>();
  let saved = options.content;
  let pending: string | null = null;
  let revision = 0;
  let queuedRevision: number | null = null;
  let writing = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSave = Promise.resolve();
  let snapshot: TaskNotesSnapshot = {
    content: saved, status: "saved", draftStored: false, readOnly: !!options.readOnly,
  };
  const serverSnapshot = snapshot;

  function publish(update: Partial<TaskNotesSnapshot>) {
    snapshot = { ...snapshot, ...update };
    listeners.forEach((listener) => listener());
  }
  function readDraft() {
    try { return key ? storage?.getItem(key) ?? null : null; } catch { return null; }
  }
  function journal(content: string) {
    try {
      if (!key || !storage) return false;
      storage.setItem(key, content);
      return true;
    } catch { return false; }
  }
  function clearDraft(content: string) {
    try {
      // A late save must never clear a newer mounted editor's journal.
      if (key && storage?.getItem(key) === content) storage.removeItem(key);
    } catch { /* A retained journal can safely be replayed next time. */ }
  }
  function recover() {
    const draft = readDraft();
    if (draft === null) return;
    pending = draft;
    revision++;
    publish({ content: draft, status: "pending", draftStored: true });
  }
  if (!snapshot.readOnly) recover();

  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function writable() { return !snapshot.readOnly && (options.canSave?.() ?? true); }

  function flush(): Promise<void> {
    cancelTimer();
    if (!writable() || pending === null || queuedRevision === revision) return lastSave;
    const content = pending;
    const savingRevision = revision;
    queuedRevision = revision;
    writing++;
    publish({ status: "saving" });
    lastSave = serializeSave(options.identity, async () => {
      // Trash/read-only can change while this request waits behind an old save.
      if (!writable()) {
        if (queuedRevision === savingRevision) queuedRevision = null;
        return;
      }
      await options.save(content);
      saved = content;
      clearDraft(content);
      if (revision === savingRevision) {
        pending = null;
        publish({ status: "saved", draftStored: false });
      }
    }).catch(() => {
      if (queuedRevision === savingRevision) queuedRevision = null;
      // Never replace new keystrokes with the failed request's content.
      if (pending !== null) publish({ status: "error" });
    }).finally(() => {
      writing--;
      if (!writing && pending !== null && snapshot.status === "saving") publish({ status: "pending" });
    });
    return lastSave;
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    edit(content: string) {
      if (!writable()) return;
      pending = content;
      revision++;
      publish({ content, status: "pending", draftStored: journal(content) });
      cancelTimer();
      timer = setTimeout(() => { void flush(); }, 800);
    },
    flush,
    setReadOnly(readOnly: boolean) {
      if (snapshot.readOnly === readOnly) return;
      cancelTimer();
      publish({ readOnly });
      if (!readOnly) {
        if (pending === null) recover();
        void flush();
      }
    },
    refresh(content: string) {
      if (pending !== null || writing || content === saved) return;
      saved = content;
      publish({ content, status: "saved" });
    },
  };
}
