/**
 * Sync Hook - Background Sync Engine
 *
 * Decides *when* data moves between this device and the cloud. The mechanics
 * of moving it live in `lib/SyncManager.ts`; this store owns the policy, the
 * status a person sees, and the conflict question when the two sides disagree.
 *
 * How it stays current:
 * - Dexie table hooks flag the snapshot dirty the moment any record changes.
 * - A localStorage interceptor covers the state that lives outside IndexedDB
 *   (saved tags, timer settings, ambience) without touching each store.
 * - A debounce pushes shortly after activity stops; a heartbeat and the
 *   page-hide event catch anything the debounce missed.
 * - A realtime subscription pulls the moment another device writes.
 *
 * Conflicts are never merged silently. When both sides moved since this device
 * last synced, the engine stops and asks, showing what each version holds.
 *
 * @fileoverview Sync scheduling, status, and conflict resolution.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

import { create } from "zustand";
import db from "@/lib/db";
import SyncManager, {
  type SnapshotSummary,
  type SyncPayload,
} from "@/lib/SyncManager";
import { pb, SYNC_COLLECTION } from "@/lib/pocketbase";
import { isProtectedLocalKey } from "@/lib/SaveManager";
import { VERSION } from "@/app/changelog/CHANGELOG";

/** Milliseconds of quiet before a change is pushed. */
const PUSH_DEBOUNCE_MS = 4000;

/** Milliseconds between safety-net flushes. */
const HEARTBEAT_MS = 60_000;

/** Coarse status shown in the UI. */
export type SyncStatus = "off" | "idle" | "busy" | "error" | "conflict";

/** Which way data is currently moving, for directional affordances. */
export type SyncDirection = "push" | "pull" | null;

/** The two candidate versions when a conflict needs a decision. */
export interface SyncConflict {
  local: SnapshotSummary;
  remote: SnapshotSummary;
  remoteRevision: number;
  remoteUpdated: string;
  remoteDeviceLabel: string;
  remotePayload: SyncPayload;
  remoteRecordId: string;
  /**
   * True when this device is meeting the account for the first time and
   * already had data of its own. There is no shared baseline in that case, so
   * neither side can be called "ahead" — only the user can decide.
   */
  firstSync: boolean;
}

interface SyncState {
  /** Account whose snapshot this device is syncing, or null when signed out. */
  userId: string | null;
  status: SyncStatus;
  direction: SyncDirection;
  /** True when local data has changed since the last successful sync. */
  dirty: boolean;
  /** Revision this device last agreed on with the cloud. */
  revision: number;
  /** ISO timestamp of the last successful sync. */
  syncedAt: string | null;
  /** Label of the device that last wrote to the cloud. */
  lastWriter: string | null;
  /** Whether background sync runs on this device. */
  auto: boolean;
  /** Message from the last failure, cleared on the next success. */
  error: string | null;
  /** Pending conflict awaiting a decision, if any. */
  conflict: SyncConflict | null;

  /** Begin syncing for an account. Idempotent. */
  attach: (userId: string) => Promise<void>;
  /** Stop syncing and forget this device's position. */
  detach: () => void;
  /** Flag local data as changed. */
  markDirty: () => void;
  /** Reconcile now, choosing push or pull as appropriate. */
  syncNow: () => Promise<void>;
  /** Upload this device's data, overwriting the cloud copy. */
  forcePush: () => Promise<void>;
  /** Download the cloud copy, overwriting this device's data. */
  forcePull: () => Promise<void>;
  /** Settle a pending conflict by keeping one side. */
  resolveConflict: (keep: "local" | "cloud") => Promise<void>;
  /** Dismiss a conflict without changing anything. Sync stays paused. */
  dismissConflict: () => void;
  /** Turn background sync on or off for this device. */
  setAuto: (auto: boolean) => void;
  /** Delete the cloud snapshot, keeping the account and local data. */
  deleteCloudCopy: () => Promise<void>;
}

// ── Engine internals ─────────────────────────────────────────────────────────
// Kept outside the store: these are side-effect handles, not rendered state.

let hooksInstalled = false;
let listenersInstalled = false;
let realtimeUnsub: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

/** Suppresses dirty-flagging while the engine itself is writing local data. */
let applying = false;

/** Serializes sync operations so two pushes never race. */
let chain: Promise<unknown> = Promise.resolve();

/** Run an operation after any in-flight sync work finishes. */
function serialize<T>(op: () => Promise<T>): Promise<T> {
  const next = chain.then(op, op);
  chain = next.catch(() => undefined);
  return next;
}

/** Turn an unknown throwable into a message worth showing. */
function messageFor(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Sync failed. It will retry automatically.";
}

/**
 * Reload after the local database has been replaced.
 *
 * Every store in the app holds its slice of IndexedDB in memory. Rather than
 * hand-refreshing each one and hoping none is missed, the engine restarts the
 * app — the timer and its settings live in localStorage and survive intact.
 */
function reloadIntoRestoredData(): void {
  if (typeof window === "undefined") return;
  window.setTimeout(() => window.location.reload(), 700);
}

export const useSync = create<SyncState>((set, get) => {
  /** Push local data up, stamping the next revision. */
  async function performPush(force: boolean): Promise<void> {
    const { userId, auto } = get();
    if (!userId) return;
    if (!force && !auto) return;

    set({ status: "busy", direction: "push", error: null });
    try {
      const local = SyncManager.readState();
      const head = await SyncManager.fetchHead(userId);

      // Someone else moved the cloud forward. Unless the user explicitly chose
      // this device, that is a question, not something to overwrite.
      if (head && head.revision > local.revision && !force) {
        await raiseConflictOrAdopt(userId, head.id);
        return;
      }

      const payload = await SyncManager.snapshot();
      const revision = Math.max(local.revision, head?.revision ?? 0) + 1;
      const record = await SyncManager.write(
        userId,
        payload,
        revision,
        head?.id ?? local.recordId,
        VERSION,
      );

      const syncedAt = new Date().toISOString();
      SyncManager.writeState({ revision, syncedAt, recordId: record.id });
      set({
        status: "idle",
        direction: null,
        dirty: false,
        revision,
        syncedAt,
        lastWriter: SyncManager.deviceLabel(),
        error: null,
      });
    } catch (error) {
      set({ status: "error", direction: null, error: messageFor(error) });
    }
  }

  /** Pull cloud data down, replacing local data. */
  async function performPull(payload?: SyncPayload, revision?: number, recordId?: string): Promise<void> {
    const { userId } = get();
    if (!userId) return;

    set({ status: "busy", direction: "pull", error: null });
    try {
      let data = payload;
      let rev = revision;
      let id = recordId;

      if (!data) {
        const record = await SyncManager.fetchRecord(userId);
        if (!record) {
          // Nothing to pull; this device becomes the source of truth.
          await performPush(true);
          return;
        }
        data = record.payload;
        rev = record.revision ?? 0;
        id = record.id;
      }

      applying = true;
      await SyncManager.apply(data);
      applying = false;

      const syncedAt = new Date().toISOString();
      SyncManager.writeState({
        revision: rev ?? 0,
        syncedAt,
        recordId: id ?? null,
      });
      set({
        status: "idle",
        direction: null,
        dirty: false,
        revision: rev ?? 0,
        syncedAt,
        conflict: null,
        error: null,
      });
      reloadIntoRestoredData();
    } catch (error) {
      applying = false;
      set({ status: "error", direction: null, error: messageFor(error) });
    }
  }

  /**
   * The cloud moved ahead. Adopt it when this device has nothing at stake,
   * otherwise stop and ask.
   *
   * @param userId - Account being synced.
   * @param knownRecordId - Remote record id, when already known.
   * @param firstSync - True when this device has never synced with this
   *   account. Signing in is not a change, so the dirty flag says nothing
   *   here — a device with its own data must always be asked, or its history
   *   would be destroyed by the act of signing in.
   */
  async function raiseConflictOrAdopt(
    userId: string,
    knownRecordId?: string,
    firstSync = false,
  ): Promise<void> {
    const record = await SyncManager.fetchRecord(userId);
    if (!record) {
      await performPush(true);
      return;
    }

    const localPayload = await SyncManager.snapshot();

    // Nothing here worth keeping: adopt the cloud without interrupting.
    if (SyncManager.isEmpty(localPayload)) {
      await performPull(record.payload, record.revision ?? 0, record.id);
      return;
    }

    // Past the first sync, a clean device is simply behind and can fast-forward.
    if (!firstSync && !get().dirty) {
      await performPull(record.payload, record.revision ?? 0, record.id);
      return;
    }

    set({
      status: "conflict",
      direction: null,
      conflict: {
        local: SyncManager.summarize(localPayload),
        remote: SyncManager.summarize(record.payload),
        remoteRevision: record.revision ?? 0,
        remoteUpdated: record.updated,
        remoteDeviceLabel: record.deviceLabel || "another device",
        remotePayload: record.payload,
        remoteRecordId: knownRecordId ?? record.id,
        firstSync,
      },
    });
  }

  /** Debounced push, called after local changes settle. */
  function schedulePush(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const { userId, auto, status } = get();
      if (!userId || !auto || status === "conflict") return;
      void serialize(() => performPush(false));
    }, PUSH_DEBOUNCE_MS);
  }

  /**
   * Watch every local write.
   *
   * Dexie hooks cover the database; the localStorage interceptor covers the
   * rest. Both run once per page load and stay installed — they only ever set
   * a flag, so they are cheap enough to leave in place after signing out.
   */
  function installChangeWatchers(): void {
    if (hooksInstalled || typeof window === "undefined") return;
    hooksInstalled = true;

    const touch = () => {
      if (applying) return;
      const { userId } = get();
      if (!userId) return;
      if (!get().dirty) set({ dirty: true });
      schedulePush();
    };

    for (const table of db.tables) {
      table.hook("creating", () => {
        touch();
      });
      table.hook("updating", () => {
        touch();
      });
      table.hook("deleting", () => {
        touch();
      });
    }

    // Saved tags, timer settings, and ambience live in localStorage rather than
    // Dexie. Intercepting the setter keeps them in sync without every store
    // having to know sync exists.
    const nativeSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = (key: string, value: string) => {
      nativeSetItem(key, value);
      if (!isProtectedLocalKey(key)) touch();
    };
  }

  /** Flush on page hide and re-check when the tab comes back. */
  function installLifecycleListeners(): void {
    if (listenersInstalled || typeof window === "undefined") return;
    listenersInstalled = true;

    window.addEventListener("pagehide", () => {
      const { userId, auto, dirty, status } = get();
      if (!userId || !auto || !dirty || status === "conflict") return;
      // Best-effort: the browser may cut this short, and the heartbeat on the
      // next visit will finish the job.
      void serialize(() => performPush(false));
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const { userId, auto, status } = get();
      if (!userId || !auto || status === "conflict") return;
      void serialize(() => get().syncNow());
    });
  }

  /** Subscribe to cloud writes from this account's other devices. */
  async function subscribeRealtime(userId: string): Promise<void> {
    if (realtimeUnsub) return;
    try {
      const unsub = await pb
        .collection(SYNC_COLLECTION)
        .subscribe("*", (event) => {
          const record = event.record as unknown as {
            device?: string;
            revision?: number;
            deviceLabel?: string;
          };
          // Ignore the echo of our own write.
          if (record.device === SyncManager.deviceId()) return;
          if ((record.revision ?? 0) <= get().revision) return;
          set({ lastWriter: record.deviceLabel ?? null });
          const { auto, status } = get();
          if (!auto || status === "conflict") return;
          void serialize(() => raiseConflictOrAdopt(userId));
        });
      realtimeUnsub = unsub;
    } catch {
      // Realtime is an accelerator, not a requirement — the heartbeat covers
      // the same ground more slowly.
    }
  }

  return {
    userId: null,
    status: "off",
    direction: null,
    dirty: false,
    revision: 0,
    syncedAt: null,
    lastWriter: null,
    auto: true,
    error: null,
    conflict: null,

    attach: async (userId) => {
      if (get().userId === userId && get().status !== "off") return;

      const local = SyncManager.readState();
      set({
        userId,
        status: "idle",
        revision: local.revision,
        syncedAt: local.syncedAt,
        auto: local.auto,
        error: null,
        conflict: null,
      });

      installChangeWatchers();
      installLifecycleListeners();
      void subscribeRealtime(userId);

      if (!heartbeat) {
        heartbeat = setInterval(() => {
          const s = get();
          if (!s.userId || !s.auto || s.status === "conflict") return;
          void serialize(() => (s.dirty ? performPush(false) : s.syncNow()));
        }, HEARTBEAT_MS);
      }

      await serialize(() => get().syncNow());
    },

    detach: () => {
      if (realtimeUnsub) {
        realtimeUnsub();
        realtimeUnsub = null;
      }
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      SyncManager.clearState();
      set({
        userId: null,
        status: "off",
        direction: null,
        dirty: false,
        revision: 0,
        syncedAt: null,
        lastWriter: null,
        error: null,
        conflict: null,
      });
    },

    markDirty: () => {
      if (!get().userId || applying) return;
      set({ dirty: true });
      schedulePush();
    },

    syncNow: async () => {
      const { userId } = get();
      if (!userId) return;

      set({ status: "busy", error: null });
      try {
        const localState = SyncManager.readState();
        const head = await SyncManager.fetchHead(userId);

        // Never synced from anywhere: this device seeds the account.
        if (!head) {
          await performPush(true);
          return;
        }

        set({ lastWriter: head.deviceLabel || null });

        // First sync on this device against an account that already has data.
        if (localState.revision === 0) {
          await raiseConflictOrAdopt(userId, head.id, true);
          return;
        }

        if (head.revision > localState.revision) {
          await raiseConflictOrAdopt(userId, head.id);
          return;
        }

        if (get().dirty || head.revision < localState.revision) {
          await performPush(false);
          return;
        }

        set({ status: "idle", direction: null });
      } catch (error) {
        set({ status: "error", direction: null, error: messageFor(error) });
      }
    },

    forcePush: async () => {
      await serialize(() => performPush(true));
    },

    forcePull: async () => {
      await serialize(() => performPull());
    },

    resolveConflict: async (keep) => {
      const conflict = get().conflict;
      if (!conflict) return;

      if (keep === "cloud") {
        set({ conflict: null });
        await serialize(() =>
          performPull(
            conflict.remotePayload,
            conflict.remoteRevision,
            conflict.remoteRecordId,
          ),
        );
        return;
      }

      // Keeping this device: adopt the cloud's revision as the baseline so the
      // push lands on top of it rather than tripping the same conflict again.
      SyncManager.writeState({
        revision: conflict.remoteRevision,
        recordId: conflict.remoteRecordId,
      });
      set({ conflict: null, revision: conflict.remoteRevision });
      await serialize(() => performPush(true));
    },

    dismissConflict: () => {
      set({ conflict: null, status: "idle" });
    },

    setAuto: (auto) => {
      SyncManager.writeState({ auto });
      set({ auto });
      if (auto) void serialize(() => get().syncNow());
    },

    deleteCloudCopy: async () => {
      const state = SyncManager.readState();
      const { userId } = get();
      if (!userId) return;
      const head = state.recordId
        ? { id: state.recordId }
        : await SyncManager.fetchHead(userId);
      if (!head) return;
      await SyncManager.wipe(head.id);
      SyncManager.writeState({ revision: 0, syncedAt: null, recordId: null });
      set({ revision: 0, syncedAt: null, dirty: true, status: "idle" });
    },
  };
});
