import { create } from "zustand";
import { addDays, startOfDay } from "date-fns";
import db from "@/lib/db";
import type { TimeBlock, TimeblockTemplate, TimeblockTemplateBlock } from "@/lib/db";
import { expandTimeblocks, templateBlockTimes, type TimeblockOccurrence } from "@/lib/timeblocks";

export type { TimeBlock, TimeblockTemplate, TimeblockTemplateBlock, TimeblockOccurrence };

/** Which occurrences of a repeating block an edit or delete applies to. */
export type SeriesScope = "this" | "all";

/** Fields of a block that can be set when creating it. */
export type TimeblockExtras = Partial<Omit<TimeBlock, "id" | "uid" | "tag" | "startTime" | "endTime" | "title">>;

interface TimeblocksState {
  timeblocks: TimeBlock[];
  templates: TimeblockTemplate[];
  loadingTimeblocks: boolean;
  addTimeblock: (tag: string, startTime: Date, endTime: Date, title?: string, extras?: TimeblockExtras) => Promise<TimeBlock>;
  loadTimeblocks: () => Promise<void>;
  removeTimeblock: (id: number) => Promise<void>;
  editTimeblock: (id: number, updates: Partial<TimeBlock>) => Promise<void>;
  /**
   * Edit one occurrence. For a block that does not repeat, `scope` is ignored.
   * "this" detaches the occurrence from its series; "all" edits the series
   * (a time change moves every occurrence by the same amount).
   */
  editOccurrence: (occ: TimeblockOccurrence, updates: Partial<TimeBlock>, scope: SeriesScope) => Promise<void>;
  /** Delete one occurrence, or its whole series with every detached edit. */
  removeOccurrence: (occ: TimeblockOccurrence, scope: SeriesScope) => Promise<void>;
  /** Push today's current and upcoming blocks later by `minutes` (earlier when negative). */
  shiftRestOfDay: (minutes: number, now?: Date) => Promise<number>;
  saveTemplate: (name: string, blocks: TimeblockTemplateBlock[]) => Promise<void>;
  renameTemplate: (id: number, name: string) => Promise<void>;
  removeTemplate: (id: number) => Promise<void>;
  /** Add a template's blocks to each day in `days`. Returns how many blocks were made. */
  applyTemplate: (template: TimeblockTemplate, days: Date[]) => Promise<number>;
}

const mintUid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** A stand-alone copy of one series occurrence, before `updates` are applied. */
function detachedCopy(occ: TimeblockOccurrence): TimeBlock {
  const { id: _id, uid: _uid, recurrence: _r, exceptions: _e, ...fields } = occ.block;
  void _id; void _uid; void _r; void _e;
  return { ...fields, uid: mintUid(), startTime: occ.start, endTime: occ.end, seriesUid: occ.block.uid };
}

const isSeries = (occ: TimeblockOccurrence) => !!occ.block.recurrence;

export const useTimeblocks = create<TimeblocksState>((set, get) => {
  /** Re-read both tables after a multi-row change, so the store matches the database. */
  const reload = async () => {
    const [blocks, templates] = await Promise.all([db.timeblocks.toArray(), db.timeblockTemplates.toArray()]);
    set({ timeblocks: blocks.reverse(), templates: templates.sort((a, b) => a.name.localeCompare(b.name)) });
  };

  return {
    timeblocks: [],
    templates: [],
    loadingTimeblocks: true,

    addTimeblock: async (tag, startTime, endTime, title, extras = {}) => {
      const row: TimeBlock = { ...extras, uid: mintUid(), tag, startTime, endTime, title };
      const id = await db.timeblocks.add(row);
      const block = { ...row, id };
      set((state) => ({ timeblocks: [block, ...state.timeblocks] }));
      return block;
    },

    loadTimeblocks: async () => {
      set({ loadingTimeblocks: true });
      try {
        await reload();
      } catch (err) {
        console.error("Failed to load timeblocks:", err);
      } finally {
        set({ loadingTimeblocks: false });
      }
    },

    removeTimeblock: async (id) => {
      await db.timeblocks.delete(id);
      set((state) => ({
        timeblocks: state.timeblocks.filter((b) => b.id !== id),
      }));
    },

    editTimeblock: async (id, updates) => {
      await db.timeblocks.update(id, updates);
      set((state) => ({
        timeblocks: state.timeblocks.map((b) =>
          b.id === id ? { ...b, ...updates } : b
        ),
      }));
    },

    editOccurrence: async (occ, updates, scope) => {
      const block = occ.block;
      // Repeat fields belong to the series block only; detached rows stay single.
      const { startTime: _s, endTime: _e, recurrence: _r, exceptions: _x, seriesUid: _u, ...details } = updates;
      void _s; void _e; void _r; void _x; void _u;
      const seriesUid = isSeries(occ) ? block.uid : block.seriesUid;
      // Tag, title, task, and mode changes reach every occurrence, edited ones included.
      const editSeriesDetails = async () => {
        if (!seriesUid || !Object.keys(details).length) return;
        await db.timeblocks.filter((b) => b.uid === seriesUid || b.seriesUid === seriesUid).modify(details);
      };
      if (!isSeries(occ)) {
        if (scope === "all" && block.seriesUid) {
          // A detached occurrence keeps its own time; its details go to the whole series.
          await db.timeblocks.update(block.id!, { ...details, ...(_s && { startTime: _s }), ...(_e && { endTime: _e }) });
          await editSeriesDetails();
          await reload();
          return;
        }
        await get().editTimeblock(block.id!, updates);
        return;
      }
      if (scope === "this") {
        await db.transaction("rw", db.timeblocks, async () => {
          await db.timeblocks.update(block.id!, { exceptions: [...new Set([...(block.exceptions ?? []), occ.day])] });
          await db.timeblocks.add({ ...detachedCopy(occ), ...updates });
        });
        await reload();
        return;
      }
      // Whole series: move the first occurrence by the same offset and length.
      const changes: Partial<TimeBlock> = { ...updates };
      if (updates.startTime || updates.endTime) {
        const newStart = updates.startTime ?? occ.start;
        const newEnd = updates.endTime ?? occ.end;
        const first = new Date(new Date(block.startTime).getTime() + (newStart.getTime() - occ.start.getTime()));
        changes.startTime = first;
        changes.endTime = new Date(first.getTime() + (newEnd.getTime() - newStart.getTime()));
      }
      await db.transaction("rw", db.timeblocks, async () => {
        await db.timeblocks.update(block.id!, changes);
        await editSeriesDetails();
      });
      await reload();
    },

    removeOccurrence: async (occ, scope) => {
      const block = occ.block;
      const seriesUid = isSeries(occ) ? block.uid : block.seriesUid;
      if (scope === "all" && seriesUid) {
        await db.transaction("rw", db.timeblocks, async () => {
          const rows = await db.timeblocks.filter((b) => b.uid === seriesUid || b.seriesUid === seriesUid).toArray();
          await db.timeblocks.bulkDelete(rows.map((b) => b.id!));
        });
        await reload();
        return;
      }
      if (isSeries(occ)) {
        await get().editTimeblock(block.id!, { exceptions: [...new Set([...(block.exceptions ?? []), occ.day])] });
        return;
      }
      await get().removeTimeblock(block.id!);
    },

    shiftRestOfDay: async (minutes, now = new Date()) => {
      const delta = minutes * 60_000;
      const today = expandTimeblocks(get().timeblocks, startOfDay(now), addDays(startOfDay(now), 1))
        .filter((o) => o.end.getTime() > now.getTime() && o.start.getTime() >= startOfDay(now).getTime());
      if (!today.length) return 0;
      await db.transaction("rw", db.timeblocks, async () => {
        for (const occ of today) {
          const startTime = new Date(occ.start.getTime() + delta);
          const endTime = new Date(occ.end.getTime() + delta);
          if (!isSeries(occ)) {
            await db.timeblocks.update(occ.block.id!, { startTime, endTime });
            continue;
          }
          // Shifting a repeating block only moves today's occurrence.
          const series = await db.timeblocks.get(occ.block.id!);
          await db.timeblocks.update(occ.block.id!, { exceptions: [...new Set([...(series?.exceptions ?? []), occ.day])] });
          await db.timeblocks.add({ ...detachedCopy(occ), startTime, endTime });
        }
      });
      await reload();
      return today.length;
    },

    saveTemplate: async (name, blocks) => {
      const now = new Date();
      await db.timeblockTemplates.add({ uid: mintUid(), name: name.trim(), blocks, createdAt: now, updatedAt: now });
      await reload();
    },

    renameTemplate: async (id, name) => {
      await db.timeblockTemplates.update(id, { name: name.trim(), updatedAt: new Date() });
      await reload();
    },

    removeTemplate: async (id) => {
      await db.timeblockTemplates.delete(id);
      set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
    },

    applyTemplate: async (template, days) => {
      const rows: TimeBlock[] = days.flatMap((day) =>
        template.blocks.map((row) => {
          const { start, end } = templateBlockTimes(row, day);
          const { startMinutes: _s, endMinutes: _e, ...fields } = row;
          void _s; void _e;
          return { ...fields, uid: mintUid(), startTime: start, endTime: end };
        })
      );
      if (rows.length) await db.timeblocks.bulkAdd(rows);
      await reload();
      return rows.length;
    },
  };
});
