/**
 * Timeblock logic shared by the calendar, Home, Focus, and the timer windows.
 *
 * A repeating block is stored once: its own start and end are the first
 * occurrence, and every later one is computed here on read. An occurrence that
 * is deleted or edited on its own is listed in the series' `exceptions`; an
 * edited one is saved as an ordinary block carrying `seriesUid`.
 *
 * Everything in this file is pure so it can be tested without a database.
 */

import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import type { TimeBlock, TimeblockRecurrence, TimeblockTemplateBlock } from "./db";

const MINUTE = 60_000;
const DAY_KEY = "yyyy-MM-dd";

/** One concrete appearance of a block on the calendar. */
export interface TimeblockOccurrence {
  /** Unique per occurrence: the block's uid (or id), plus the day for a series. */
  key: string;
  /** The stored row. For a series this is the series block. */
  block: TimeBlock;
  start: Date;
  end: Date;
  /** Local day the occurrence starts on, `yyyy-MM-dd`. */
  day: string;
  /** True for every occurrence of a series, including ones edited on their own. */
  recurring: boolean;
}

export const dayKey = (date: Date) => format(date, DAY_KEY);

/** The block's stable identity, falling back to its local id before sync mints a uid. */
export const blockKey = (block: TimeBlock) => block.uid ?? `local-${block.id}`;

/** Whether a series has an occurrence on `day` (ignores exceptions). */
export function repeatsOn(rule: TimeblockRecurrence, first: Date, day: Date): boolean {
  if (differenceInCalendarDays(day, first) < 0) return false;
  if (rule.until && dayKey(day) > rule.until) return false;
  const weekday = day.getDay();
  if (rule.freq === "daily") return true;
  if (rule.freq === "weekdays") return weekday >= 1 && weekday <= 5;
  const days = rule.days?.length ? rule.days : [first.getDay()];
  return days.includes(weekday);
}

/** Start and end of a series occurrence on `day`, keeping the first one's clock time and length. */
export function occurrenceTimes(block: TimeBlock, day: Date) {
  const first = new Date(block.startTime);
  const length = new Date(block.endTime).getTime() - first.getTime();
  const start = new Date(day);
  start.setHours(first.getHours(), first.getMinutes(), first.getSeconds(), 0);
  return { start, end: new Date(start.getTime() + length) };
}

/**
 * Every occurrence overlapping `[rangeStart, rangeEnd)`, sorted by start.
 * Overnight occurrences that began the day before the range are included.
 */
export function expandTimeblocks(
  blocks: TimeBlock[],
  rangeStart: Date,
  rangeEnd: Date
): TimeblockOccurrence[] {
  const out: TimeblockOccurrence[] = [];
  const from = rangeStart.getTime();
  const to = rangeEnd.getTime();

  for (const block of blocks) {
    const start = new Date(block.startTime);
    const end = new Date(block.endTime);
    if (!block.recurrence) {
      if (start.getTime() < to && end.getTime() > from)
        out.push({ key: blockKey(block), block, start, end, day: dayKey(start), recurring: !!block.seriesUid });
      continue;
    }
    const skip = new Set(block.exceptions ?? []);
    const lastDay = startOfDay(rangeEnd);
    for (let day = addDays(startOfDay(rangeStart), -1); day <= lastDay; day = addDays(day, 1)) {
      const key = dayKey(day);
      if (skip.has(key) || !repeatsOn(block.recurrence, start, day)) continue;
      const times = occurrenceTimes(block, day);
      if (times.start.getTime() < to && times.end.getTime() > from)
        out.push({ key: `${blockKey(block)}:${key}`, block, ...times, day: key, recurring: true });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** What is planned around `now` today: the running block, the next one, and when free time ends. */
export function blocksAround(blocks: TimeBlock[], now: Date = new Date()) {
  const today = expandTimeblocks(blocks, startOfDay(now), addDays(startOfDay(now), 1));
  const t = now.getTime();
  // When blocks overlap, the one that started last is the one you moved on to.
  const current = today.filter((o) => o.start.getTime() <= t && o.end.getTime() > t).at(-1) ?? null;
  const next = today.find((o) => o.start.getTime() > t) ?? null;
  return {
    today,
    current,
    next,
    /** End of the free stretch when nothing is running: the next block's start, or null for the rest of the day. */
    freeUntil: current ? null : next?.start ?? null,
    /** 0–1 through the current block. */
    progress: current
      ? Math.min(1, (t - current.start.getTime()) / Math.max(1, current.end.getTime() - current.start.getTime()))
      : 0,
  };
}

/**
 * How a block splits into Pomodoros at the user's lengths, e.g. "4 × 25/5".
 * Null when the block is shorter than one focus period.
 */
export function pomodoroHint(
  minutes: number,
  settings: { focusDuration: number; breakDuration: number }
): { count: number; label: string } | null {
  const focus = Math.max(1, settings.focusDuration);
  const rest = Math.max(0, settings.breakDuration);
  if (minutes < focus) return null;
  // The last focus period needs no break after it.
  const count = Math.floor((minutes + rest) / (focus + rest));
  return { count, label: `${count} × ${focus}/${rest}` };
}

export const minutesBetween = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / MINUTE);

/** A day's occurrences as template rows, timed from midnight. */
export function templateFromDay(occurrences: TimeblockOccurrence[]): TimeblockTemplateBlock[] {
  return occurrences.map(({ block, start, end }) => {
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    return {
      tag: block.tag,
      title: block.title,
      taskUid: block.taskUid,
      projectUid: block.projectUid,
      timerMode: block.timerMode,
      startMinutes,
      endMinutes: startMinutes + minutesBetween(start, end),
    };
  });
}

/** Concrete start and end for a template row placed on `day`. */
export function templateBlockTimes(row: TimeblockTemplateBlock, day: Date) {
  const base = startOfDay(day).getTime();
  return {
    start: new Date(base + row.startMinutes * MINUTE),
    end: new Date(base + row.endMinutes * MINUTE),
  };
}

/** Plain-language summary of a repeat rule: "Every day", "Weekdays", "Mon, Wed". */
export function describeRecurrence(rule: TimeblockRecurrence, first: Date): string {
  if (rule.freq === "daily") return "Every day";
  if (rule.freq === "weekdays") return "Weekdays";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = rule.days?.length ? rule.days : [first.getDay()];
  // Week starts Monday, matching the calendar.
  return [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => names[d]).join(", ");
}
