import { addDays, addMonths, addWeeks, endOfMonth, format, startOfDay, startOfWeek } from "date-fns";
import type { Task } from "./tasks";

export type ParseTokenKind = "date" | "time" | "priority" | "tag" | "project" | "estimate";
export interface ParseToken {
  kind: ParseTokenKind;
  /** Exact matched substring in the input. */
  text: string;
  start: number;
  end: number;
  /** Human label for a preview chip. */
  label: string;
  /** Stable key used for ignoring. */
  key: string;
}
export interface ParsedTask {
  title: string;
  dueDay?: string;
  dueTime?: string;
  priority?: number;
  tags: string[];
  projectId?: number;
  estimateMinutes?: number;
  tokens: ParseToken[];
}

const weekdays = "mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?";
const months = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const connector = "(?:(?:by|on|due|before|until)\\s+)?";
const relative = new RegExp(`^${connector}(day after tomorrow|today|tonight|tomorrow|tmrw|tmr|in \\d+ (?:days?|weeks?|months?)|next week|this weekend|end of week|eow|end of month|eom|next month)\\b`, "i");
const weekday = new RegExp(`^${connector}(?:(this|next)\\s+)?(${weekdays})\\b`, "i");
const absolute = new RegExp(`^(?:(?:by|on|due|before|until|this|next)\\s+)?(\\d{4}-\\d{2}-\\d{2}|(?:${months}) \\d{1,2}(?:st|nd|rd|th)?(?:,? \\d{4})?|\\d{1,2}(?:st|nd|rd|th)?(?: of)? (?:${months})(?:,? \\d{4})?)\\b`, "i");
const time = /^(?:(?:at|by|due|on)\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2}|noon|midnight)\b|^at\s+(\d{1,2})\b|^(?:in the|this)\s+(morning|evening)\b/i;

function validDate(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : undefined;
}

function readAbsolute(value: string, now: Date) {
  if (/^\d{4}-/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return validDate(year, month - 1, day);
  }
  const monthWord = value.match(new RegExp(months, "i"))![0];
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthWord.slice(0, 3).toLowerCase());
  const numbers = value.match(/\d+/g)!.map(Number);
  const day = numbers[0];
  let year = numbers[1] ?? now.getFullYear();
  let date = validDate(year, month, day);
  if (numbers.length === 1 && date && date < startOfDay(now)) date = validDate(++year, month, day);
  return date;
}

function readRelative(value: string, now: Date) {
  const today = startOfDay(now);
  const amount = value.match(/^in (\d+) (day|week|month)/);
  if (amount) return amount[2] === "month" ? addMonths(today, +amount[1]) : amount[2] === "week" ? addWeeks(today, +amount[1]) : addDays(today, +amount[1]);
  if (value === "day after tomorrow") return addDays(today, 2);
  if (["tomorrow", "tmrw", "tmr"].includes(value)) return addDays(today, 1);
  if (value === "next week") return addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
  if (value === "next month") return new Date(today.getFullYear(), today.getMonth() + 1, 1);
  if (["end of month", "eom"].includes(value)) return endOfMonth(today);
  if (value === "this weekend") return addDays(today, (6 - today.getDay() + 7) % 7);
  if (["end of week", "eow"].includes(value)) return addDays(today, (5 - today.getDay() + 7) % 7);
  return today;
}

export function parseTaskInput(input: string, opts?: { now?: Date; projects?: { id?: number; title: string }[]; ignore?: string[] }): ParsedTask {
  const now = opts?.now ?? new Date();
  const parsed: ParsedTask = { title: input, tags: [], tokens: [] };
  const ignored = new Set(opts?.ignore);
  const protectedChars = new Set<number>();
  const quoteMarks = new Set<number>();
  for (const match of input.matchAll(/"[^"]*"/g)) {
    for (let i = match.index!; i < match.index! + match[0].length; i++) protectedChars.add(i);
    quoteMarks.add(match.index!);
    quoteMarks.add(match.index! + match[0].length - 1);
  }
  const removed = new Set<number>();
  const projects = [...(opts?.projects ?? [])].filter(p => p.id !== undefined && p.title.trim()).sort((a, b) => b.title.length - a.title.length);
  function accept(kind: ParseTokenKind, text: string, start: number, label: string, apply: () => void) {
    const key = `${kind}:${text.toLowerCase()}`;
    if (ignored.has(key) || Array.from({ length: text.length }, (_, i) => start + i).some(i => protectedChars.has(i))) return false;
    parsed.tokens.push({ kind, text, start, end: start + text.length, label, key });
    for (let i = start; i < start + text.length; i++) removed.add(i);
    apply();
    return true;
  }
  for (let i = 0; i < input.length; i++) {
    if (protectedChars.has(i) || removed.has(i) || (i > 0 && /[\p{L}\p{N}_#@~-]/u.test(input[i - 1]))) continue;
    const rest = input.slice(i);
    const ignoredPhrase = [...ignored].map(key => key.slice(key.indexOf(":") + 1)).find(text => text && rest.slice(0, text.length).toLowerCase() === text && !/[\p{L}\p{N}_]/u.test(rest[text.length] ?? ""));
    if (ignoredPhrase) { i += ignoredPhrase.length - 1; continue; }
    const rel = rest.match(relative), week = rest.match(weekday), abs = rest.match(absolute);
    const dateMatch = rel ?? week ?? abs;
    if (dateMatch && parsed.dueDay === undefined) {
      const contextual = rel || /^\d{4}-\d{2}-\d{2}/.test(dateMatch[0]) || /^(by|on|due|before|until|this|next)\s/i.test(dateMatch[0]) || !rest.slice(dateMatch[0].length).trim();
      let date: Date | undefined;
      if (contextual) {
        if (rel) date = readRelative(rel[1].toLowerCase(), now);
        else if (week) {
          const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(week[2].slice(0, 3).toLowerCase());
          date = week[1]?.toLowerCase() === "next"
            ? addDays(addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1), (day + 6) % 7)
            : addDays(startOfDay(now), (day - now.getDay() + 7) % 7 || 7);
        } else if (abs) date = readAbsolute(abs[1], now);
      }
      if (date && accept("date", dateMatch[0], i, format(date, "EEE, MMM d"), () => { parsed.dueDay = format(date!, "yyyy-MM-dd"); })) continue;
    }
    const clock = rest.match(time);
    if (clock && parsed.dueTime === undefined) {
      const value = (clock[1] ?? clock[2] ?? clock[3]).toLowerCase();
      let hours = 0, minutes = 0;
      if (value === "midnight") { hours = 23; minutes = 59; }
      else if (value === "noon") hours = 12;
      else if (value === "morning") hours = 9;
      else if (value === "evening") hours = 18;
      else {
        const parts = value.match(/^(\d+)(?::(\d+))?\s*(am|pm)?$/)!;
        hours = +parts[1]; minutes = +(parts[2] ?? 0);
        if (parts[3] && (hours < 1 || hours > 12)) continue;
        if (parts[3]) hours = hours % 12 + (parts[3] === "pm" ? 12 : 0);
      }
      if (hours < 24 && minutes < 60) {
        const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        if (accept("time", clock[0], i, format(new Date(2000, 0, 1, hours, minutes), "h:mm a"), () => { parsed.dueTime = value; })) continue;
      }
    }
    const standalone = i === 0 || /\s/.test(input[i - 1]);
    const priority = standalone ? rest.match(/^(?:!(high|med|medium|low)|(!{1,3})|p([123]))(?=\s|$)/i) : null;
    if (priority && parsed.priority === undefined) {
      const value = priority[1] ? ({ high: 3, med: 2, medium: 2, low: 1 }[priority[1].toLowerCase()]!) : priority[2]?.length ?? (4 - +priority[3]);
      if (accept("priority", priority[0], i, ["None", "Low", "Medium", "High"][value], () => { parsed.priority = value; })) continue;
    }
    const tag = standalone ? rest.match(/^#([\p{L}\p{N}_-]+)/u) : null;
    if (tag && accept("tag", tag[0], i, tag[0], () => { parsed.tags.push(tag[1]); })) continue;
    if (standalone && rest.startsWith("@") && parsed.projectId === undefined) {
      const project = projects.find(p => rest.slice(1, p.title.length + 1).toLowerCase() === p.title.toLowerCase() && !/[\p{L}\p{N}_-]/u.test(rest[p.title.length + 1] ?? ""));
      if (project && accept("project", rest.slice(0, project.title.length + 1), i, project.title, () => { parsed.projectId = project.id; })) continue;
    }
    const effort = standalone ? rest.match(/^(?:~|est\s+)(\d+(?:\.\d+)?h(?:\d+m)?|\d+(?:\.\d+)?(?:m|min)?)(?=\s|$)/i) : null;
    if (effort && parsed.estimateMinutes === undefined) {
      const amount = effort[1].toLowerCase();
      const parts = amount.match(/^(\d+(?:\.\d+)?)h(?:(\d+)m)?$/);
      const minutes = Math.round(parts ? +parts[1] * 60 + +(parts[2] ?? 0) : parseFloat(amount));
      if (Number.isSafeInteger(minutes) && accept("estimate", effort[0], i, amount, () => { parsed.estimateMinutes = minutes; })) continue;
    }
  }
  // Tonight supplies a default only after all explicit time candidates were considered.
  if (!parsed.dueTime && parsed.tokens.some(t => t.kind === "date" && /\btonight$/i.test(t.text))) parsed.dueTime = "20:00";
  // Remove connectors stranded immediately beside extracted tokens, preserving quoted text.
  for (const match of input.matchAll(/\b(?:by|on|at|due)\b\s*/gi)) {
    const end = match.index! + match[0].length;
    if (removed.has(end) && !protectedChars.has(match.index!)) {
      for (let j = match.index!; j < end; j++) removed.add(j);
    }
  }
  const title = input.split("").map((char, i) => removed.has(i) ? " " : quoteMarks.has(i) ? "" : char).join("").replace(/\s+/g, " ").trim();
  parsed.title = title || input;
  return parsed;
}

export function parsedToTaskFields(p: ParsedTask, now = new Date()): Partial<Task> {
  const fields: Partial<Task> = {};
  if (p.dueDay || p.dueTime) {
    let day = p.dueDay ?? format(now, "yyyy-MM-dd");
    if (!p.dueDay && p.dueTime && new Date(`${day}T${p.dueTime}`) < now) day = format(addDays(now, 1), "yyyy-MM-dd");
    fields.dueDay = day;
    fields.dueDate = new Date(`${day}T${p.dueTime ?? "00:00"}`);
    fields.dueTime = p.dueTime !== undefined;
  }
  if (p.priority !== undefined) fields.priority = p.priority;
  if (p.tags.length) { fields.tags = p.tags; fields.primaryTag = p.tags[0]; }
  if (p.projectId !== undefined) fields.projectId = p.projectId;
  if (p.estimateMinutes !== undefined) fields.estimateMinutes = p.estimateMinutes;
  return fields;
}

export const PARSE_EXAMPLES: { group: string; items: { input: string; result: string }[] }[] = [
  { group: "Dates", items: [
    { input: "Submit assignment by Saturday", result: "Next Saturday, strictly after today" },
    { input: "Review next Monday", result: "Monday in the following calendar week (weeks start Monday)" },
    { input: "Plan tomorrow", result: "Tomorrow; also today, tmrw, tmr, or day after tomorrow" },
    { input: "Review in 2 weeks", result: "Two weeks from today; days and months work too" },
    { input: "Plan next week", result: "Next Monday; next month means the first" },
    { input: "Rest this weekend", result: "Saturday; eow means Friday, eom means month end" },
    { input: "Submit by Oct 17", result: "October 17; past dates without a year roll to next year" },
    { input: "Submit 2026-10-17", result: "October 17, 2026" },
  ] },
  { group: "Times", items: [
    { input: "Call at 5:30 pm", result: "5:30 PM; 17:00, at 17, and noon work too" },
    { input: "Read tonight", result: "Today at 8:00 PM unless you give another time" },
    { input: "Finish midnight", result: "11:59 PM on the due day" },
    { input: "Read in the morning", result: "9:00 AM; this evening means 6:00 PM" },
  ] },
  { group: "Details", items: [
    { input: "Study #uni @University !high ~2h", result: "Tag, existing project, high priority, 120 minutes" },
    { input: "Read p2 est 45min", result: "Medium priority, 45 minutes; p1 high, p3 low" },
    { input: "Study !! ~1h30m", result: "Medium priority, 90 minutes; ! low, !!! high" },
    { input: 'Read "tomorrow"', result: "Quoted words stay in your title" },
  ] },
];
