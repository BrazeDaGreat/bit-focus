/**
 * Sync Refresh - Bringing the Interface Up to Date
 *
 * When remote changes land in IndexedDB, the stores holding that data in memory
 * do not know. The previous engine solved this by reloading the page — which
 * worked, in the sense that a sledgehammer works: it also interrupted whatever
 * the person was doing, and with a running timer pushing changes on a timer of
 * its own, it did so repeatedly.
 *
 * The fix is unglamorous. Each store already knows how to load its own slice;
 * this maps the collections that changed onto those loaders and calls them.
 * Only what actually changed is reloaded, and the page never moves.
 *
 * Stores are imported lazily so the sync layer stays a leaf of the dependency
 * graph rather than a hub every feature has to route through.
 *
 * @fileoverview Store refresh dispatch after remote changes land.
 * @author BIT Focus Development Team
 * @since v0.21.0
 */

import type { ApplyReport } from "./apply";

/** Reload one store's slice, keyed by the collections that feed it. */
type Reloader = () => Promise<unknown>;

/** Registry key to the store loaders that read it. */
const RELOADERS: Record<string, Reloader> = {
  configuration: () =>
    import("@/hooks/useConfig").then((m) => m.useConfig.getState().loadConfig()),
  focus: () =>
    import("@/hooks/useFocus").then((m) =>
      m.useFocus.getState().loadFocusSessions(),
    ),
  timeblocks: () =>
    import("@/hooks/useTimeblocks").then((m) =>
      m.useTimeblocks.getState().loadTimeblocks(),
    ),
  rewards: () =>
    import("@/hooks/useRewards").then((m) => m.useRewards.getState().loadRewards()),
  discounts: () =>
    import("@/hooks/useRewards").then((m) => m.useRewards.getState().loadRewards()),
  notes: () =>
    import("@/hooks/useNotes").then((m) => m.useNotes.getState().loadNotes()),
  projects: () =>
    import("@/hooks/useProjects").then((m) =>
      m.useProjects.getState().loadProjects(),
    ),
  milestones: () =>
    import("@/hooks/useProjects").then((m) =>
      m.useProjects.getState().loadProjects(),
    ),
  issues: () =>
    import("@/hooks/useProjects").then((m) =>
      m.useProjects.getState().loadProjects(),
    ),
  excalidraw: () =>
    import("@/hooks/useExcalidraw").then((m) =>
      m.useExcalidraw.getState().loadScenes(),
    ),
  aiChats: () =>
    import("@/hooks/useAIChat").then((m) => m.useAIChat.getState().loadChats()),
};

/** localStorage keys whose owning store needs a nudge beyond rehydration. */
const KV_RELOADERS: Record<string, Reloader> = {
  rewardPoints: () =>
    import("@/hooks/useRewards").then((m) =>
      Promise.resolve(m.useRewards.getState().initializePoints()),
    ),
};

/**
 * Reload the stores affected by a batch of applied changes.
 *
 * Each loader runs at most once per batch even when several collections feed
 * it, and a failure in one never blocks the others.
 *
 * @param report - What the apply pass changed.
 */
export async function refreshStores(report: ApplyReport): Promise<void> {
  const pending = new Set<Reloader>();

  for (const col of report.touched) {
    const reloader = RELOADERS[col];
    if (reloader) pending.add(reloader);
  }
  for (const key of report.kvKeys) {
    const reloader = KV_RELOADERS[key];
    if (reloader) pending.add(reloader);
  }

  if (pending.size === 0) return;
  await Promise.allSettled([...pending].map((reload) => reload()));
}
