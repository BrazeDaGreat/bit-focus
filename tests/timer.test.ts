import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import db from "../lib/db";
import { useFocus } from "../hooks/useFocus";
import {
  INITIAL_STATE,
  SHORT_PAUSE_MS,
  isFocusTime,
  pomoReducer,
  segmentsSeconds,
  sessionSegments,
  type PomoAction,
  type PomoState,
} from "../lib/timer-state";
import {
  COMPLETION_JOURNAL_KEY,
  CompletionQueue,
  completionRows,
  createCompletion,
  readJournal,
  type CompletionRow,
  type JournalStorage,
} from "../lib/timer-completion";
import { isDeviceLocalKey } from "../lib/sync/keys";

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 30, 9, 0, 0);

function run(state: PomoState, ...actions: PomoAction[]): PomoState {
  return actions.reduce(pomoReducer, state);
}

/** Start at `start`, pause at `pause` — as the provider dispatches them. */
function stretch(state: PomoState, start: number, pause: number): PomoState {
  const startTime = start - state.elapsedSeconds * 1000;
  const running = run(state, { type: "START", payload: { startTime, now: start } });
  return run(running, {
    type: "PAUSE",
    payload: { elapsedSeconds: Math.floor((pause - startTime) / 1000), now: pause },
  });
}

class MemoryStorage implements JournalStorage {
  map = new Map<string, string>();
  failWrites = false;
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key: string) { this.map.delete(key); }
}

/** Fake database keyed by uid, with switchable failure. */
function fakeDb() {
  const rows = new Map<string, CompletionRow>();
  const calls = { save: 0 };
  let failing = false;
  return {
    rows,
    calls,
    fail(on: boolean) { failing = on; },
    async save(batch: CompletionRow[]) {
      calls.save++;
      await Promise.resolve();
      if (failing) throw new Error("IndexedDB unavailable");
      let inserted = 0;
      for (const row of batch) {
        if (!rows.has(row.uid)) { rows.set(row.uid, row); inserted++; }
      }
      return inserted;
    },
  };
}

function sampleCompletion(id = "c1") {
  return createCompletion({
    id,
    tag: "Deep",
    segments: [{ start: T0, end: T0 + 25 * MIN }],
    seconds: 25 * 60,
    createdAt: T0 + 25 * MIN,
  });
}

// ── Active-only stretches ────────────────────────────────────────────────

test("a short pause joins stretches without counting the pause", () => {
  let s = stretch(INITIAL_STATE, T0, T0 + 10 * MIN);
  s = stretch(s, T0 + 12 * MIN, T0 + 22 * MIN);

  const segs = sessionSegments(s, T0 + 22 * MIN);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].end, T0 + 22 * MIN);
  assert.equal(segs[0].end - segs[0].start, 20 * MIN);
  // Records, points and the clock agree.
  assert.equal(segmentsSeconds(segs), 20 * 60);
  assert.equal(s.elapsedSeconds, 20 * 60);
});

test("resuming does not stretch the previous run back over the pause", () => {
  const paused = stretch(INITIAL_STATE, T0, T0 + 10 * MIN);
  const resumed = run(paused, {
    type: "START",
    payload: { startTime: T0 + 2 * MIN, now: T0 + 12 * MIN },
  });
  assert.deepEqual(resumed.segments, [{ start: T0, end: T0 + 10 * MIN }]);
  assert.equal(resumed.segmentStart, T0 + 12 * MIN);
});

test("a long pause splits the session into separate records", () => {
  let s = stretch(INITIAL_STATE, T0, T0 + 10 * MIN);
  s = stretch(s, T0 + 10 * MIN + SHORT_PAUSE_MS + MIN, T0 + 30 * MIN);
  const segs = sessionSegments(s, T0 + 30 * MIN);
  assert.equal(segs.length, 2);
  assert.deepEqual(segs[0], { start: T0, end: T0 + 10 * MIN });
  assert.equal(segmentsSeconds(segs), s.elapsedSeconds);
});

test("an open stretch ends at the given end time", () => {
  const running = run(INITIAL_STATE, { type: "START", payload: { startTime: T0, now: T0 } });
  assert.deepEqual(sessionSegments(running, T0 + 25 * MIN), [{ start: T0, end: T0 + 25 * MIN }]);
});

test("overlapping stretches are not counted twice", () => {
  const s: PomoState = {
    ...INITIAL_STATE,
    segments: [
      { start: T0, end: T0 + 10 * MIN },
      { start: T0 + 5 * MIN, end: T0 + 12 * MIN },
    ],
  };
  assert.equal(segmentsSeconds(sessionSegments(s, T0 + 12 * MIN)), 12 * 60);
});

// ── Mode switching and breaks ────────────────────────────────────────────

test("switching mode starts the new mode from zero, running only if it was", () => {
  const paused = stretch(INITIAL_STATE, T0, T0 + 10 * MIN);
  // The provider saves the paused focus first; it is all still there to save.
  assert.equal(segmentsSeconds(sessionSegments(paused, T0 + 11 * MIN)), 10 * 60);

  const switched = run(paused, { type: "SET_MODE", payload: { mode: "pomodoro", startAt: null } });
  assert.equal(switched.mode, "pomodoro");
  assert.equal(switched.isRunning, false);
  assert.equal(switched.elapsedSeconds, 0);
  assert.deepEqual(switched.segments, []);

  const live = run(INITIAL_STATE, { type: "START", payload: { startTime: T0, now: T0 } });
  const kept = run(live, { type: "SET_MODE", payload: { mode: "pomodoro", startAt: T0 + 5 * MIN } });
  assert.equal(kept.isRunning, true);
  assert.equal(kept.startTime, T0 + 5 * MIN);
  assert.equal(kept.segmentStart, T0 + 5 * MIN);
  assert.equal(kept.elapsedSeconds, 0);
});

test("switching to the current mode changes nothing", () => {
  const paused = stretch(INITIAL_STATE, T0, T0 + 10 * MIN);
  assert.equal(run(paused, { type: "SET_MODE", payload: { mode: "standard", startAt: null } }), paused);
});

test("break time is never focus time, and a phase change clears stretches", () => {
  const focus = run(
    { ...INITIAL_STATE, mode: "pomodoro" },
    { type: "START", payload: { startTime: T0, now: T0 } }
  );
  assert.equal(isFocusTime(focus), true);
  const onBreak = run(focus, { type: "ADVANCE_PHASE", payload: { completedFocus: true, autoStartAt: T0 + 25 * MIN } });
  assert.equal(isFocusTime(onBreak), false);
  assert.deepEqual(onBreak.segments, []);
  assert.equal(onBreak.segmentStart, T0 + 25 * MIN);
});

test("a second reset sees the first one (reducer runs ahead of render)", () => {
  const paused = stretch(INITIAL_STATE, T0, T0 + 10 * MIN);
  const once = run(paused, { type: "RESET" });
  assert.equal(segmentsSeconds(sessionSegments(once, T0 + 11 * MIN)), 0);
});

// ── Completion journal ───────────────────────────────────────────────────

test("points are awarded only after the save lands", async () => {
  const storage = new MemoryStorage();
  const fdb = fakeDb();
  const awarded: number[] = [];
  const queue = new CompletionQueue({ storage, save: fdb.save, award: (p) => awarded.push(p) });

  const pending = queue.submit(sampleCompletion());
  // Journalled synchronously, before any await.
  assert.equal(readJournal(storage).length, 1);
  assert.deepEqual(awarded, []);

  assert.equal(await pending, "saved");
  assert.deepEqual(awarded, [25]);
  assert.equal(fdb.rows.size, 1);
  assert.equal(storage.getItem(COMPLETION_JOURNAL_KEY), null);
});

test("a failed save keeps the completion and a retry saves it once", async () => {
  const storage = new MemoryStorage();
  const fdb = fakeDb();
  const awarded: number[] = [];
  const queue = new CompletionQueue({ storage, save: fdb.save, award: (p) => awarded.push(p) });

  fdb.fail(true);
  assert.equal(await queue.submit(sampleCompletion()), "failed");
  assert.deepEqual(awarded, []);
  assert.equal(queue.list().length, 1);
  assert.equal(readJournal(storage).length, 1);

  fdb.fail(false);
  const { saved, failed } = await queue.flush();
  assert.equal(saved.length, 1);
  assert.equal(failed.length, 0);
  assert.deepEqual(awarded, [25]);

  // Nothing left to retry.
  assert.deepEqual(await queue.flush(), { saved: [], failed: [] });
  assert.deepEqual(awarded, [25]);
  assert.equal(fdb.rows.size, 1);
});

test("a reload replays the journal into a fresh queue", async () => {
  const storage = new MemoryStorage();
  const fdb = fakeDb();
  fdb.fail(true);
  const first = new CompletionQueue({ storage, save: fdb.save, award: () => {} });
  await first.submit(sampleCompletion());

  fdb.fail(false);
  const awarded: number[] = [];
  const afterReload = new CompletionQueue({ storage, save: fdb.save, award: (p) => awarded.push(p) });
  assert.equal(afterReload.list().length, 1);
  const { saved } = await afterReload.flush();
  assert.equal(saved.length, 1);
  assert.deepEqual(awarded, [25]);
  assert.equal(storage.getItem(COMPLETION_JOURNAL_KEY), null);
});

test("a journal entry whose rows are already stored awards nothing", async () => {
  // Saved and rewarded, but the page died before the journal was cleared.
  const storage = new MemoryStorage();
  const fdb = fakeDb();
  const completion = sampleCompletion();
  await fdb.save(completionRows(completion));
  storage.setItem(COMPLETION_JOURNAL_KEY, JSON.stringify([completion]));

  const awarded: number[] = [];
  const queue = new CompletionQueue({ storage, save: fdb.save, award: (p) => awarded.push(p) });
  const { saved } = await queue.flush();
  assert.equal(saved.length, 0);
  assert.deepEqual(awarded, []);
  assert.equal(fdb.rows.size, 1);
  assert.equal(queue.list().length, 0);
});

test("overlapping retries share one attempt", async () => {
  const fdb = fakeDb();
  const awarded: number[] = [];
  const queue = new CompletionQueue({ storage: new MemoryStorage(), save: fdb.save, award: (p) => awarded.push(p) });
  queue.add(sampleCompletion());
  const outcomes = await Promise.all([queue.process("c1"), queue.process("c1"), queue.flush()]);
  assert.equal(fdb.calls.save, 1);
  assert.deepEqual(awarded, [25]);
  assert.equal(outcomes[0], "saved");
});

test("full browser storage still saves the session", async () => {
  const storage = new MemoryStorage();
  storage.failWrites = true;
  const fdb = fakeDb();
  const awarded: number[] = [];
  const queue = new CompletionQueue({ storage, save: fdb.save, award: (p) => awarded.push(p) });
  assert.equal(await queue.submit(sampleCompletion()), "saved");
  assert.deepEqual(awarded, [25]);
});

test("stretch uids are stable across retries", () => {
  const c = createCompletion({
    id: "abc",
    tag: "Deep",
    segments: [{ start: T0, end: T0 + 10 * MIN }, { start: T0 + 20 * MIN, end: T0 + 30 * MIN }],
    seconds: 20 * 60,
    createdAt: T0 + 30 * MIN,
    taskUid: "task-1",
  });
  assert.deepEqual(completionRows(c).map((r) => r.uid), ["abc-0", "abc-1"]);
  assert.deepEqual(completionRows(c), completionRows(JSON.parse(JSON.stringify(c))));
  assert.equal(completionRows(c)[0].taskUid, "task-1");
  assert.equal(c.points, 20);
});

test("the journal stays on this device", () => {
  assert.equal(isDeviceLocalKey(COMPLETION_JOURNAL_KEY), true);
});

test("Pomodoro review metadata survives a failed save and is recorded once after retry", async () => {
  const storage = new MemoryStorage();
  const fdb = fakeDb();
  const recorded: { completed: boolean; seconds: number }[] = [];
  const completion = createCompletion({ ...sampleCompletion(), pomodoro: { completed: true } });
  const onSaved = (saved: ReturnType<typeof sampleCompletion>) => {
    if (saved.pomodoro) recorded.push({ completed: saved.pomodoro.completed, seconds: saved.seconds });
  };
  const first = new CompletionQueue({ storage, save: fdb.save, award: () => {}, onSaved });
  fdb.fail(true);
  await first.submit(completion);
  assert.deepEqual(recorded, []);
  assert.equal(first.isDurable(), true);
  const reloaded = new CompletionQueue({ storage, save: fdb.save, award: () => {}, onSaved });
  assert.equal(reloaded.isDurable(), true);
  fdb.fail(false);
  await Promise.all([reloaded.flush(), reloaded.flush()]);
  assert.deepEqual(recorded, [{ completed: true, seconds: 1500 }]);
});

test("a failed save without a journal reports recovery limited to this tab", async () => {
  const storage = new MemoryStorage();
  storage.failWrites = true;
  const fdb = fakeDb();
  fdb.fail(true);
  const queue = new CompletionQueue({ storage, save: fdb.save, award: () => {} });
  assert.equal(await queue.submit(sampleCompletion()), "failed");
  assert.equal(queue.isDurable(), false);
  assert.equal(queue.list().length, 1);
});

// ── IndexedDB ────────────────────────────────────────────────────────────

test("addFocusSessionsOnce inserts each uid once", async () => {
  await db.focus.clear();
  const rows = completionRows(createCompletion({
    id: "idb",
    tag: "Deep",
    segments: [{ start: T0, end: T0 + 10 * MIN }, { start: T0 + 20 * MIN, end: T0 + 30 * MIN }],
    seconds: 20 * 60,
    createdAt: T0 + 30 * MIN,
  }));

  assert.equal(await useFocus.getState().addFocusSessionsOnce(rows), 2);
  assert.equal(await useFocus.getState().addFocusSessionsOnce(rows), 0);
  assert.equal(await db.focus.count(), 2);
  assert.equal(useFocus.getState().focusSessions.filter((s) => s.uid?.startsWith("idb-")).length, 2);
});
