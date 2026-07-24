/**
 * Sync Manager - Cloud Snapshot Read/Write Primitives
 *
 * The data layer under account sync. BIT Focus stores a modest amount of data,
 * so rather than mirroring every table into its own remote collection, the
 * whole application state travels as a single JSON snapshot in one
 * `focus_sync` record per user. One record means one revision number, which
 * means conflicts are a comparison rather than a merge.
 *
 * This module is deliberately free of React and of policy: it reads, writes,
 * summarizes, and remembers where the device last left off. When to do any of
 * that is decided by the sync engine in `hooks/useSync.ts`.
 *
 * @fileoverview Snapshot capture, restore, remote I/O, and device bookkeeping.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

import SaveManager, { type ExportedData } from "./SaveManager";
import { pb, SYNC_COLLECTION } from "./pocketbase";
import type { RecordModel } from "pocketbase";

/** localStorage key holding this device's stable identity. */
const DEVICE_KEY = "bitfocus.sync.device";

/** localStorage key holding where this device last left off. */
const STATE_KEY = "bitfocus.sync.state";

/** The application snapshot shipped to and from the backend. */
export type SyncPayload = ExportedData;

/** A `focus_sync` record as returned by PocketBase. */
export interface SyncRecord extends RecordModel {
  user: string;
  payload: SyncPayload;
  revision: number;
  device: string;
  deviceLabel: string;
  appVersion: string;
  updated: string;
}

/** Lightweight remote head, fetched without pulling the payload down. */
export interface RemoteHead {
  id: string;
  revision: number;
  updated: string;
  device: string;
  deviceLabel: string;
}

/** Where this device believes it left off. Persisted across reloads. */
export interface LocalSyncState {
  /** Revision this device last successfully pushed or pulled. */
  revision: number;
  /** ISO timestamp of that last successful sync, or null if never. */
  syncedAt: string | null;
  /** Cached remote record id, so pushes skip a lookup. */
  recordId: string | null;
  /** Whether background sync is switched on for this device. */
  auto: boolean;
}

const DEFAULT_STATE: LocalSyncState = {
  revision: 0,
  syncedAt: null,
  recordId: null,
  auto: true,
};

/** Counts describing a snapshot, used to make a conflict choice informed. */
export interface SnapshotSummary {
  focusSessions: number;
  projects: number;
  notes: number;
  drawings: number;
  chats: number;
  timeblocks: number;
  /** Approximate serialized size in bytes. */
  bytes: number;
  /** Most recent activity found anywhere in the snapshot, if any. */
  lastActivity: Date | null;
}

/**
 * Describe the current browser in a way a person recognizes in a device list.
 *
 * Deliberately coarse — "Chrome on Windows" is enough to tell two devices
 * apart, and nothing finer is needed.
 */
function detectDeviceLabel(): string {
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

class SyncManager {
  // ── Device identity ──────────────────────────────────────────────────────

  /**
   * Stable identifier for this browser profile.
   *
   * Generated once and kept in localStorage. It exists so a device can tell
   * "the cloud moved because of me" from "the cloud moved because of my
   * phone", and never leaves the user's own records.
   */
  static deviceId(): string {
    if (typeof window === "undefined") return "server";
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string };
        if (parsed.id) return parsed.id;
      }
    } catch {
      // Corrupt entry: fall through and mint a fresh identity.
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 24)
        : Math.random().toString(36).slice(2, 14);
    localStorage.setItem(
      DEVICE_KEY,
      JSON.stringify({ id, label: detectDeviceLabel() }),
    );
    return id;
  }

  /** Human-readable name for this device. */
  static deviceLabel(): string {
    if (typeof window === "undefined") return "Server";
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { label?: string };
        if (parsed.label) return parsed.label;
      }
    } catch {
      // Fall through to a freshly detected label.
    }
    return detectDeviceLabel();
  }

  // ── Local bookkeeping ────────────────────────────────────────────────────

  /** Read this device's sync position, falling back to defaults. */
  static readState(): LocalSyncState {
    if (typeof window === "undefined") return { ...DEFAULT_STATE };
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<LocalSyncState>) };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  /** Merge a patch into this device's sync position. */
  static writeState(patch: Partial<LocalSyncState>): LocalSyncState {
    const next = { ...SyncManager.readState(), ...patch };
    if (typeof window !== "undefined") {
      localStorage.setItem(STATE_KEY, JSON.stringify(next));
    }
    return next;
  }

  /** Forget this device's sync position, e.g. after signing out. */
  static clearState(): void {
    if (typeof window !== "undefined") localStorage.removeItem(STATE_KEY);
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────

  /** Capture the full application state as a portable snapshot. */
  static async snapshot(): Promise<SyncPayload> {
    return SaveManager.exportJSON();
  }

  /** Replace all local application state with a snapshot. */
  static async apply(payload: SyncPayload): Promise<void> {
    await SaveManager.importJSON(payload);
  }

  /**
   * Summarize a snapshot for display.
   *
   * Used by the conflict dialog, where the choice between two versions is only
   * meaningful if the person can see what each one holds.
   *
   * @param payload - Snapshot to describe, from either side of a conflict.
   */
  static summarize(payload: SyncPayload | null | undefined): SnapshotSummary {
    const empty: SnapshotSummary = {
      focusSessions: 0,
      projects: 0,
      notes: 0,
      drawings: 0,
      chats: 0,
      timeblocks: 0,
      bytes: 0,
      lastActivity: null,
    };
    if (!payload?.indexedDB) return empty;

    const idb = payload.indexedDB;
    const times: number[] = [];

    // Newest timestamp anywhere decides how recently this snapshot was lived
    // in — the one fact that tells "my current data" from "a stale copy".
    const note = (value: string | undefined) => {
      if (!value) return;
      const t = Date.parse(value);
      if (!Number.isNaN(t)) times.push(t);
    };

    for (const f of idb.focus ?? []) note(f.endTime);
    for (const n of idb.notes ?? []) note(n.updatedAt);
    for (const p of idb.projects ?? []) note(p.updatedAt);
    for (const m of idb.milestones ?? []) note(m.updatedAt);
    for (const i of idb.issues ?? []) note(i.updatedAt);
    for (const e of idb.excalidraw ?? []) note(e.updatedAt);
    for (const c of idb.aiChats ?? []) note(c.updatedAt);
    for (const t of idb.timeblocks ?? []) note(t.endTime);

    let bytes = 0;
    try {
      bytes = JSON.stringify(payload).length;
    } catch {
      bytes = 0;
    }

    return {
      focusSessions: idb.focus?.length ?? 0,
      projects: idb.projects?.length ?? 0,
      notes: idb.notes?.length ?? 0,
      drawings: idb.excalidraw?.length ?? 0,
      chats: idb.aiChats?.length ?? 0,
      timeblocks: idb.timeblocks?.length ?? 0,
      bytes,
      lastActivity: times.length ? new Date(Math.max(...times)) : null,
    };
  }

  /**
   * Whether a snapshot is effectively blank.
   *
   * A device with nothing worth keeping can adopt the cloud copy without
   * asking, which is what makes signing in on a second device a single step.
   */
  static isEmpty(payload: SyncPayload | null | undefined): boolean {
    const s = SyncManager.summarize(payload);
    return (
      s.focusSessions === 0 &&
      s.projects === 0 &&
      s.notes === 0 &&
      s.drawings === 0 &&
      s.chats === 0 &&
      s.timeblocks === 0
    );
  }

  // ── Remote I/O ───────────────────────────────────────────────────────────

  /**
   * Read the remote revision without downloading the payload.
   *
   * @param userId - Owner of the snapshot.
   * @returns The remote head, or null when the account has never synced.
   */
  static async fetchHead(userId: string): Promise<RemoteHead | null> {
    try {
      const record = await pb
        .collection(SYNC_COLLECTION)
        .getFirstListItem<SyncRecord>(`user = "${userId}"`, {
          fields: "id,revision,updated,device,deviceLabel",
        });
      return {
        id: record.id,
        revision: record.revision ?? 0,
        updated: record.updated,
        device: record.device ?? "",
        deviceLabel: record.deviceLabel ?? "",
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * Download the full remote snapshot.
   *
   * @param userId - Owner of the snapshot.
   * @returns The record, or null when the account has never synced.
   */
  static async fetchRecord(userId: string): Promise<SyncRecord | null> {
    try {
      return await pb
        .collection(SYNC_COLLECTION)
        .getFirstListItem<SyncRecord>(`user = "${userId}"`);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * Write a snapshot to the backend, creating the record on first sync.
   *
   * @param userId - Owner of the snapshot.
   * @param payload - Snapshot to store.
   * @param revision - Revision number to stamp on the write.
   * @param recordId - Known record id, when the caller already has one.
   * @param appVersion - App version that produced the snapshot.
   */
  static async write(
    userId: string,
    payload: SyncPayload,
    revision: number,
    recordId: string | null,
    appVersion: string,
  ): Promise<SyncRecord> {
    const body = {
      user: userId,
      payload,
      revision,
      device: SyncManager.deviceId(),
      deviceLabel: SyncManager.deviceLabel(),
      appVersion,
    };

    if (recordId) {
      return await pb
        .collection(SYNC_COLLECTION)
        .update<SyncRecord>(recordId, body);
    }
    return await pb.collection(SYNC_COLLECTION).create<SyncRecord>(body);
  }

  /** Delete the cloud snapshot, leaving the account and local data intact. */
  static async wipe(recordId: string): Promise<void> {
    await pb.collection(SYNC_COLLECTION).delete(recordId);
  }
}

/** PocketBase reports "no matching record" as a 404. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}

export default SyncManager;
