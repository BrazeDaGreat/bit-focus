/** Sync merge rules, exercised against real Dexie with fake IndexedDB. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import db from "../lib/db";
import { applyRecords } from "../lib/sync/apply";
import { hlcCompare, hlcNow, hlcObserve, hlcTime } from "../lib/sync/hlc";
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
const iso = at.toISOString();

/** A stamp at `ms` with tie-break `count`, written by `node`. */
function stamp(ms: number, count = 0, node = "deviceremote"): string {
  return `${ms.toString(36).padStart(11, "0")}:${count.toString(36).padStart(4, "0")}:${node}`;
}

function record(col: string, uid: string, hlc: string, data: Record<string, unknown> | null, deleted = false): RemoteRecord {
  return { id: `${col}-${uid}-${hlc}`, collectionId: "", collectionName: "focus_records", user: "u", col, uid, data, deleted,
    hlc, dev: "deviceremote", devLabel: "Phone", updated: iso } as RemoteRecord;
}

function noteData(fields: Record<string, unknown> = {}): Record<string, unknown> {
  return { title: "Page", type: "document", content: "", createdAt: iso, updatedAt: iso, deletedAt: null, ...fields };
}

const focusData = (tag: string) => ({ tag, startTime: iso, endTime: new Date(at.getTime() + 25 * 60_000).toISOString() });

beforeEach(async () => { await db.open(); });
afterEach(async () => {
  await db.delete();
  storage.clear();
});

test("a pulled row lands with its uid and is recorded as clean", async () => {
  const hlc = stamp(1000);
  const report = await applyRecords([record("focus", "session-a", hlc, focusData("uni"))]);
  assert.equal(report.applied, 1);
  assert.deepEqual(report.counts, { focus: 1 });
  assert.ok(report.touched.has("focus"));
  const row = await db.focus.where("uid").equals("session-a").first();
  assert.equal(row?.tag, "uni");
  assert.ok(row?.startTime instanceof Date);
  assert.deepEqual(await db.syncState.get(["focus", "session-a"]), { col: "focus", uid: "session-a", hlc, dirty: 0, deleted: 0 });
});

test("an older or equal stamp never replaces what this device holds", async () => {
  await applyRecords([record("focus", "session-a", stamp(2000), focusData("newer"))]);
  const older = await applyRecords([record("focus", "session-a", stamp(1000), focusData("older"))]);
  const same = await applyRecords([record("focus", "session-a", stamp(2000), focusData("same stamp"))]);
  assert.equal(older.skipped, 1);
  assert.equal(same.skipped, 1);
  assert.equal((await db.focus.where("uid").equals("session-a").first())?.tag, "newer");
  assert.equal(await db.focus.count(), 1);
});

test("a newer stamp replaces the row in place, keeping its local id", async () => {
  await applyRecords([record("focus", "session-a", stamp(1000), focusData("first"))]);
  const id = (await db.focus.where("uid").equals("session-a").first())?.id;
  await applyRecords([record("focus", "session-a", stamp(1000, 1), focusData("second"))]);
  const rows = await db.focus.toArray();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  assert.equal(rows[0].tag, "second");
});

test("ties on time break on the counter, then on the writing device", () => {
  assert.equal(hlcCompare(stamp(5, 1, "aaaaaaaaaaaa"), stamp(5, 0, "zzzzzzzzzzzz")), 1);
  assert.equal(hlcCompare(stamp(5, 0, "bbbbbbbbbbbb"), stamp(5, 0, "aaaaaaaaaaaa")), 1);
  assert.equal(hlcCompare(stamp(5), stamp(5)), 0);
  assert.equal(hlcCompare(null, stamp(0)), -1);
});

test("a tombstone deletes the local row and is remembered as deleted", async () => {
  await applyRecords([record("focus", "session-a", stamp(1000), focusData("uni"))]);
  await applyRecords([record("focus", "session-a", stamp(2000), null, true)]);
  assert.equal(await db.focus.count(), 0);
  assert.equal((await db.syncState.get(["focus", "session-a"]))?.deleted, 1);
  // A stale edit arriving after the delete does not bring the row back.
  const stale = await applyRecords([record("focus", "session-a", stamp(1500), focusData("stale"))]);
  assert.equal(stale.skipped, 1);
  assert.equal(await db.focus.count(), 0);
});

test("a row appearing twice in one batch is written once, at its newest state", async () => {
  const report = await applyRecords([
    record("focus", "session-a", stamp(3000), focusData("final")),
    record("focus", "session-a", stamp(1000), focusData("draft")),
  ]);
  assert.equal(report.applied, 1);
  assert.equal((await db.focus.where("uid").equals("session-a").first())?.tag, "final");
});

test("a child that arrives before its parent is linked on the second pass", async () => {
  const report = await applyRecords([
    record("notes", "child", stamp(2000), noteData({ title: "Child", parentIdUid: "parent" })),
    record("notes", "parent", stamp(1000), noteData({ title: "Parent" })),
  ]);
  assert.equal(report.deferred, 0);
  const parent = await db.notes.where("uid").equals("parent").first();
  const child = await db.notes.where("uid").equals("child").first();
  assert.equal(child?.parentId, parent?.id);
});

test("a reference to a row that never arrives is left empty, not invented", async () => {
  const report = await applyRecords([record("notes", "orphan", stamp(1000), noteData({ parentIdUid: "missing" }))]);
  assert.equal(report.deferred, 0);
  assert.equal(report.applied, 1);
  assert.equal((await db.notes.where("uid").equals("orphan").first())?.parentId, null);
});

test("tasks land after the projects they belong to, whatever order the server sends", async () => {
  await applyRecords([
    record("tasks", "task-a", stamp(2000), { title: "Read", description: "", tags: [], estimateMinutes: 0, priority: 0, order: 1,
      createdAt: iso, updatedAt: iso, projectIdUid: "project-a" }),
    record("projects", "project-a", stamp(1000), { title: "Uni", createdAt: iso, updatedAt: iso }),
  ]);
  const project = await db.projects.where("uid").equals("project-a").first();
  const task = await db.tasks.where("uid").equals("task-a").first();
  assert.ok(project?.id);
  assert.equal(task?.projectId, project?.id);
});

test("collections this build does not know are left untouched for a later version", async () => {
  const report = await applyRecords([record("futureThing", "x", stamp(1000), { a: 1 })]);
  assert.equal(report.skipped, 1);
  assert.equal(report.applied, 0);
  assert.equal(await db.syncState.get(["futureThing", "x"]), undefined);
});

test("rows with the same local id on two devices stay separate by uid", async () => {
  await db.focus.add({ uid: "mine", tag: "local", startTime: at, endTime: at });
  await applyRecords([record("focus", "theirs", stamp(1000), focusData("remote"))]);
  const tags = (await db.focus.toArray()).map((row) => row.tag).sort();
  assert.deepEqual(tags, ["local", "remote"]);
});

test("after seeing a remote stamp, the next local stamp sorts after it", async () => {
  const remote = stamp(Date.now() + 30_000, 7);
  hlcObserve(remote);
  const next = hlcNow();
  assert.equal(hlcCompare(next, remote), 1);
  // A peer far in the future does not drag this device's clock along.
  const far = stamp(Date.now() + 10 * 60_000);
  hlcObserve(far);
  assert.ok((hlcTime(hlcNow()) ?? 0) < Date.now() + 2 * 60_000);
});
