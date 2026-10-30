import assert from "node:assert/strict";
import { test } from "node:test";
import { createTaskNotesDraft, TASK_NOTES_DRAFT_PREFIX } from "../lib/task-notes-drafts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const key = (uid: string) => `${TASK_NOTES_DRAFT_PREFIX}${uid}`;

test("slow saves serialize revisions and ignore store refreshes while dirty or writing", async () => {
  const storage = memoryStorage();
  const started = deferred();
  const slow = deferred();
  const writes: string[] = [];
  const draft = createTaskNotesDraft({
    identity: "slow", uid: "slow", content: "Original", storage,
    save: async (content) => {
      writes.push(content);
      if (writes.length === 1) { started.resolve(); await slow.promise; }
    },
  });
  draft.edit("First");
  assert.equal(storage.getItem(key("slow")), "First", "journal precedes debounce and IndexedDB");
  const first = draft.flush();
  await started.promise;
  draft.edit("Newest");
  const latest = draft.flush();
  assert.equal(draft.flush(), latest, "blur/pagehide cannot queue duplicate revisions");
  draft.refresh("Stale store value");
  assert.equal(draft.getSnapshot().content, "Newest");
  assert.deepEqual(writes, ["First"]);
  assert.equal(storage.getItem(key("slow")), "Newest");
  slow.resolve();
  await Promise.all([first, latest]);
  assert.deepEqual(writes, ["First", "Newest"]);
  assert.equal(draft.getSnapshot().status, "saved");
  assert.equal(storage.getItem(key("slow")), null);
  draft.refresh("External edit after saving");
  assert.equal(draft.getSnapshot().content, "External edit after saving");
});

test("800ms debounce writes only latest content, including reverting during an older save", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const slow = deferred();
  const started = deferred();
  const writes: string[] = [];
  const draft = createTaskNotesDraft({
    identity: "debounce", uid: "debounce", content: "Original", storage: memoryStorage(),
    save: async (content) => {
      writes.push(content);
      if (writes.length === 1) { started.resolve(); await slow.promise; }
    },
  });
  draft.edit("Intermediate");
  t.mock.timers.tick(799);
  assert.deepEqual(writes, []);
  draft.edit("Changed");
  t.mock.timers.tick(800);
  await started.promise;
  draft.edit("Original");
  const reverted = draft.flush();
  slow.resolve();
  await reverted;
  assert.deepEqual(writes, ["Changed", "Original"], "reverting still writes after the older change");
  assert.equal(draft.getSnapshot().status, "saved");
});

test("failure keeps newer edits and journal; retry commits latest content", async () => {
  const storage = memoryStorage();
  const slow = deferred();
  const started = deferred();
  const writes: string[] = [];
  const draft = createTaskNotesDraft({
    identity: "failure", uid: "failure", content: "Original", storage,
    save: async (content) => {
      writes.push(content);
      if (writes.length === 1) { started.resolve(); await slow.promise; }
    },
  });
  draft.edit("Failing snapshot");
  const failed = draft.flush();
  await started.promise;
  draft.edit("Newer keystrokes");
  slow.reject(new Error("Disk full"));
  await failed;
  assert.equal(draft.getSnapshot().status, "error");
  assert.equal(draft.getSnapshot().content, "Newer keystrokes");
  assert.equal(draft.getSnapshot().draftStored, true);
  assert.equal(storage.getItem(key("failure")), "Newer keystrokes");
  draft.refresh("Original");
  assert.equal(draft.getSnapshot().content, "Newer keystrokes");
  await draft.flush();
  assert.deepEqual(writes, ["Failing snapshot", "Newer keystrokes"]);
  assert.equal(draft.getSnapshot().status, "saved");
  assert.equal(storage.getItem(key("failure")), null);
});

test("reload recovers failed drafts, preserves attachment references and clears only after commit", async () => {
  const storage = memoryStorage();
  const html = '<p>Recovered</p><img data-attachment="image-uid" alt="Diagram">';
  const original = createTaskNotesDraft({
    identity: "reload", uid: "reload", content: "Old database body", storage,
    save: async () => { throw new Error("Unavailable"); },
  });
  original.edit(html);
  await original.flush();
  const slow = deferred();
  const writes: string[] = [];
  const reloaded = createTaskNotesDraft({
    identity: "reload", uid: "reload", content: "Old database body", storage,
    save: async (content) => { writes.push(content); await slow.promise; },
  });
  assert.equal(reloaded.getSnapshot().content, html);
  assert.equal(reloaded.getSnapshot().status, "pending");
  const saving = reloaded.flush();
  assert.equal(storage.getItem(key("reload")), html);
  slow.resolve();
  await saving;
  assert.deepEqual(writes, [html]);
  assert.equal(storage.getItem(key("reload")), null);

  storage.setItem(key("empty"), "");
  const empty = createTaskNotesDraft({
    identity: "empty", uid: "empty", content: "Previously nonempty", storage,
    save: async (content) => { assert.equal(content, ""); },
  });
  assert.equal(empty.getSnapshot().content, "", "empty drafts recover too");
  await empty.flush();
});

test("rapid A/B/A switching flushes old sessions in order without crossing task identities", async () => {
  const storage = memoryStorage();
  const firstStarted = deferred();
  const firstGate = deferred();
  const secondStarted = deferred();
  const secondGate = deferred();
  const writes: string[] = [];
  const saveA = async (content: string) => {
    writes.push(`A:${content}`);
    if (content === "First") { firstStarted.resolve(); await firstGate.promise; }
    if (content === "Before switch") { secondStarted.resolve(); await secondGate.promise; }
  };
  const a = createTaskNotesDraft({ identity: "switch-A", uid: "switch-A", content: "Old A", storage, save: saveA });
  a.edit("First");
  const first = a.flush();
  await firstStarted.promise;
  a.edit("Before switch");
  const unmount = a.flush();
  const b = createTaskNotesDraft({
    identity: "switch-B", uid: "switch-B", content: "Old B", storage,
    save: async (content) => { writes.push(`B:${content}`); },
  });
  b.edit("Only B");
  await b.flush();
  const aAgain = createTaskNotesDraft({ identity: "switch-A", uid: "switch-A", content: "Old A", storage, save: saveA });
  assert.equal(aAgain.getSnapshot().content, "Before switch");
  aAgain.edit("After return");
  const returned = aAgain.flush();
  firstGate.resolve();
  await secondStarted.promise;
  assert.equal(storage.getItem(key("switch-A")), "After return", "old completion retains newest journal");
  assert.deepEqual(writes, ["A:First", "B:Only B", "A:Before switch"]);
  secondGate.resolve();
  await Promise.all([first, unmount, returned]);
  assert.deepEqual(writes, ["A:First", "B:Only B", "A:Before switch", "A:After return"]);
  assert.equal(aAgain.getSnapshot().status, "saved");
});

test("read-only/trash does not replay or mutate drafts; restoring recovers them", async () => {
  const storage = memoryStorage();
  storage.setItem(key("trash"), "Recover after restoring");
  const writes: string[] = [];
  const draft = createTaskNotesDraft({
    identity: "trash", uid: "trash", content: "Stored body", readOnly: true, storage,
    save: async (content) => { writes.push(content); },
  });
  assert.equal(draft.getSnapshot().content, "Stored body");
  draft.edit("Blocked");
  await draft.flush();
  assert.deepEqual(writes, []);
  assert.equal(storage.getItem(key("trash")), "Recover after restoring");
  draft.setReadOnly(false);
  await draft.flush();
  assert.deepEqual(writes, ["Recover after restoring"]);
  assert.equal(storage.getItem(key("trash")), null);
});

test("a queued save rechecks read-only before writing and preserves its draft", async () => {
  const storage = memoryStorage();
  let writable = true;
  const writes: string[] = [];
  const draft = createTaskNotesDraft({
    identity: "queued-trash", uid: "queued-trash", content: "Stored", storage,
    canSave: () => writable,
    save: async (content) => { writes.push(content); },
  });
  draft.edit("Unsaved before trash");
  const queued = draft.flush();
  writable = false;
  draft.setReadOnly(true);
  await queued;
  assert.deepEqual(writes, []);
  assert.equal(storage.getItem(key("queued-trash")), "Unsaved before trash");
  assert.equal(draft.getSnapshot().status, "pending");
  writable = true;
  draft.setReadOnly(false);
  await draft.flush();
  assert.deepEqual(writes, ["Unsaved before trash"]);
});

test("blocked localStorage still saves and exposes lack of recovery on failure", async () => {
  const fail = () => { throw new Error("Storage blocked"); };
  let failSave = true;
  const writes: string[] = [];
  const draft = createTaskNotesDraft({
    identity: "private", uid: "private", content: "Stored",
    storage: { getItem: fail, setItem: fail, removeItem: fail },
    save: async (content) => { if (failSave) throw new Error("DB blocked"); writes.push(content); },
  });
  draft.edit("Keep in editor");
  assert.equal(draft.getSnapshot().draftStored, false);
  await draft.flush();
  assert.equal(draft.getSnapshot().status, "error");
  assert.equal(draft.getSnapshot().content, "Keep in editor");
  failSave = false;
  await draft.flush();
  assert.deepEqual(writes, ["Keep in editor"]);
  assert.equal(draft.getSnapshot().status, "saved");
});
