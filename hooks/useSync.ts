/**
 * Sync Hook - Reactive View of the Sync Engine
 *
 * A thin, deliberately dumb bridge. The engine in `lib/sync/engine.ts` owns all
 * scheduling and reconciliation and runs whether or not React is mounted; this
 * store simply mirrors its published status so components can read it.
 *
 * Keeping policy out of here is the point. The previous version of this file
 * held the entire engine — timers, conflict rules, snapshot handling — inside a
 * Zustand closure, which made every decision reachable from any component and
 * gave the two of them one shared, mutable idea of what "syncing" meant.
 *
 * @fileoverview Reactive sync status for the interface.
 * @author BIT Focus Development Team
 * @since v0.19.0
 * @updated v0.21.0 - Rebuilt on the per-record sync engine.
 */

import { create } from "zustand";
import {
  attach as engineAttach,
  currentSnapshot,
  deleteCloudCopy as engineDeleteCloudCopy,
  detach as engineDetach,
  isPaused,
  latestBackup,
  onStatus,
  resyncEverything as engineResyncEverything,
  setPaused as engineSetPaused,
  syncNow as engineSyncNow,
  type SyncPhase,
  type SyncSnapshot,
  type SyncStatus,
} from "@/lib/sync/engine";

export type { SyncStatus, SyncPhase, SyncSnapshot };

interface SyncStore extends SyncSnapshot {
  /** Account currently being synced, or null when signed out. */
  userId: string | null;
  /** True when background sync is paused on this device. */
  paused: boolean;
  /** Begin syncing for an account. Idempotent. */
  attach: (userId: string) => Promise<void>;
  /** Stop syncing. Local data stays exactly as it is. */
  detach: () => void;
  /** Reconcile now, on request. */
  syncNow: () => Promise<void>;
  /** Pause or resume background sync on this device. */
  setPaused: (paused: boolean) => Promise<void>;
  /** Compare every row on both sides again, merging rather than overwriting. */
  resyncEverything: () => Promise<void>;
  /** Remove the cloud copy, keeping the account and local data. */
  deleteCloudCopy: () => Promise<void>;
  /** Fetch the pre-migration backup as JSON text, if one was taken. */
  getBackup: () => Promise<string | null>;
}

export const useSync = create<SyncStore>((set) => {
  // The engine outlives any component, so the subscription is set up once at
  // module scope rather than in an effect that could tear it down on unmount.
  onStatus((next) => set({ ...next }));

  return {
    ...currentSnapshot(),
    userId: null,
    paused: isPaused(),

    attach: async (userId) => {
      set({ userId });
      await engineAttach(userId);
    },

    detach: () => {
      engineDetach();
      set({ userId: null });
    },

    syncNow: async () => {
      await engineSyncNow();
    },

    setPaused: async (paused) => {
      set({ paused });
      await engineSetPaused(paused);
    },

    resyncEverything: async () => {
      await engineResyncEverything();
    },

    deleteCloudCopy: async () => {
      await engineDeleteCloudCopy();
    },

    getBackup: () => latestBackup(),
  };
});
