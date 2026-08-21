/**
 * Sync Engine - Scheduling and Reconciliation
 *
 * The part that decides *when*. Reading and writing live in `transport.ts`,
 * merging lives in `apply.ts`; this file owns the loop that keeps a device
 * current and the guarantees that make it safe to leave running.
 *
 * How a device stays in step:
 *
 * - **Local changes** are pushed after a short quiet period. The debounce has a
 *   ceiling, because the previous engine's did not: a running timer wrote to
 *   storage every second, reset the debounce every second, and so never pushed
 *   at all until a slow safety net caught it.
 * - **Remote changes** arrive over a realtime subscription and are pulled
 *   immediately. A periodic reconcile and a check on tab focus cover the times
 *   realtime is unavailable.
 * - **Failures back off** and retry rather than latching into an error state,
 *   and going offline is a pause, not a failure.
 *
 * What it will not do: replace local data wholesale, reload the page, or ask
 * the user to choose between two versions of their life. Every merge is per
 * row and automatic.
 *
 * @fileoverview Sync scheduling, reconciliation, and lifecycle.
 * @author BIT Focus Development Team
 * @since v0.21.0
 */

import db from "@/lib/db";
import SaveManager from "@/lib/SaveManager";
import { pb, SYNC_COLLECTION } from "@/lib/pocketbase";
import { applyRecords, rehydratePersistedStores, type ApplyReport } from "./apply";
import { IdCache, toWire } from "./codec";
import { deviceId } from "./hlc";
import { isSyncedKey } from "./keys";
import {
  COLLECTION_BY_KEY,
  KV_COLLECTION,
  isSkipped,
  type LocalRow,
} from "./registry";
import {
  installTracking,
  markEverythingDirty,
  onLocalChange,
  withoutTracking,
} from "./tracker";
import {
  deleteAllRecords,
  isOffline,
  pullPage,
  pushRecords,
  remoteCount,
  subscribeRecords,
  type OutgoingRecord,
  type PushFailure,
  type RemoteRecord,
} from "./transport";

/** Quiet period before local changes are pushed. */
const PUSH_DEBOUNCE_MS = 2_000;

/**
 * Longest the debounce may defer a push.
 *
 * Without a ceiling, continuous local activity postpones the push forever.
 * That is not hypothetical — it is precisely what a running focus timer did to
 * the previous engine.
 */
const PUSH_MAX_WAIT_MS = 15_000;

/** Interval between full reconciles, as a safety net behind realtime. */
const RECONCILE_MS = 120_000;

/** Backoff schedule after a failed cycle, in milliseconds. */
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000];

/** Meta keys stored in the `sync_meta` table. */
const META_CURSOR = "cursor";
const META_SYNCED_AT = "syncedAt";
const META_SEEDED = "seeded";
const META_LEGACY_RETIRED = "legacyRetired";
const META_BACKUP_DONE = "backupDone";

/** Coarse state shown in the interface. */
export type SyncStatus =
  | "off"
  | "idle"
  | "syncing"
  | "offline"
  | "paused"
  | "error";

/**
 * Device-local key holding whether sync is paused here.
 *
 * Under the sync prefix, so it is device-owned and never travels: pausing on a
 * work laptop should not pause a phone.
 */
const PAUSED_KEY = "bitfocus.sync.paused";

/** Which direction data is moving, for directional affordances. */
export type SyncPhase = "push" | "pull" | "seed" | null;

/** Everything the interface needs to describe sync at a glance. */
export interface SyncSnapshot {
  status: SyncStatus;
  phase: SyncPhase;
  /** Rows waiting to be pushed. */
  pending: number;
  /** ISO timestamp of the last fully successful cycle. */
  syncedAt: string | null;
  /** Label of the device that most recently wrote to the cloud. */
  lastWriter: string | null;
  /** Message from the last failure, cleared on the next success. */
  error: string | null;
  /** Progress during long operations, such as the initial seed. */
  progress: { done: number; total: number } | null;
  /** Rows the server refused, with the reason. Surfaced, never silently dropped. */
  rejected: PushFailure[];
  /**
   * True while this device is meeting the account for the first time.
   *
   * The first reconcile is the one that decides whether this device has data of
   * its own or is about to receive an existing account's. Anything that would
   * ask the person to re-enter details they already have — onboarding, most of
   * all — should wait for it rather than race it.
   */
  bootstrapping: boolean;
  /**
   * What the first sync brought down, per collection, once it has finished.
   *
   * Null until a first sync has actually restored something, so the interface
   * can report what arrived instead of asserting that something did.
   */
  restored: Record<string, number> | null;
}

const initialSnapshot: SyncSnapshot = {
  status: "off",
  phase: null,
  pending: 0,
  syncedAt: null,
  lastWriter: null,
  error: null,
  progress: null,
  rejected: [],
  bootstrapping: false,
  restored: null,
};

let snapshot: SyncSnapshot = { ...initialSnapshot };

const statusListeners = new Set<(next: SyncSnapshot) => void>();
const refreshListeners = new Set<(report: ApplyReport) => void>();

/** Subscribe to sync status changes. */
export function onStatus(listener: (next: SyncSnapshot) => void): () => void {
  statusListeners.add(listener);
  listener(snapshot);
  return () => statusListeners.delete(listener);
}

/**
 * Subscribe to "remote data landed" events.
 *
 * This is what replaced the page reload. Stores reload the slice that changed
 * and the interface updates in place.
 */
export function onRefresh(listener: (report: ApplyReport) => void): () => void {
  refreshListeners.add(listener);
  return () => refreshListeners.delete(listener);
}

/** Read the current status without subscribing. */
export function currentSnapshot(): SyncSnapshot {
  return snapshot;
}

/** Merge a patch into the published status. */
function setStatus(patch: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of statusListeners) listener(snapshot);
}

// ── Engine state ─────────────────────────────────────────────────────────────

let userId: string | null = null;
let unsubscribeRealtime: (() => void) | null = null;
let unsubscribeChanges: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let reconcileTimer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lifecycleInstalled = false;
let failureStreak = 0;

/** Serializes cycles so a push and a pull never interleave. */
let chain: Promise<unknown> = Promise.resolve();

/** Queue an operation behind any in-flight sync work. */
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = chain.then(operation, operation);
  chain = next.catch(() => undefined);
  return next;
}

/** Read a persisted engine setting. */
async function readMeta(key: string): Promise<string | null> {
  const row = await db.syncMeta.get(key);
  return row?.value ?? null;
}

/** Persist an engine setting. */
async function writeMeta(key: string, value: string): Promise<void> {
  await db.syncMeta.put({ key, value });
}

/** Turn an unknown throwable into something worth showing a person. */
function messageFor(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Sync failed. It will retry automatically.";
}

/** How many rows are waiting to be pushed. */
async function pendingCount(): Promise<number> {
  return db.syncState.where("dirty").equals(1).count();
}

// ── Collecting local changes ─────────────────────────────────────────────────

/**
 * Build the outgoing batch from rows flagged dirty.
 *
 * A row whose bookkeeping says it exists but whose data is gone is treated as a
 * deletion. That covers changes made in ways the table hooks cannot observe,
 * such as a bulk clear, and errs towards the server learning about it rather
 * than the row silently reappearing on the next pull.
 */
async function collectDirty(): Promise<OutgoingRecord[]> {
  const dirty = await db.syncState.where("dirty").equals(1).toArray();
  if (dirty.length === 0) return [];

  const cache = new IdCache();
  const out: OutgoingRecord[] = [];

  for (const entry of dirty) {
    if (entry.deleted === 1) {
      out.push({ col: entry.col, uid: entry.uid, data: null, deleted: true, hlc: entry.hlc });
      continue;
    }

    if (entry.col === KV_COLLECTION) {
      const value =
        typeof window === "undefined" ? null : localStorage.getItem(entry.uid);
      if (value === null || !isSyncedKey(entry.uid)) {
        out.push({ col: entry.col, uid: entry.uid, data: null, deleted: true, hlc: entry.hlc });
      } else {
        out.push({
          col: entry.col,
          uid: entry.uid,
          data: { value },
          deleted: false,
          hlc: entry.hlc,
        });
      }
      continue;
    }

    const col = COLLECTION_BY_KEY.get(entry.col);
    if (!col) continue;

    const row = col.singleton
      ? await col.table().toCollection().first()
      : col.uidField === col.pk
        ? await col.table().get(entry.uid)
        : await col.table().where(col.uidField).equals(entry.uid).first();

    if (!row) {
      out.push({ col: entry.col, uid: entry.uid, data: null, deleted: true, hlc: entry.hlc });
      continue;
    }

    if (isSkipped(col, row as LocalRow)) continue;

    out.push({
      col: entry.col,
      uid: entry.uid,
      data: await toWire(col, row as LocalRow, cache),
      deleted: false,
      hlc: entry.hlc,
    });
  }

  return out;
}

// ── Cycles ───────────────────────────────────────────────────────────────────

/**
 * Download and apply everything changed since the last pull.
 *
 * @returns What was applied, or null when there was nothing to take.
 */
async function pull(): Promise<ApplyReport | null> {
  if (!userId) return null;

  setStatus({ status: "syncing", phase: "pull" });

  const cursor = await readMeta(META_CURSOR);
  const collected: RemoteRecord[] = [];
  let page = 1;
  let totalPages = 1;
  let newest = cursor;

  do {
    const result = await pullPage(userId, cursor, page);
    collected.push(...result.items);
    totalPages = result.totalPages;
    for (const item of result.items) {
      if (!newest || item.updated > newest) newest = item.updated;
    }
    page += 1;
  } while (page <= totalPages);

  if (collected.length === 0) {
    if (newest && newest !== cursor) await writeMeta(META_CURSOR, newest);
    return null;
  }

  const report = await applyRecords(collected);

  // The cursor only advances after a successful apply. A crash mid-apply means
  // the same records arrive again, which is harmless — applying one is
  // idempotent — and far better than skipping past data that never landed.
  if (newest) await writeMeta(META_CURSOR, newest);

  if (report.kvKeys.length) await rehydratePersistedStores(report.kvKeys);
  if (report.applied > 0) {
    for (const listener of refreshListeners) listener(report);
  }

  return report;
}

/**
 * Upload everything this device has changed.
 *
 * Rows the server refuses as stale are cleared of their dirty flag only after
 * the newer version has been pulled down, so nothing is dropped on the floor.
 */
async function push(): Promise<void> {
  if (!userId) return;

  const batch = await collectDirty();
  if (batch.length === 0) {
    setStatus({ pending: 0 });
    return;
  }

  setStatus({
    status: "syncing",
    phase: batch.length > 50 ? "seed" : "push",
    pending: batch.length,
    progress: batch.length > 50 ? { done: 0, total: batch.length } : null,
  });

  const device = { id: deviceId(), label: deviceLabel() };
  const result = await pushRecords(userId, batch, device, (done, total) => {
    if (total > 50) setStatus({ progress: { done, total } });
  });

  // Accepted rows are settled: clear the flag, but leave the stamp so future
  // comparisons still know when this version was written.
  if (result.accepted.length) {
    await withoutTracking(async () => {
      const rows = await Promise.all(
        result.accepted.map(({ col, uid }) => db.syncState.get([col, uid])),
      );
      const settled = rows
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map((row) => ({ ...row, dirty: 0 }));
      if (settled.length) await db.syncState.bulkPut(settled);
    });
  }

  const stale = result.failures.filter((f) => f.kind === "stale");
  const oversized = result.failures.filter((f) => f.kind === "oversized");
  const failed = result.failures.filter((f) => f.kind === "failed");

  // The server holds something newer. Pull it, let the per-row merge decide,
  // and whatever this device still holds a better version of stays dirty and
  // goes out on the next cycle.
  if (stale.length > 0) await pull();

  setStatus({
    pending: await pendingCount(),
    progress: null,
    rejected: oversized,
  });

  if (failed.length > 0) {
    throw new Error(failed[0].message);
  }
}

/**
 * Seed a brand new account from this device.
 *
 * Only ever runs against an account with no records at all, so there is nothing
 * it can overwrite.
 */
async function seed(): Promise<void> {
  setStatus({ status: "syncing", phase: "seed" });
  await markEverythingDirty();
  await push();
  await writeMeta(META_SEEDED, "1");
}

/**
 * Retire the snapshot-era cloud copy.
 *
 * Left until after a successful seed, and only then, so the old copy remains
 * intact for as long as it is the only one.
 */
async function retireLegacySnapshot(): Promise<void> {
  if (!userId) return;
  if (await readMeta(META_LEGACY_RETIRED)) return;

  try {
    const record = await pb
      .collection(SYNC_COLLECTION)
      .getFirstListItem(pb.filter("user = {:user}", { user: userId }), {
        fields: "id",
        requestKey: null,
      });
    await pb.collection(SYNC_COLLECTION).delete(record.id, { requestKey: null });
  } catch {
    // Already gone, or unreachable. Either way it is no longer read from, and
    // a stale row in a collection nothing consults costs nothing.
  }
  await writeMeta(META_LEGACY_RETIRED, "1");
}

/**
 * Keep one local copy of everything from before sync was rebuilt.
 *
 * Cheap insurance, taken once. Any migration that touches a person's whole
 * history should leave them something to go back to.
 */
async function captureBackup(): Promise<void> {
  if (await readMeta(META_BACKUP_DONE)) return;
  try {
    const payload = await SaveManager.exportJSON();
    await withoutTracking(async () => {
      await db.syncBackup.add({
        createdAt: new Date(),
        label: "Before per-record sync",
        payload: JSON.stringify(payload),
      });
    });
  } catch {
    // A backup that cannot be taken must not block sync from starting.
  }
  await writeMeta(META_BACKUP_DONE, "1");
}

/** Run a full reconcile: take what is new, then send what is ours. */
async function reconcile(): Promise<void> {
  if (!userId) return;

  try {
    const seeded = await readMeta(META_SEEDED);

    if (!seeded) {
      // A fresh account has nothing to merge with, so this device's data simply
      // becomes the starting point. An account that already holds records is
      // pulled first, and the per-row merge takes it from there — which is what
      // lets someone sign in on a new device and get their name, tags and
      // history back instead of being asked for them a second time.
      const count = await remoteCount(userId);
      if (count === 0) {
        await seed();
        await retireLegacySnapshot();
      } else {
        const report = await pull();
        if (report && report.applied > 0) {
          setStatus({ restored: report.counts });
        }
        await markEverythingDirty();
        await push();
        await writeMeta(META_SEEDED, "1");
        await retireLegacySnapshot();
      }
    } else {
      await pull();
      await push();
    }

    const syncedAt = new Date().toISOString();
    await writeMeta(META_SYNCED_AT, syncedAt);
    failureStreak = 0;
    setStatus({
      status: "idle",
      phase: null,
      syncedAt,
      error: null,
      pending: await pendingCount(),
      progress: null,
      bootstrapping: false,
    });
  } catch (error) {
    // Whatever went wrong, stop holding the interface hostage: a device that
    // cannot reach the server must still be usable, and blocking onboarding
    // forever on a failed restore would lock someone out of their own app.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus({ status: "offline", phase: null, progress: null, bootstrapping: false });
      return;
    }
    if (isOffline(error)) {
      setStatus({ status: "offline", phase: null, progress: null, bootstrapping: false });
      scheduleRetry();
      return;
    }
    setStatus({
      status: "error",
      phase: null,
      progress: null,
      bootstrapping: false,
      error: messageFor(error),
    });
    scheduleRetry();
  }
}

// ── Scheduling ───────────────────────────────────────────────────────────────

/** Retry after a failure, backing off so a broken server is not hammered. */
function scheduleRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = BACKOFF_MS[Math.min(failureStreak, BACKOFF_MS.length - 1)];
  failureStreak += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (userId && !isPaused()) void serialize(reconcile);
  }, delay);
}

/** Clear the debounce pair. */
function clearPushTimers(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer);
    maxWaitTimer = null;
  }
}

/** Fire a push now, cancelling any pending debounce. */
function flushPush(): void {
  clearPushTimers();
  if (!userId || isPaused()) return;
  void serialize(async () => {
    try {
      await push();
      const syncedAt = new Date().toISOString();
      await writeMeta(META_SYNCED_AT, syncedAt);
      failureStreak = 0;
      setStatus({
        status: "idle",
        phase: null,
        syncedAt,
        error: null,
        pending: await pendingCount(),
      });
    } catch (error) {
      if (isOffline(error)) {
        setStatus({ status: "offline", phase: null });
      } else {
        setStatus({ status: "error", phase: null, error: messageFor(error) });
      }
      scheduleRetry();
    }
  });
}

/**
 * Schedule a push after local activity settles.
 *
 * The ceiling is the important half: activity that never settles still gets
 * pushed, on a predictable cadence, instead of waiting indefinitely.
 */
function schedulePush(): void {
  if (!userId || isPaused()) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushPush, PUSH_DEBOUNCE_MS);

  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(flushPush, PUSH_MAX_WAIT_MS);
  }

  void pendingCount().then((pending) => setStatus({ pending }));
}

/** Install window-level listeners once per page load. */
function installLifecycle(): void {
  if (lifecycleInstalled || typeof window === "undefined") return;
  lifecycleInstalled = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !userId || isPaused()) return;
    void serialize(reconcile);
  });

  window.addEventListener("online", () => {
    if (!userId || isPaused()) return;
    failureStreak = 0;
    void serialize(reconcile);
  });

  window.addEventListener("offline", () => {
    if (userId) setStatus({ status: "offline", phase: null });
  });

  // A last push on the way out. Best effort by nature — whatever does not make
  // it stays flagged and goes out on the next visit, which is exactly what the
  // dirty flags are for.
  window.addEventListener("pagehide", () => {
    if (!userId || isPaused()) return;
    clearPushTimers();
    void push().catch(() => undefined);
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/** Describe this browser in terms a person recognizes in a device list. */
export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";

  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "this device";

  return `${browser} on ${os}`;
}

/**
 * Start syncing for an account.
 *
 * Safe to call repeatedly; a second call for the same account does nothing.
 *
 * @param nextUserId - Account to sync.
 */
export async function attach(nextUserId: string): Promise<void> {
  if (userId === nextUserId) return;
  if (userId) detach();

  userId = nextUserId;
  installTracking();
  installLifecycle();

  const syncedAt = await readMeta(META_SYNCED_AT);

  // A device that has never reconciled with this account may be about to
  // receive an existing profile. Say so up front, so the interface can hold off
  // asking for details that are already on their way.
  const firstTime = (await readMeta(META_SEEDED)) === null;

  setStatus({
    status: "idle",
    phase: null,
    error: null,
    rejected: [],
    syncedAt,
    bootstrapping: firstTime,
    pending: await pendingCount(),
  });

  unsubscribeChanges = onLocalChange(schedulePush);

  void subscribeRecords(nextUserId, (writerDevice, writerLabel) => {
    // Our own write coming back to us. Nothing to learn from it.
    if (writerDevice === deviceId()) return;
    setStatus({ lastWriter: writerLabel || null });
    if (isPaused()) return;
    void serialize(async () => {
      try {
        await pull();
        setStatus({ status: "idle", phase: null });
      } catch {
        // The periodic reconcile will pick this up.
      }
    });
  })
    .then((unsub) => {
      unsubscribeRealtime = unsub;
    })
    .catch(() => {
      // Realtime is an accelerator, not a requirement. Without it the periodic
      // reconcile still converges, just less promptly.
    });

  if (!reconcileTimer) {
    reconcileTimer = setInterval(() => {
      if (userId && !isPaused()) void serialize(reconcile);
    }, RECONCILE_MS);
  }

  await captureBackup();

  if (isPaused()) {
    setStatus({ status: "paused", phase: null, bootstrapping: false });
    return;
  }

  await serialize(reconcile);
}

/** Stop syncing. Local data and this device's bookkeeping are left intact. */
export function detach(): void {
  userId = null;

  if (unsubscribeRealtime) {
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }
  if (unsubscribeChanges) {
    unsubscribeChanges();
    unsubscribeChanges = null;
  }
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  clearPushTimers();

  // Deliberately *not* cleared: the pull cursor, the clock, and the per-row
  // stamps. Signing back in should resume, not start an argument about which
  // side is authoritative — that argument is what used to cost people data.
  setStatus({ ...initialSnapshot });
}

/** Reconcile immediately, on request. */
export async function syncNow(): Promise<void> {
  if (!userId || isPaused()) return;
  failureStreak = 0;
  await serialize(reconcile);
}

/** Whether sync is paused on this device. */
export function isPaused(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PAUSED_KEY) === "1";
}

/**
 * Pause or resume background sync on this device.
 *
 * Pausing stops the engine but changes nothing else: local edits keep being
 * tracked, so resuming sends everything that happened in between rather than
 * starting from a blank slate.
 *
 * @param paused - True to pause, false to resume.
 */
export async function setPaused(paused: boolean): Promise<void> {
  if (typeof window !== "undefined") {
    if (paused) localStorage.setItem(PAUSED_KEY, "1");
    else localStorage.removeItem(PAUSED_KEY);
  }

  if (paused) {
    clearPushTimers();
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    setStatus({ status: "paused", phase: null, progress: null });
    return;
  }

  failureStreak = 0;
  setStatus({ status: "idle" });
  if (userId) await serialize(reconcile);
}

/**
 * Re-examine every row on both sides.
 *
 * The escape hatch for a device that has drifted — it forgets the pull cursor
 * and re-offers all local rows, so both sides are compared from scratch. Unlike
 * the "upload this device" and "download from cloud" buttons it replaces, it
 * merges rather than overwrites: nothing is discarded on either end, and the
 * newer version of each individual row wins as it always does.
 */
export async function resyncEverything(): Promise<void> {
  if (!userId) return;
  failureStreak = 0;
  await serialize(async () => {
    await db.syncMeta.delete(META_CURSOR);
    await markEverythingDirty();
  });
  await serialize(reconcile);
}

/**
 * Remove this account's cloud copy.
 *
 * Local data is untouched, and sync stops rather than immediately re-uploading
 * everything — the previous engine's version of this recreated the copy within
 * a minute, which made the button a lie.
 */
export async function deleteCloudCopy(): Promise<void> {
  if (!userId) return;
  const owner = userId;

  await serialize(async () => {
    await deleteAllRecords(owner);
    await withoutTracking(async () => {
      await db.syncState.clear();
      await db.syncMeta.clear();
    });
    setStatus({ pending: 0, syncedAt: null, status: "idle", phase: null });
  });
}

/** The most recent pre-migration backup, for a manual download. */
export async function latestBackup(): Promise<string | null> {
  const row = await db.syncBackup.orderBy("createdAt").last();
  return row?.payload ?? null;
}
