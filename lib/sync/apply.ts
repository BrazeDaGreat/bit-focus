/**
 * Sync Apply - Writing Remote Changes Into Local Data
 *
 * Where incoming records meet the database. Every decision here is made one
 * row at a time, which is the whole point: the old engine could only replace
 * the entire database, so a note written on a phone and a focus session logged
 * on a laptop were a conflict, and resolving it meant deleting one of them.
 * Here they are two unrelated rows and both survive.
 *
 * The rule for a single row is small enough to state in a sentence: the version
 * with the greater clock stamp wins, and a stamp is greater only if its writer
 * had already seen everything this device had. Ties break on the writing
 * device's id, so every device independently reaches the same answer without
 * having to ask.
 *
 * Deletes are records too. A tombstone carries a stamp like anything else, so
 * "deleted on the phone" and "edited on the laptop" resolve by the same rule
 * rather than one silently winning.
 *
 * @fileoverview Conflict resolution and local writes for pulled records.
 * @author BIT Focus Development Team
 * @since v0.21.0
 */

import db, { type SyncStateRow } from "@/lib/db";
import { hlcCompare, hlcObserve } from "./hlc";
import { isSyncedKey, PERSISTED_STORE_KEYS } from "./keys";
import { IdCache, fromWire } from "./codec";
import {
  COLLECTION_BY_KEY,
  KV_COLLECTION,
  type LocalRow,
  type SyncCollection,
} from "./registry";
import { applyingRow } from "./tracker";
import type { RemoteRecord } from "./transport";

/** What changed locally as a result of applying a batch. */
export interface ApplyReport {
  /** Registry keys whose Dexie table was touched, so views can refresh. */
  touched: Set<string>;
  /** localStorage keys that changed, so persisted stores can rehydrate. */
  kvKeys: string[];
  /** Records applied. */
  applied: number;
  /** Records skipped because the local version was already newer. */
  skipped: number;
  /** Records deferred because a row they reference has not arrived yet. */
  deferred: number;
  /**
   * How many rows landed, per collection.
   *
   * Used to tell a person what was actually restored when they sign in on a
   * new device, rather than claiming something was without checking.
   */
  counts: Record<string, number>;
}

/** An empty report, used as the accumulator. */
function emptyReport(): ApplyReport {
  return {
    touched: new Set<string>(),
    kvKeys: [],
    applied: 0,
    skipped: 0,
    deferred: 0,
    counts: {},
  };
}

/**
 * Decide whether an incoming record supersedes what this device holds.
 *
 * A strictly greater stamp always wins. An equal stamp means the two devices
 * are describing the same change, so there is nothing to do.
 *
 * @param local - This device's bookkeeping for the row, if any.
 * @param remote - The incoming record.
 */
function remoteWins(local: SyncStateRow | undefined, remote: RemoteRecord): boolean {
  if (!local) return true;
  return hlcCompare(remote.hlc, local.hlc) > 0;
}

/** Locate the local row carrying a given uid. */
async function findLocal(
  col: SyncCollection,
  uid: string,
): Promise<LocalRow | undefined> {
  if (col.singleton) return col.table().toCollection().first();
  if (col.uidField === col.pk) return col.table().get(uid);
  return col.table().where(col.uidField).equals(uid).first();
}

/**
 * Write one decoded row into its table, preserving whatever local key it has.
 *
 * @param col - Registry entry for the collection.
 * @param uid - Stable identity of the row.
 * @param row - Decoded row, without a primary key.
 * @param cache - Batch translation cache, updated with the resulting key.
 */
async function writeRow(
  col: SyncCollection,
  uid: string,
  row: LocalRow,
  cache: IdCache,
): Promise<void> {
  const table = col.table();
  const existing = await findLocal(col, uid);

  // A singleton is one row by definition. If the incoming version keys on a
  // different name than the local one, the old row is replaced rather than
  // left behind as a second config nobody reads.
  if (col.singleton && existing && existing[col.pk] !== row[col.pk]) {
    await table.delete(existing[col.pk] as string | number);
  }

  if (existing && !col.singleton) {
    row[col.pk] = existing[col.pk];
    await table.put(row);
    cache.remember(col, uid, existing[col.pk] as string | number);
    return;
  }

  if (col.autoKey) {
    delete row[col.pk];
    const key = await table.add(row);
    cache.remember(col, uid, key as string | number);
    return;
  }

  // Tables that do not mint their own keys take the uid, unless the key is a
  // real field that arrived with the payload.
  if (!col.pkIsData) row[col.pk] = uid;
  await table.put(row);
  cache.remember(col, uid, row[col.pk] as string | number);
}

/** Remove the local row a tombstone refers to. */
async function deleteRow(col: SyncCollection, uid: string): Promise<void> {
  const existing = await findLocal(col, uid);
  if (!existing) return;
  await col.table().delete(existing[col.pk] as string | number);
}

/** Apply a preference record to browser storage. */
function applyKv(record: RemoteRecord): string | null {
  if (typeof window === "undefined") return null;
  const key = record.uid;
  if (!isSyncedKey(key)) return null;

  if (record.deleted) {
    localStorage.removeItem(key);
    return key;
  }

  const value = (record.data as { value?: unknown } | null)?.value;
  if (typeof value !== "string") return null;
  localStorage.setItem(key, value);
  return key;
}

/**
 * Apply a batch of pulled records to local data.
 *
 * Records are grouped by collection and applied parents-first, so a milestone
 * lands after the project it belongs to. Anything still pointing at a row that
 * has not arrived is retried once at the end; whatever remains unresolved is
 * reported rather than guessed at, and settles on a later pull.
 *
 * @param records - Records from the server, in any order.
 * @returns What changed, for refreshing the interface.
 */
export async function applyRecords(records: RemoteRecord[]): Promise<ApplyReport> {
  const report = emptyReport();
  if (records.length === 0) return report;

  // Fold every stamp we have seen into this device's clock before writing
  // anything, so a local edit made a moment from now sorts after all of them.
  for (const record of records) hlcObserve(record.hlc);

  const cache = new IdCache();
  const deferred: RemoteRecord[] = [];

  // Newest-first within a row, so a row that appears twice in one batch is
  // written once, at its final state.
  const latest = new Map<string, RemoteRecord>();
  for (const record of records) {
    const key = `${record.col} ${record.uid}`;
    const seen = latest.get(key);
    if (!seen || hlcCompare(record.hlc, seen.hlc) > 0) latest.set(key, record);
  }

  const ordered = [...latest.values()].sort((a, b) => {
    const left = COLLECTION_BY_KEY.get(a.col)?.order ?? 99;
    const right = COLLECTION_BY_KEY.get(b.col)?.order ?? 99;
    if (left !== right) return left - right;
    return hlcCompare(a.hlc, b.hlc);
  });

  for (const record of ordered) {
    const applied = await applyOne(record, cache, report);
    if (applied === "deferred") deferred.push(record);
  }

  // Second pass: by now every row in this batch exists, so references that
  // pointed forwards can be resolved.
  for (const record of deferred) {
    const result = await applyOne(record, cache, report, true);
    if (result === "deferred") report.deferred += 1;
  }

  return report;
}

/** Apply a single record. Returns how it was handled. */
async function applyOne(
  record: RemoteRecord,
  cache: IdCache,
  report: ApplyReport,
  finalPass = false,
): Promise<"applied" | "skipped" | "deferred"> {
  const stateKey: [string, string] = [record.col, record.uid];
  const local = await db.syncState.get(stateKey);

  if (!remoteWins(local, record)) {
    report.skipped += 1;
    return "skipped";
  }

  if (record.col === KV_COLLECTION) {
    const key = await applyingRow(record.col, record.uid, async () =>
      applyKv(record),
    );
    if (key) report.kvKeys.push(key);
    await db.syncState.put({
      col: record.col,
      uid: record.uid,
      hlc: record.hlc,
      dirty: 0,
      deleted: record.deleted ? 1 : 0,
    });
    report.applied += 1;
    return "applied";
  }

  const col = COLLECTION_BY_KEY.get(record.col);
  if (!col) {
    // A collection this build does not know about — almost certainly a newer
    // version of the app writing a feature that does not exist here yet. Left
    // strictly alone: not applied, not acknowledged, and above all not deleted,
    // so upgrading later picks it up intact.
    report.skipped += 1;
    return "skipped";
  }

  if (record.deleted) {
    await applyingRow(record.col, record.uid, () => deleteRow(col, record.uid));
  } else {
    const decoded = await fromWire(col, record.data ?? {}, record.uid, cache);
    if (decoded.unresolved.length > 0 && !finalPass) return "deferred";
    await applyingRow(record.col, record.uid, () =>
      writeRow(col, record.uid, decoded.row, cache),
    );
  }

  await db.syncState.put({
    col: record.col,
    uid: record.uid,
    hlc: record.hlc,
    dirty: 0,
    deleted: record.deleted ? 1 : 0,
  });

  report.touched.add(record.col);
  if (!record.deleted) {
    report.counts[record.col] = (report.counts[record.col] ?? 0) + 1;
  }
  report.applied += 1;
  return "applied";
}

/**
 * Tell `persist`-backed stores that their key changed underneath them.
 *
 * Writing localStorage directly does not reach a store that already hydrated,
 * so without this a tag added on another device would sit in storage unread
 * until the next reload. Rehydrating is what makes the change simply appear.
 *
 * @param changedKeys - localStorage keys that were written.
 */
export async function rehydratePersistedStores(
  changedKeys: readonly string[],
): Promise<void> {
  const relevant = changedKeys.filter((key) =>
    PERSISTED_STORE_KEYS.includes(key),
  );
  if (relevant.length === 0) return;

  // Imported lazily and individually so the sync layer never becomes a
  // dependency of the feature stores it is refreshing.
  const rehydrations: Promise<unknown>[] = [];

  if (relevant.includes("tag-storage")) {
    rehydrations.push(
      import("@/hooks/useTag").then((m) => m.useTag.persist.rehydrate()),
    );
  }
  if (relevant.includes("ambience-storage")) {
    rehydrations.push(
      import("@/hooks/useAmbience").then((m) => m.useAmbience.persist.rehydrate()),
    );
  }
  if (relevant.includes("notepad-storage")) {
    rehydrations.push(
      import("@/hooks/useNotepad").then((m) => m.useNotepad.persist.rehydrate()),
    );
  }

  await Promise.allSettled(rehydrations);
}
