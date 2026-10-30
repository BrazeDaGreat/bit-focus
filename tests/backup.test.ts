import "fake-indexeddb/auto";
import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import db from "../lib/db";
import SaveManager, { type ExportedData } from "../lib/SaveManager";
import { backupPreview } from "../lib/backup-validation";
import { runAutoBackupIfDue } from "../lib/autoBackup";
import { PB_AUTH_STORAGE_KEY } from "../lib/pocketbase";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  get length() { return storage.size; },
  key: (index: number) => [...storage.keys()][index] ?? null,
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
} });

const at = new Date("2026-10-10T10:00:00Z");
const body = JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { asset: "image-a" } }] });

async function seed() {
  await db.configuration.add({ name: "Local profile", dob: null, webhook: "https://secret.invalid/token", currency: "USD" });
  await db.notes.add({ uid: "note-a", title: "Private title", content: body, type: "document", createdAt: at, updatedAt: at });
  await db.noteAssets.add({ uid: "image-a", noteUid: "note-a", name: "secret-image.webp", type: "image/webp",
    dataUrl: "data:image/webp;base64,AA==", size: 1, width: 1, height: 1, createdAt: at, updatedAt: at });
  await db.tasks.add({ uid: "task-a", title: "Private task", description: "Private description", tags: [],
    estimateMinutes: 10, priority: 1, order: 1, createdAt: at, updatedAt: at });
  const blob = new Blob(["backup bytes 🌍"]);
  await db.taskAttachments.add({ uid: "file-a", taskUid: "task-a", name: "private-file.txt",
    type: "text/plain", size: blob.size, blob, createdAt: at });
  await db.focus.add({ tag: "Work", startTime: at, endTime: new Date(at.getTime() + 60000) });
  localStorage.setItem("preferences", "local preference");
  localStorage.setItem(PB_AUTH_STORAGE_KEY, "auth-token");
  localStorage.setItem("bitfocus.notes.draft.note-a", "unsaved body");
  localStorage.setItem("bitfocus.notes.taskBodyDraft.task-a", "unsaved task body");
  localStorage.setItem("bitfocus.notes.expanded", "[1]");
  localStorage.setItem("pomoPendingCompletions", "local pending sessions");
}

beforeEach(async () => { await db.open(); await seed(); });
afterEach(async () => { mock.restoreAll(); await db.delete(); storage.clear(); });

function downloads() {
  const blobs: Blob[] = [];
  const anchors: { href: string; download: string; click: () => void }[] = [];
  mock.method(URL, "createObjectURL", (blob: Blob) => { blobs.push(blob); return "blob:backup"; });
  mock.method(URL, "revokeObjectURL", () => {});
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: (tag: string) => {
      assert.equal(tag, "a");
      const anchor = { href: "", download: "", click: () => { anchors.push(anchor); } };
      return anchor;
    },
  } });
  return { blobs, anchors, cleanup() {
    for (const [name, descriptor] of [["document", priorDocument], ["window", priorWindow]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  } };
}

test("default manual download includes note images and attachment bytes and excludes device data", async () => {
  const capture = downloads();
  try {
    await SaveManager.exportData();
    const backup = JSON.parse(await capture.blobs[0].text()) as ExportedData;
    assert.equal(capture.anchors.length, 1);
    assert.doesNotMatch(capture.anchors[0].download, /without-files/);
    assert.equal(backup.backup?.files, "included");
    assert.equal(backup.indexedDB.noteAssets![0].dataUrl, "data:image/webp;base64,AA==");
    assert.equal(backup.indexedDB.taskAttachments!.length, 1);
    assert.deepEqual(backup.localStorage, { preferences: "local preference" });
    await db.taskAttachments.clear();
    await db.noteAssets.clear();
    await SaveManager.importJSON(backup);
    assert.equal(await (await db.taskAttachments.toArray())[0].blob.text(), "backup bytes 🌍");
    assert.equal(await db.noteAssets.count(), 1);
  } finally { capture.cleanup(); }
});

test("automatic downloads and default sync JSON omit files and label that coverage", async () => {
  const snapshot = await SaveManager.exportJSON();
  assert.equal(snapshot.backup?.files, "omitted");
  assert.equal(snapshot.indexedDB.taskAttachments, undefined);
  assert.equal(snapshot.indexedDB.noteAssets, undefined);
  const capture = downloads();
  try {
    assert.equal(await runAutoBackupIfDue(), true);
    const automatic = JSON.parse(await capture.blobs[0].text()) as ExportedData;
    assert.match(capture.anchors[0].download, /without-files/);
    assert.equal(automatic.backup?.files, "omitted");
    assert.equal(automatic.indexedDB.noteAssets, undefined);
    assert.equal(automatic.indexedDB.taskAttachments, undefined);
    assert.equal(automatic.localStorage["bitfocus.lastAutoBackup"], undefined);
    assert.equal(await runAutoBackupIfDue(), false);
    assert.equal(capture.anchors.length, 1);
  } finally { capture.cleanup(); }
});

test("old backups without metadata or later tables restore and migrate legacy tasks", async () => {
  const current = await SaveManager.exportJSON();
  const old = { localStorage: current.localStorage, indexedDB: {
    configuration: current.indexedDB.configuration, focus: current.indexedDB.focus, notes: current.indexedDB.notes,
    legacyTasks: [{ id: 10, uid: "old-a", task: "Legacy task", tags: [] }],
  } };
  await SaveManager.importJSON(old);
  const tasks = await db.tasks.toArray();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Legacy task");
  assert.equal(await db.notes.count(), 1);
  assert.equal(await db.noteAssets.count(), 1);
  assert.equal(await db.taskAttachments.count(), 0); // The original task was replaced.
  assert.equal(localStorage.getItem("bitfocus.notes.draft.note-a"), "unsaved body");
});

test("invalid shape, dates, rows and file contents are rejected before any replacement transaction", async () => {
  const baseline = await SaveManager.exportJSON({ includeAttachments: true });
  const copy = () => JSON.parse(JSON.stringify(baseline)) as ExportedData;
  const badNotes = copy(); badNotes.indexedDB.notes[0].createdAt = "invalid";
  const badFocus = copy(); badFocus.indexedDB.focus[0].startTime = "invalid";
  const badImage = copy(); badImage.indexedDB.noteAssets![0].size = 2;
  const badImageUrl = copy(); badImageUrl.indexedDB.noteAssets![0].dataUrl = "https://untrusted.invalid/image";
  const badFile = copy(); badFile.indexedDB.taskAttachments![0].size = 999;
  const badFileBody = copy(); badFileBody.indexedDB.taskAttachments![0].base64 = "!!!";
  const orphanFile = copy(); orphanFile.indexedDB.taskAttachments![0].taskUid = "missing";
  const duplicate = copy(); duplicate.indexedDB.notes.push({ ...duplicate.indexedDB.notes[0] });
  const badCoverage = copy(); delete badCoverage.indexedDB.noteAssets;
  const invalid: unknown[] = [null, {}, { indexedDB: {} }, badNotes, badFocus, badImage, badImageUrl, badFile, badFileBody,
    orphanFile, duplicate, badCoverage, { ...copy(), localStorage: { preferences: 42 } },
    { ...copy(), indexedDB: { ...copy().indexedDB, notes: null } },
    { ...copy(), indexedDB: { ...copy().indexedDB, notes: [{}] } },
    { ...copy(), indexedDB: { ...copy().indexedDB, legacyTasks: [{}] } }];
  const transaction = mock.method(db, "transaction");
  for (const backup of invalid) await assert.rejects(SaveManager.importJSON(backup));
  assert.equal(transaction.mock.callCount(), 0);
  assert.deepEqual((await SaveManager.exportJSON({ includeAttachments: true })).indexedDB, baseline.indexedDB);
  assert.equal(localStorage.getItem("preferences"), "local preference");
  assert.equal(localStorage.getItem(PB_AUTH_STORAGE_KEY), "auth-token");
});

test("file reading validates without mutation and preview exposes only counts and coverage", async () => {
  const backup = await SaveManager.exportJSON({ includeAttachments: true });
  const loaded = await SaveManager.readBackup(new File([JSON.stringify(backup)], "backup.bitf.json"));
  const preview = backupPreview(loaded);
  assert.equal(preview.counts.tasks, 1);
  assert.equal(preview.counts.notes, 1);
  assert.equal(preview.counts.focusSessions, 1);
  assert.equal(preview.files, "included");
  assert.deepEqual(preview.noteImages, { included: true, count: 1 });
  assert.deepEqual(preview.taskAttachments, { included: true, count: 1 });
  assert.equal(preview.missingNoteImages, 0);
  assert.doesNotMatch(JSON.stringify(preview), /secret|Private|auth-token|private-file|webhook|preferences/);
  assert.equal(await db.tasks.count(), 1);
  assert.equal(localStorage.getItem("preferences"), "local preference");
  await assert.rejects(SaveManager.readBackup(new File(['{"indexedDB":{}}'], "invalid.bitf.json")));
  await assert.rejects(SaveManager.importData(new File(["token-secret:invalid JSON"], "bad.bitf.json")), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /token-secret/);
    return true;
  });
  assert.equal(await db.notes.count(), 1);
});

test("preview distinguishes omitted, partially included and explicitly empty file tables", async () => {
  const lightweight = await SaveManager.exportJSON();
  const omitted = backupPreview(lightweight);
  assert.equal(omitted.files, "omitted");
  assert.deepEqual(omitted.noteImages, { included: false, count: 0 });
  assert.equal(omitted.missingNoteImages, 1);
  const partial = await SaveManager.exportJSON({ includeAttachments: true });
  delete partial.backup; // Older backups can carry only one of the file tables.
  delete partial.indexedDB.taskAttachments;
  assert.equal(backupPreview(partial).files, "partial");
  assert.equal(backupPreview(partial).noteImages.count, 1);
  const empty = await SaveManager.exportJSON({ includeAttachments: true });
  empty.indexedDB.noteAssets = [];
  empty.indexedDB.taskAttachments = [];
  const preview = backupPreview(empty);
  assert.equal(preview.files, "included");
  assert.deepEqual(preview.noteImages, { included: true, count: 0 });
  assert.equal(preview.missingNoteImages, 1);
  await SaveManager.importJSON(empty);
  assert.equal(await db.noteAssets.count(), 0);
  assert.equal(await db.taskAttachments.count(), 0);
});

test("restore preserves device drafts and never activates draft or auth values from old backups", async () => {
  const backup = await SaveManager.exportJSON();
  backup.localStorage = { preferences: "restored preference", [PB_AUTH_STORAGE_KEY]: "foreign-token",
    "bitfocus.notes.draft.note-a": "foreign draft", "bitfocus.notes.draft.new": "foreign new draft",
    "bitfocus.notes.taskBodyDraft.task-a": "foreign task draft",
    "bitfocus.sync.clock": "foreign-clock", "bitfocus.lastAutoBackup": "999", "pomoPendingCompletions": "foreign pending sessions" };
  localStorage.setItem("bitfocus.lastAutoBackup", "123");
  await SaveManager.importJSON(backup);
  assert.equal(localStorage.getItem("preferences"), "restored preference");
  assert.equal(localStorage.getItem(PB_AUTH_STORAGE_KEY), "auth-token");
  assert.equal(localStorage.getItem("bitfocus.notes.draft.note-a"), "unsaved body");
  assert.equal(localStorage.getItem("bitfocus.notes.taskBodyDraft.task-a"), "unsaved task body");
  assert.equal(localStorage.getItem("bitfocus.notes.expanded"), "[1]");
  assert.equal(localStorage.getItem("bitfocus.notes.draft.new"), null);
  assert.equal(localStorage.getItem("bitfocus.sync.clock"), null);
  assert.equal(localStorage.getItem("bitfocus.lastAutoBackup"), "123");
  assert.equal(localStorage.getItem("pomoPendingCompletions"), "local pending sessions");
  assert.equal(await db.noteAssets.count(), 1);
  assert.equal(await db.taskAttachments.count(), 1);
});

test("a failed database replacement rolls back all collections and leaves localStorage intact", async () => {
  const baseline = await SaveManager.exportJSON({ includeAttachments: true });
  const backup = JSON.parse(JSON.stringify(baseline)) as ExportedData;
  backup.indexedDB.configuration[0].name = "Replacement profile";
  backup.localStorage.preferences = "replacement preference";
  const insertion = mock.method(db.notes, "bulkAdd", async () => { throw new Error("Injected insertion failure"); });
  await assert.rejects(SaveManager.importJSON(backup), /Injected insertion failure/);
  insertion.mock.restore();
  assert.deepEqual((await SaveManager.exportJSON({ includeAttachments: true })).indexedDB, baseline.indexedDB);
  assert.equal(localStorage.getItem("preferences"), "local preference");
  assert.equal(localStorage.getItem("bitfocus.notes.draft.note-a"), "unsaved body");
});

test("a settings storage failure rolls back imported records and restores all original local keys", async () => {
  const baseline = await SaveManager.exportJSON({ includeAttachments: true });
  const previous = new Map(storage);
  const backup = JSON.parse(JSON.stringify(baseline)) as ExportedData;
  backup.indexedDB.configuration[0].name = "Replacement profile";
  backup.indexedDB.notes[0].content = "Replacement text";
  backup.localStorage = { first: "partially written", preferences: "too large" };
  const originalSetItem = localStorage.setItem;
  const insertion = mock.method(localStorage, "setItem", (key: string, value: string) => {
    if (key === "preferences" && value === "too large") throw new Error("Injected quota failure");
    originalSetItem(key, value);
  });
  await assert.rejects(SaveManager.importJSON(backup), /Injected quota failure/);
  insertion.mock.restore();
  assert.deepEqual((await SaveManager.exportJSON({ includeAttachments: true })).indexedDB, baseline.indexedDB);
  assert.deepEqual(storage, previous);
});
