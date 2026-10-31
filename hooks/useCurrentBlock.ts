"use client";

/**
 * What the plan says right now: the running timeblock, the next one, and how
 * long the current free stretch lasts. Shared by Home, Focus, picture in
 * picture and the mini timer so they always agree.
 *
 * Also remembers which block the timer was started from (`pomoBlock`, device
 * local), so the end of that block can be announced once.
 */

import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { usePomo } from "@/hooks/PomoContext";
import { useTimeblocks } from "@/hooks/useTimeblocks";
import { useTasks } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { blocksAround, minutesBetween, type TimeblockOccurrence } from "@/lib/timeblocks";

const ACTIVE_KEY = "pomoBlock";

/** The block a running timer was started from. */
export interface ActiveBlock {
  key: string;
  title: string;
  /** Epoch ms the block ends at. */
  endsAt: number;
}

function readActive(): ActiveBlock | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveBlock) : null;
  } catch {
    return null;
  }
}

export const useActiveBlock = create<{
  active: ActiveBlock | null;
  setActive: (block: ActiveBlock | null) => void;
}>((set) => ({
  active: typeof window === "undefined" ? null : readActive(),
  setActive: (active) => {
    try {
      if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // Private mode: the end-of-block notice is a nicety, not worth failing over.
    }
    set({ active });
  },
}));

/** A clock that re-renders every `ms`, aligned so minute labels flip on time. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, ms);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms]);
  return now;
}

/** Display name for an occurrence: its task's title, its own title, or its tag. */
export function useOccurrenceTitle() {
  const { tasks } = useTasks();
  return (occ: TimeblockOccurrence) =>
    tasks.find((t) => t.uid === occ.block.taskUid)?.title || occ.block.title || occ.block.tag || "Time block";
}

/**
 * Today's plan around now. Loads timeblocks on first use.
 * `tickMs` sets how often progress and labels refresh.
 */
export function useCurrentBlock(tickMs = 30_000) {
  const { timeblocks, loadingTimeblocks, loadTimeblocks } = useTimeblocks();
  const { tasks, loadTasks } = useTasks();
  const { projects, loadProjects } = useProjects();
  const { state, startBlock } = usePomo();
  const setActive = useActiveBlock((s) => s.setActive);
  const titleOf = useOccurrenceTitle();
  const now = useNow(tickMs);

  useEffect(() => {
    if (loadingTimeblocks && !useTimeblocks.getState().timeblocks.length) void loadTimeblocks();
    if (!useTasks.getState().tasks.length) void loadTasks();
    if (!useProjects.getState().projects.length) void loadProjects();
    // Load once per mount; the stores dedupe their own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = useMemo(() => blocksAround(timeblocks, now), [timeblocks, now]);

  /** Start the timer on an occurrence: its tag, linked task, and timer mode. */
  const startOccurrence = (occ: TimeblockOccurrence) => {
    const task = tasks.find((t) => t.uid === occ.block.taskUid && !t.deletedAt);
    const project = task ? projects.find((p) => p.id === task.projectId) : undefined;
    const tag = occ.block.tag || task?.primaryTag || task?.tags[0] || "Focus";
    startBlock({
      tag,
      task: task?.uid ? { uid: task.uid, projectUid: project?.uid ?? occ.block.projectUid, title: task.title, tag } : null,
      mode: occ.block.timerMode,
    });
    setActive({ key: occ.key, title: titleOf(occ), endsAt: occ.end.getTime() });
  };

  /** True when the timer is running on what this occurrence would start. */
  const isRunningOn = (occ: TimeblockOccurrence) =>
    state.isRunning && useActiveBlock.getState().active?.key === occ.key;

  return {
    ...plan,
    now,
    loading: loadingTimeblocks,
    titleOf,
    startOccurrence,
    isRunningOn,
    /** Minutes left in the current block, rounded up. */
    minutesLeft: plan.current ? Math.max(0, Math.ceil((plan.current.end.getTime() - now.getTime()) / 60_000)) : 0,
    /** Minutes until the next block starts, rounded up. */
    minutesUntilNext: plan.next ? Math.max(0, Math.ceil((plan.next.start.getTime() - now.getTime()) / 60_000)) : 0,
    durationOf: (occ: TimeblockOccurrence) => minutesBetween(occ.start, occ.end),
  };
}
