/**
 * Sync Registry - What Syncs, and How
 *
 * One declarative table describing every collection the engine knows about.
 * The engine itself is generic: it pulls rows, compares clocks, and writes
 * winners. Everything domain-specific — which Dexie table backs a collection,
 * which fields are dates, which fields point at another row — lives here, so
 * adding a syncable feature is a registry entry rather than an engine change.
 *
 * Two ideas do the real work:
 *
 * **Stable identity.** Local rows are keyed by an auto-incrementing number,
 * which is meaningless across devices — two phones both mint focus session 7
 * and one of them loses. Every syncable row therefore also carries a `uid`,
 * a UUID minted once and never reused. The wire format speaks only in uids.
 *
 * **Reference translation.** A milestone stores `projectId: 3`, and 3 means
 * something different on every device. On the way out, references are rewritten
 * to the target row's uid; on the way in, they are resolved back to whatever
 * local id that uid happens to have here.
 *
 * @fileoverview Declarative description of every synced collection.
 * @author BIT Focus Development Team
 * @since v0.21.0
 */

import type Dexie from "dexie";
import db from "@/lib/db";
import type { IdCache } from "./codec";

/** A row as it travels over the wire: plain JSON, uids instead of local ids. */
export type WireRow = Record<string, unknown>;

/** A row as it exists in Dexie, with real `Date` objects and numeric keys. */
export type LocalRow = Record<string, unknown>;

/** A board note's column, as stored locally: children are local note ids. */
interface BoardColumn {
  category: string;
  children: number[];
}

/** A board note's column on the wire: children are portable uids. */
interface WireBoardColumn {
  category: string;
  childUids: string[];
}

/** A reference from one collection to another, stored locally as a local id. */
export interface RefField {
  /** Field on the local row holding the target's local primary key. */
  field: string;
  /** Registry key of the collection the reference points at. */
  target: string;
  /** Field name used on the wire. Defaults to `<field>` with `Uid` appended. */
  wire?: string;
}

/** Everything the engine needs to know about one syncable collection. */
export interface SyncCollection {
  /** Logical name on the wire. Stored in `focus_records.col`. */
  key: string;
  /** The Dexie table backing it. */
  table: () => Dexie.Table<LocalRow, string | number>;
  /** Name of the local primary key field. */
  pk: string;
  /**
   * True when Dexie mints the primary key (`++id` tables).
   *
   * Tables that do not auto-generate need a key supplied on insert, and the
   * row's uid is the natural one — it is already unique and already stable.
   */
  autoKey: boolean;
  /**
   * True when the primary key doubles as a meaningful field.
   *
   * The configuration table is keyed by the user's own name, so unlike an
   * opaque row id it has to survive the round trip rather than being stripped.
   */
  pkIsData?: boolean;
  /**
   * Where the global identity lives on the local row.
   *
   * Almost always `uid`. Collections whose primary key is already a minted
   * UUID point this at the key itself rather than carrying a duplicate.
   */
  uidField: string;
  /** Fields serialized as ISO strings on the wire and revived as `Date`. */
  dates: readonly string[];
  /** Cross-collection references needing id translation. */
  refs?: readonly RefField[];
  /**
   * Apply order. Lower numbers land first, so a milestone never arrives
   * before the project it belongs to.
   */
  order: number;
  /**
   * Rows this collection never syncs, by local primary key.
   *
   * Used for scratch state that happens to live in a synced table — an
   * autosave buffer rewritten on every keystroke is device-local noise, not
   * something another device wants pushed at it.
   */
  skipKeys?: readonly (string | number)[];
  /**
   * True when the collection holds exactly one row. Singletons sync under a
   * fixed uid rather than one minted per row, so two devices that each created
   * their own config end up with one row, not two.
   */
  singleton?: boolean;
  /**
   * Rewrite references the declarative `refs` list cannot express, on the way
   * out. Mutates the wire row in place.
   */
  encode?: (wire: WireRow, cache: IdCache) => Promise<void>;
  /**
   * Reverse of `encode`, on the way in. Mutates the local row in place and
   * returns the names of any references that could not be resolved yet.
   */
  decode?: (row: LocalRow, cache: IdCache) => Promise<string[]>;
}

/** Fixed uid used by singleton collections. */
export const SINGLETON_UID = "singleton";

/** The scratch scene Excalidraw rewrites continuously; never worth syncing. */
export const AUTOSAVE_SCENE_ID = "__autosave__";

/**
 * Every synced collection, in dependency order.
 *
 * Notably absent: `aiConfig`. It holds provider API keys in plaintext, and
 * keys belong to the person, not to a snapshot that travels to a server and
 * fans out to every device they have ever signed into. It stays on-device.
 */
export const COLLECTIONS: readonly SyncCollection[] = [
  {
    key: "configuration",
    table: () => db.configuration as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "name",
    autoKey: false,
    pkIsData: true,
    uidField: "uid",
    dates: ["dob"],
    order: 0,
    singleton: true,
  },
  {
    key: "focus",
    table: () => db.focus as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: true,
    uidField: "uid",
    dates: ["startTime", "endTime"],
    order: 1,
  },
  {
    key: "timeblocks",
    table: () => db.timeblocks as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: true,
    uidField: "uid",
    dates: ["startTime", "endTime"],
    order: 1,
  },
  {
    key: "rewards",
    table: () => db.rewards as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: true,
    uidField: "uid",
    dates: ["createdAt", "updatedAt"],
    order: 1,
  },
  {
    key: "discounts",
    table: () => db.discounts as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: true,
    uidField: "uid",
    dates: ["createdAt", "updatedAt"],
    order: 1,
  },
  {
    key: "notes",
    table: () => db.notes as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: true,
    uidField: "uid",
    dates: ["createdAt", "updatedAt"],
    // Notes nest inside other notes, so the reference points back at itself.
    // Two passes on apply settle any ordering the server hands us.
    refs: [{ field: "parentId", target: "notes" }],
    order: 2,
    // Board notes hold columns of child note ids. They are references like any
    // other, just buried a level deeper than the declarative `refs` list can
    // reach, so they get translated by hand.
    encode: async (wire, cache) => {
      const board = wire.boardData as BoardColumn[] | undefined;
      if (!Array.isArray(board)) return;
      const notes = COLLECTION_BY_KEY.get("notes");
      if (!notes) return;
      wire.boardData = await Promise.all(
        board.map(async (column) => {
          const children = Array.isArray(column?.children) ? column.children : [];
          const uids = await Promise.all(
            children.map((childId) => cache.uidFor(notes, childId)),
          );
          return {
            category: column?.category ?? "",
            childUids: uids.filter((uid): uid is string => Boolean(uid)),
          };
        }),
      );
    },
    decode: async (row, cache) => {
      const board = row.boardData as WireBoardColumn[] | undefined;
      if (!Array.isArray(board)) return [];
      const notes = COLLECTION_BY_KEY.get("notes");
      if (!notes) return [];
      const missing: string[] = [];
      row.boardData = await Promise.all(
        board.map(async (column) => {
          const uids = Array.isArray(column?.childUids) ? column.childUids : [];
          const ids = await Promise.all(
            uids.map(async (uid) => {
              const localId = await cache.localIdFor(notes, uid);
              if (localId === null) missing.push(uid);
              return localId;
            }),
          );
          return {
            category: column?.category ?? "",
            children: ids.filter((id): id is number => typeof id === "number"),
          };
        }),
      );
      return missing;
    },
  },
  {
    key: "projects",
    table: () => db.projects as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: true,
    uidField: "uid",
    dates: ["createdAt", "updatedAt"],
    order: 3,
  },
  {
    key: "milestones",
    table: () => db.milestones as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: true,
    uidField: "uid",
    dates: ["deadline", "createdAt", "updatedAt"],
    refs: [{ field: "projectId", target: "projects" }],
    order: 4,
  },
  {
    key: "issues",
    table: () => db.issues as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: true,
    uidField: "uid",
    dates: ["dueDate", "createdAt", "updatedAt"],
    refs: [{ field: "milestoneId", target: "milestones" }],
    order: 5,
  },
  {
    key: "excalidraw",
    table: () => db.excalidraw as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: false,
    uidField: "uid",
    dates: ["createdAt", "updatedAt"],
    order: 6,
    skipKeys: [AUTOSAVE_SCENE_ID],
  },
  {
    key: "aiChats",
    table: () => db.aiChats as unknown as Dexie.Table<LocalRow, string | number>,
    pk: "id",
    autoKey: false,
    // Chat ids are already minted with `crypto.randomUUID()`, so they are
    // globally unique on their own and need no parallel identity.
    uidField: "id",
    dates: ["createdAt", "updatedAt"],
    order: 6,
  },
];

/** Registry key used for synced browser-storage preferences. */
export const KV_COLLECTION = "kv";

/** Fast lookup by registry key. */
export const COLLECTION_BY_KEY = new Map(COLLECTIONS.map((c) => [c.key, c]));

/** Registry entries in the order they must be applied. */
export const COLLECTIONS_IN_ORDER = [...COLLECTIONS].sort(
  (a, b) => a.order - b.order,
);

/** The wire field name carrying a translated reference. */
export function wireRefName(ref: RefField): string {
  return ref.wire ?? `${ref.field}Uid`;
}

/** True when this row is excluded from sync by the collection's rules. */
export function isSkipped(col: SyncCollection, row: LocalRow): boolean {
  if (!col.skipKeys?.length) return false;
  return col.skipKeys.includes(row[col.pk] as string | number);
}
