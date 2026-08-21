/**
 * Ambience Mixer Store
 *
 * Holds the per-track mixer state (enabled flag + volume) for the sidebar
 * ambience panel. State persists to localStorage so the user's soundscape
 * survives reloads. Actual audio playback is wired up by the mixer component
 * which reads this store — the store itself stays a pure data layer.
 */

import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";
import { DEFAULT_AMBIENCE_VOLUME } from "@/lib/ambiences";

/** Mixer state for one track, keyed by ambience id. */
export interface AmbienceTrackState {
  enabled: boolean; // Whether the track is currently playing
  volume: number; // Volume 0–1
}

interface AmbienceStore {
  /** Map of ambience id → track state. Missing id means off/default. */
  tracks: Record<string, AmbienceTrackState>;
  /** Pause all selected tracks without changing their enabled state. */
  isPaused: boolean;
  /** Toggle playback for all selected tracks. */
  togglePlayback: () => void;
  /** Toggle a track on/off, seeding a default volume on first enable. */
  toggle: (id: string) => void;
  /** Set a track's volume (0–1). */
  setVolume: (id: string, volume: number) => void;
  /** Get a track's state, falling back to sensible defaults. */
  getTrack: (id: string) => AmbienceTrackState;
}

const storage: PersistStorage<AmbienceStore> = {
  getItem: (key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  setItem: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const useAmbience = create<AmbienceStore>()(
  persist(
    (set, get) => ({
      tracks: {},
      isPaused: false,
      togglePlayback: () => set((state) => ({ isPaused: !state.isPaused })),
      toggle: (id) => {
        const current = get().tracks[id];
        const next: AmbienceTrackState = current
          ? { ...current, enabled: !current.enabled }
          : { enabled: true, volume: DEFAULT_AMBIENCE_VOLUME };
        set({ tracks: { ...get().tracks, [id]: next } });
      },
      setVolume: (id, volume) => {
        const current = get().tracks[id] ?? {
          enabled: true,
          volume: DEFAULT_AMBIENCE_VOLUME,
        };
        set({
          tracks: {
            ...get().tracks,
            [id]: { ...current, volume: clamp01(volume) },
          },
        });
      },
      getTrack: (id) =>
        get().tracks[id] ?? { enabled: false, volume: DEFAULT_AMBIENCE_VOLUME },
    }),
    {
      name: "ambience-storage",
      storage,
    },
  ),
);
