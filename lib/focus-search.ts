/**
 * Focus History Search
 *
 * Turns a command palette query into summaries of matching focus sessions:
 * by tag ("uni"), by day ("yesterday", "nov 3", "2026-11-03", "monday"), or
 * both ("uni yesterday"). Each result links to Focus Table filtered to the
 * same sessions.
 *
 * @fileoverview Command palette search over focus sessions.
 * @since v0.25.2
 */

import { formatMinutes } from "@/lib/tasks";

interface SessionLike {
  tag: string;
  startTime: Date | string;
  endTime: Date | string;
}

export interface FocusMatch {
  key: string;
  label: string;
  /** Total time and session count, such as "3h 10m · 5 sessions". */
  detail: string;
  href: string;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function monthIndex(word: string): number {
  return word.length >= 3 ? MONTHS.findIndex((month) => word.startsWith(month)) : -1;
}

/**
 * Find a day named in the query. Returns the day and the query with the date
 * words removed, or null when no day is named.
 *
 * A month and day without a year means the most recent such date, never one
 * in the future.
 */
export function parseDayQuery(query: string, now = new Date()): { day: Date; rest: string } | null {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const today = startOfDay(now);
  const take = (day: Date, from: number, count: number) => ({
    day,
    rest: [...words.slice(0, from), ...words.slice(from + count)].join(" "),
  });

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === "today") return take(today, i, 1);
    if (word === "yesterday") return take(addDays(today, -1), i, 1);

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(word);
    if (iso) {
      const day = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      if (day.getMonth() === Number(iso[2]) - 1) return take(day, i, 1);
    }

    const weekday = word.length >= 3 ? WEEKDAYS.findIndex((name) => name.startsWith(word)) : -1;
    if (weekday >= 0) {
      const back = (today.getDay() - weekday + 7) % 7;
      return take(addDays(today, -back), i, 1);
    }

    // "nov 3" or "3 nov"
    const next = words[i + 1];
    if (!next) continue;
    const [monthWord, dayWord] = monthIndex(word) >= 0 ? [word, next] : [next, word];
    const month = monthIndex(monthWord);
    const date = /^\d{1,2}$/.test(dayWord) ? Number(dayWord) : NaN;
    if (month < 0 || !(date >= 1 && date <= 31)) continue;
    let day = new Date(today.getFullYear(), month, date);
    if (day.getMonth() !== month) continue;
    if (day > today) day = new Date(today.getFullYear() - 1, month, date);
    return take(day, i, 2);
  }
  return null;
}

function summary(sessions: readonly SessionLike[]): string {
  const minutes = sessions.reduce(
    (sum, session) => sum + (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60_000,
    0,
  );
  return `${formatMinutes(minutes)} · ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`;
}

function dayName(day: Date, now: Date): string {
  const today = startOfDay(now);
  if (day.getTime() === today.getTime()) return "today";
  if (day.getTime() === addDays(today, -1).getTime()) return "yesterday";
  return day.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    ...(day.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/**
 * Summaries of focus sessions matching a palette query.
 *
 * @param sessions - Every focus session.
 * @param query - What was typed; a leading `#` on a tag is optional.
 */
export function searchFocusHistory(
  sessions: readonly SessionLike[],
  query: string,
  now = new Date(),
): FocusMatch[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const dated = parseDayQuery(trimmed, now);
  const tagQuery = (dated ? dated.rest : trimmed).replace(/^#/, "").trim().toLowerCase();
  if (!dated && !tagQuery) return [];

  let pool = sessions;
  let from: Date | null = null;
  let to: Date | null = null;
  if (dated) {
    from = dated.day;
    to = addDays(dated.day, 1);
    pool = sessions.filter((session) => {
      const at = new Date(session.startTime).getTime();
      return at >= from!.getTime() && at < to!.getTime();
    });
  }

  const tags = [...new Set(pool.map((session) => session.tag))]
    .filter((tag) => !tagQuery || tag.toLowerCase().includes(tagQuery))
    .sort((a, b) => Number(b.toLowerCase() === tagQuery) - Number(a.toLowerCase() === tagQuery) || a.localeCompare(b));

  const range = from && to
    // Focus Table keeps sessions after `sourceFrom` and up to `sourceTo`.
    ? `sourceFrom=${encodeURIComponent(new Date(from.getTime() - 1).toISOString())}&sourceTo=${encodeURIComponent(new Date(to.getTime() - 1).toISOString())}`
    : "";
  const href = (tag?: string) => {
    const params = [range, tag ? `tag=${encodeURIComponent(tag)}` : ""].filter(Boolean).join("&");
    return `/focus-table${params ? `?${params}` : ""}`;
  };

  const out: FocusMatch[] = [];
  if (dated && !tagQuery && pool.length) {
    out.push({ key: `day ${from!.toISOString()}`, label: `Focus ${dayName(from!, now)}`, detail: summary(pool), href: href() });
  }
  if (tagQuery) {
    for (const tag of tags.slice(0, 5)) {
      const matching = pool.filter((session) => session.tag === tag);
      out.push({
        key: `tag ${tag} ${from?.toISOString() ?? ""}`,
        label: dated ? `#${tag} ${dayName(from!, now)}` : `All #${tag} sessions`,
        detail: summary(matching),
        href: href(tag),
      });
    }
  }
  return out;
}
