/** Page history: when versions are kept, pruning, restores, and sync overwrites. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import db from "../lib/db";
import { useNotes } from "../hooks/useNotes";
import {
  VERSION_GAP_MS, VERSIONS_PER_PAGE, isBigDeletion, keepVersion, listVersions, shouldKeepVersion,
} from "../lib/note-history";
import { applyRecords } from "../lib/sync/apply";
import type { RemoteRecord } from "../lib/sync/transport";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  get length() { return storage.size; },
  key: (index: number) => [...storage.keys()][index] ?? null,
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
} });

const at = new Date("2026-11-01T09:00:00Z");
const later = (ms: number) => new Date(at.getTime() + ms);
const page = { uid: "page-a", title: "Lecture notes", content: "first body" };

function stamp(ms: number, node = "deviceremote"): string {
  return `${ms.toString(36).padStart(11, "0")}:0000:${node}`;
}

function remoteNote(hlc: string, content: string | null, deleted = false): RemoteRecord {
  return { id: hlc, collectionId: "", collectionName: "focus_records", user: "u", col: "notes", uid: "page-a",
    data: content === null ? null : { title: "Lecture notes", type: "document", content, createdAt: at.toISOString(),
      updatedAt: at.toISOString(), deletedAt: null },
    deleted, hlc, dev: "deviceremote", devLabel: "Phone", updated: at.toISOString() } as RemoteRecord;
}

beforeEach(async () => { await db.open(); });
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
  await db.delete();
  storage.clear();
  useNotes.setState({ notes: [], loaded: false });
});

test("a version is kept at the start of each editing session, not on every keystroke", () => {
  assert.equal(shouldKeepVersion(undefined, "a", "ab", at), true);
  const latest = { at, content: "older" };
  assert.equal(shouldKeepVersion(latest, "a", "ab", later(60_000)), false);
  assert.equal(shouldKeepVersion(latest, "a", "ab", later(VERSION_GAP_MS)), true);
  assert.equal(shouldKeepVersion(latest, "a", "ab", later(60_000), true), true);
});

test("empty, unchanged, and already-kept bodies are never stored", () => {
  assert.equal(shouldKeepVersion(undefined, "", "new", at), false);
  assert.equal(shouldKeepVersion(undefined, "same", "same", at), false);
  assert.equal(shouldKeepVersion({ at, content: "kept" }, "kept", "new", later(VERSION_GAP_MS), true), false);
});

test("deleting most of a page keeps a version straight away", () => {
  const long = "x".repeat(2000);
  assert.equal(isBigDeletion(long, "x".repeat(500)), true);
  assert.equal(isBigDeletion(long, "x".repeat(1900)), false);
  assert.equal(isBigDeletion("short", ""), false);
  assert.equal(shouldKeepVersion({ at, content: "older" }, long, "x", later(1000)), true);
});

test("versions are listed newest first and capped per page", async () => {
  for (let i = 0; i < VERSIONS_PER_PAGE + 5; i++) {
    await keepVersion({ ...page, content: `body ${i}` }, "next", "edit", { now: later(i * VERSION_GAP_MS) });
  }
  const versions = await listVersions("page-a");
  assert.equal(versions.length, VERSIONS_PER_PAGE);
  assert.equal(versions[0].content, `body ${VERSIONS_PER_PAGE + 4}`);
  assert.equal(versions.at(-1)?.content, "body 5");
});

test("saving a page keeps its previous body, and restoring can be undone", async () => {
  const id = await db.notes.add({ ...page, type: "document", parentId: null, createdAt: at, updatedAt: at });
  await useNotes.getState().loadNotes();
  await useNotes.getState().saveContent(id, "second body");
  await useNotes.getState().saveContent(id, "second body, more");
  let versions = await listVersions("page-a");
  assert.deepEqual(versions.map((v) => [v.content, v.reason]), [["first body", "edit"]]);

  await useNotes.getState().restoreVersion(id, versions[0]);
  assert.equal((await db.notes.get(id))?.content, "first body");
  versions = await listVersions("page-a");
  assert.deepEqual(versions.map((v) => v.reason).sort(), ["edit", "restore"]);
  assert.ok(versions.some((v) => v.reason === "restore" && v.content === "second body, more"));
});

test("deleting a page forever forgets its history", async () => {
  const id = await db.notes.add({ ...page, type: "document", parentId: null, createdAt: at, updatedAt: at, deletedAt: at });
  await keepVersion(page, "next", "edit", { now: at });
  await useNotes.getState().loadNotes();
  await useNotes.getState().deleteNoteForever(id);
  assert.deepEqual(await listVersions("page-a"), []);
});

test("another device's body replacing this one keeps the local body first", async () => {
  await applyRecords([remoteNote(stamp(1000), "from this device")]);
  await applyRecords([remoteNote(stamp(2000), "from the phone")]);
  assert.equal((await db.notes.where("uid").equals("page-a").first())?.content, "from the phone");
  const versions = await listVersions("page-a");
  assert.deepEqual(versions.map((v) => [v.content, v.reason]), [["from this device", "sync"]]);
});

test("unsent local edits are always kept when a remote body wins over them", async () => {
  await applyRecords([remoteNote(stamp(1000), "synced body")]);
  await keepVersion({ ...page, content: "an older body" }, "synced body", "edit");
  const id = (await db.notes.where("uid").equals("page-a").first())!.id!;
  await db.notes.update(id, { content: "typed offline" });
  await db.syncState.update(["notes", "page-a"], { dirty: 1 });
  await applyRecords([remoteNote(stamp(2000), "from the laptop")]);
  const versions = await listVersions("page-a");
  assert.equal(versions[0].content, "typed offline");
  assert.equal(versions[0].reason, "sync");
});

test("a page deleted forever on another device takes its history with it", async () => {
  await applyRecords([remoteNote(stamp(1000), "body")]);
  await applyRecords([remoteNote(stamp(2000), "new body")]);
  assert.equal((await listVersions("page-a")).length, 1);
  await applyRecords([remoteNote(stamp(3000), null, true)]);
  assert.deepEqual(await listVersions("page-a"), []);
});
