/**
 * Sync Key Policy - What Browser Storage Travels
 *
 * Most of the app's state lives in IndexedDB, but preferences do not: saved
 * tags, the ambience mixer, reward points and Pomodoro settings all sit in
 * localStorage. Those should follow a person between devices.
 *
 * Some things in there must never move. A session token belongs to one
 * browser. Sync's own bookkeeping describes this device's position and would
 * be nonsense anywhere else. And live timer state — the seconds ticking on a
 * running session — is the clearest case of all: the previous sync engine
 * shipped it, so a timer running on a laptop would reach across and reset the
 * one running on a phone, then reload the page to be sure.
 *
 * The policy is a deny list rather than an allow list, deliberately: a new
 * preference added next year should sync without anyone remembering to come
 * back here, while the small, well-understood set of device-owned keys stays
 * pinned in place.
 *
 * @fileoverview Classification of localStorage keys for sync.
 * @author BIT Focus Development Team
 * @since v0.21.0
 */

import { PB_AUTH_STORAGE_KEY } from "@/lib/pocketbase";

/**
 * Prefix owned by the sync engine itself.
 *
 * Everything under it — the clock, the device identity, the pull cursor —
 * describes where *this* browser stands and is meaningless on another.
 */
export const SYNC_KEY_PREFIX = "bitfocus.sync.";

/**
 * Keys that describe this device rather than this person.
 *
 * Live timer fields are here because they are a running measurement, not a
 * setting: two devices may legitimately have different ones at the same
 * moment, and overwriting either is data loss in miniature.
 */
const DEVICE_LOCAL_KEYS: readonly string[] = [
  PB_AUTH_STORAGE_KEY,
  // Live timer position and phase — see above.
  "pomoTime",
  "pomoPhase",
  "timerMode",
  // Picture-in-Picture mirror of the timer, rewritten several times a second.
  "piptimer",
  // Where a floating window sits on *this* screen.
  "notepad-window-position",
  // Superseded bookkeeping from the snapshot-era engine.
  "bitfocus.sync.state",
  "bitfocus.sync.device",
];

/**
 * Whether a key stays on this device.
 *
 * @param key - localStorage key being considered.
 */
export function isDeviceLocalKey(key: string): boolean {
  return key.startsWith(SYNC_KEY_PREFIX) || DEVICE_LOCAL_KEYS.includes(key);
}

/**
 * Whether a key participates in sync.
 *
 * @param key - localStorage key being considered.
 */
export function isSyncedKey(key: string): boolean {
  return !isDeviceLocalKey(key);
}

/**
 * Zustand `persist` stores that must be told when their key changed underneath
 * them, keyed by the localStorage key they own.
 *
 * Applying a remote preference writes localStorage directly; without this the
 * store would keep serving the value it hydrated with at page load. Rehydrating
 * is what lets a tag added on a phone appear on a laptop without a reload.
 */
export const PERSISTED_STORE_KEYS: readonly string[] = [
  "tag-storage",
  "ambience-storage",
  "notepad-storage",
];

/** Every localStorage key currently eligible for sync. */
export function syncedKeys(): string[] {
  if (typeof window === "undefined") return [];
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isSyncedKey(key)) out.push(key);
  }
  return out;
}
