/**
 * Sync Codec - Translation Between Local Rows and Wire Rows
 *
 * A row in IndexedDB and the same row on the server are not the same shape,
 * and the difference is the whole reason cross-device sync is harder than it
 * looks. Locally a milestone says `projectId: 3`. On another device, project 3
 * is somebody else's project, or nothing at all. Shipping that number is how
 * data quietly attaches itself to the wrong parent.
 *
 * So the wire format speaks only in uids, and every reference is translated in
 * both directions. Dates become ISO strings, local primary keys are dropped
 * entirely, and on the way back in a reference that cannot be resolved *yet*
 * is reported rather than guessed at — the engine retries it on the next pass,
 * once its parent has landed.
 *
 * @fileoverview Row serialization, reference translation, and date handling.
 * @author BIT Focus Development Team
 * @since v0.21.0
 */

import {
  COLLECTION_BY_KEY,
  SINGLETON_UID,
  wireRefName,
  type LocalRow,
  type SyncCollection,
  type WireRow,
} from "./registry";

/**
 * Cache of id translations for one batch.
 *
 * A pull of 200 issues would otherwise hit the milestones table 200 times.
 * Scoped to a single operation so it can never serve a stale mapping.
 */
export class IdCache {
  private toUid = new Map<string, string | null>();
  private toLocal = new Map<string, string | number | null>();

  /** Resolve a local primary key to the row's stable uid. */
  async uidFor(col: SyncCollection, localId: unknown): Promise<string | null> {
    if (localId === null || localId === undefined || localId === "") return null;
    const cacheKey = `${col.key}:${String(localId)}`;
    if (this.toUid.has(cacheKey)) return this.toUid.get(cacheKey) ?? null;

    const row = await col.table().get(localId as string | number);
    const uid = (row?.[col.uidField] as string | undefined) ?? null;
    this.toUid.set(cacheKey, uid);
    return uid;
  }

  /** Resolve a stable uid to whatever local primary key it has on this device. */
  async localIdFor(
    col: SyncCollection,
    uid: unknown,
  ): Promise<string | number | null> {
    if (typeof uid !== "string" || uid === "") return null;

    // When the primary key *is* the identity, no lookup is needed.
    if (col.uidField === col.pk) return uid;

    const cacheKey = `${col.key}:${uid}`;
    if (this.toLocal.has(cacheKey)) return this.toLocal.get(cacheKey) ?? null;

    const row = await col.table().where(col.uidField).equals(uid).first();
    const localId = (row?.[col.pk] as string | number | undefined) ?? null;
    this.toLocal.set(cacheKey, localId);
    return localId;
  }

  /** Drop a memoized mapping after a row is written, so later lookups see it. */
  remember(col: SyncCollection, uid: string, localId: string | number): void {
    this.toLocal.set(`${col.key}:${uid}`, localId);
    this.toUid.set(`${col.key}:${String(localId)}`, uid);
  }
}

/** Serialize a value that may be a `Date`, an ISO string, or absent. */
function dateOut(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (typeof value === "number") return new Date(value).toISOString();
  return null;
}

/** Revive a serialized date, preserving the difference between null and absent. */
function dateIn(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** The uid a row travels under. Singletons share one; everything else has its own. */
export function uidOf(col: SyncCollection, row: LocalRow): string | null {
  if (col.singleton) return SINGLETON_UID;
  const uid = row[col.uidField];
  return typeof uid === "string" && uid ? uid : null;
}

/**
 * Convert a local row into its wire form.
 *
 * @param col - Registry entry for the row's collection.
 * @param row - The row as stored in Dexie.
 * @param cache - Batch-scoped translation cache.
 * @returns JSON-safe row with uids in place of local references.
 */
export async function toWire(
  col: SyncCollection,
  row: LocalRow,
  cache: IdCache,
): Promise<WireRow> {
  const out: WireRow = { ...row };

  // The local primary key is meaningless elsewhere, so it does not travel —
  // except where the key is also a real field, like the configuration table
  // keyed by the user's own name.
  if (!col.pkIsData) delete out[col.pk];
  delete out[col.uidField];

  for (const field of col.dates) {
    if (field in out) {
      const encoded = dateOut(out[field]);
      if (encoded === undefined) delete out[field];
      else out[field] = encoded;
    }
  }

  for (const ref of col.refs ?? []) {
    const target = COLLECTION_BY_KEY.get(ref.target);
    const localValue = out[ref.field];
    delete out[ref.field];
    if (!target) continue;
    const uid = await cache.uidFor(target, localValue);
    if (uid) out[wireRefName(ref)] = uid;
  }

  if (col.encode) await col.encode(out, cache);

  return out;
}

/** What `fromWire` produces, including references it could not resolve yet. */
export interface DecodedRow {
  /** The row ready to be written to Dexie, minus its primary key. */
  row: LocalRow;
  /**
   * References that pointed at a row this device has not seen yet.
   *
   * The engine retries these on a later pass rather than dropping the link or
   * inventing one — a note whose parent has not arrived is temporarily
   * top-level, not permanently orphaned.
   */
  unresolved: string[];
}

/**
 * Convert a wire row back into local shape.
 *
 * @param col - Registry entry for the row's collection.
 * @param wire - Row as received from the server.
 * @param uid - The row's stable identity.
 * @param cache - Batch-scoped translation cache.
 */
export async function fromWire(
  col: SyncCollection,
  wire: WireRow,
  uid: string,
  cache: IdCache,
): Promise<DecodedRow> {
  const row: LocalRow = { ...wire };
  const unresolved: string[] = [];

  for (const field of col.dates) {
    if (field in row) {
      const revived = dateIn(row[field]);
      if (revived === undefined) delete row[field];
      else row[field] = revived;
    }
  }

  for (const ref of col.refs ?? []) {
    const wireField = wireRefName(ref);
    const targetUid = row[wireField];
    delete row[wireField];

    const target = COLLECTION_BY_KEY.get(ref.target);
    if (!target || typeof targetUid !== "string" || !targetUid) {
      row[ref.field] = null;
      continue;
    }

    const localId = await cache.localIdFor(target, targetUid);
    if (localId === null) {
      row[ref.field] = null;
      unresolved.push(wireField);
    } else {
      row[ref.field] = localId;
    }
  }

  if (col.decode) {
    const missing = await col.decode(row, cache);
    if (missing?.length) unresolved.push(...missing);
  }

  // Identity always comes from the record envelope, never from the payload,
  // so a malformed body can never rename a row out from under its history.
  if (col.uidField === col.pk) {
    row[col.pk] = uid;
  } else {
    row[col.uidField] = uid;
    if (!col.pkIsData) delete row[col.pk];
  }

  return { row, unresolved };
}
