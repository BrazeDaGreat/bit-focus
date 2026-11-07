import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyDigest, type WeeklyDigestInput } from "../lib/ai-digest";
import type { Task } from "../lib/tasks";
import type { Note } from "../lib/notes";

const at = (day: number, hour = 0, minute = 0) => new Date(2026, 10, day, hour, minute);
const base: WeeklyDigestInput = { now: at(8, 12), focusSessions: [], tasks: [], notes: [] };
const session = (day: number, hour: number, minutes: number, tag = "Study") => ({
  tag, startTime: at(day, hour), endTime: new Date(at(day, hour).getTime() + minutes * 60_000),
});
const task = (fields: Partial<Task> = {}): Task => ({
  title: "Write report", description: "", tags: [], estimateMinutes: 0, priority: 0,
  order: 0, createdAt: at(1), updatedAt: at(3), ...fields,
});
const note = (fields: Partial<Note> = {}): Note => ({
  title: "Research", type: "document", createdAt: at(1), updatedAt: at(3), ...fields,
});
const data = (input: Partial<WeeklyDigestInput> = {}) => JSON.parse(buildWeeklyDigest({ ...base, ...input }).context);

test("matches Home's seven calendar days and disjoint previous window", () => {
  const summary = buildWeeklyDigest({ ...base, focusSessions: [
    session(2, 0, 60), session(8, 10, 30), session(1, 10, 20), session(-5, 0, 45),
    session(-6, 12, 99), session(9, 0, 99), session(3, 10, -1),
  ] });
  const result = JSON.parse(summary.context);
  assert.equal(summary.title, "Week of Nov 2 – Nov 8 review");
  assert.equal(result.period.start, "2026-11-02");
  assert.equal(result.period.through, "2026-11-08");
  assert.equal(result.focus.minutes, 90);
  assert.equal(result.focus.sessions, 2);
  assert.equal(result.focus.previous.minutes, 65);
  assert.equal(result.focus.previous.sessions, 2);
  assert.equal(result.focus.byDay.length, 7);
  assert.equal(result.focus.byDay[0].minutes, 60);
  assert.equal(result.focus.byDay[6].minutes, 30);
});

test("splits time by real clock-hour overlap, with 12-hour labels and tag totals", () => {
  const result = data({ focusSessions: [{ tag: "  Writing  ", startTime: at(3, 9, 40), endTime: at(3, 11, 10) }, session(4, 23, 120, "")] });
  assert.deepEqual(result.focus.byTagMinutes, [["Untagged", 120], ["Writing", 90]]);
  assert.deepEqual(result.focus.byHourMinutes, [["12 AM", 60], ["9 AM", 20], ["10 AM", 60], ["11 AM", 10], ["11 PM", 60]]);
  assert.equal(result.focus.busiestDay, "2026-11-04 Wed");
});

test("task totals exclude trash, count recent completion, and respect date-only deadlines", () => {
  const result = data({ tasks: [
    task({ title: "Done", completedAt: at(2) }), task({ completedAt: at(1, 23) }),
    task({ completedAt: at(9) }), task({ completedAt: at(3), deletedAt: at(4) }),
    task({ title: "Today", dueDate: at(8), dueDay: "2026-11-08" }),
    task({ title: "Late", dueDate: at(8, 10), dueTime: true }), task({ title: "Undated" }),
  ] });
  assert.equal(result.tasks.completedCount, 1);
  assert.equal(result.tasks.openCount, 3);
  assert.equal(result.tasks.overdueCount, 1);
  assert.equal(result.tasks.open[0].title, "Late");
  assert.equal(result.tasks.open.find((entry: { title: string }) => entry.title === "Today").overdue, false);
  assert.equal(result.tasks.open[0].due, "Nov 8, 10:00 AM");
});

test("note samples contain short plain text from Tiptap and legacy HTML, never attrs", () => {
  const result = data({ notes: [
    note({ content: JSON.stringify({ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Useful finding. ".repeat(30) }] },
      { type: "image", attrs: { src: "data:image/png;base64,SECRET" } },
    ] }) }),
    note({ title: "New", createdAt: at(4), updatedAt: at(4), content: "<p>Hello &amp; welcome</p><script>BAD</script>" }),
    note({ title: "Old", updatedAt: at(1) }), note({ title: "Trashed", deletedAt: at(5) }),
  ] });
  assert.equal(result.notes.recentCount, 2);
  assert.equal(result.notes.createdCount, 1);
  assert.equal(result.notes.editedCount, 2);
  assert.equal(result.notes.recent[0].excerpt, "Hello & welcome");
  assert.ok(result.notes.recent[1].excerpt.length <= 180);
  assert.ok(!JSON.stringify(result.notes).includes("SECRET"));
  assert.ok(!JSON.stringify(result.notes).includes("BAD"));
});

test("planned totals expand recurring blocks and clip overnight overlap to the review", () => {
  const result = data({ timeblocks: [
    { uid: "repeat", tag: "Study", startTime: at(2, 9), endTime: at(2, 10, 30), recurrence: { freq: "weekdays" }, exceptions: ["2026-11-04"] },
    { tag: "Reading", startTime: at(1, 23), endTime: at(2, 1) },
    { tag: "Reading", startTime: at(8, 23), endTime: at(9, 1) },
  ] });
  assert.equal(result.plan.minutes, 480);
  assert.equal(result.plan.blocks, 6);
  assert.deepEqual(result.plan.byTagMinutes, [["Study", 360], ["Reading", 120]]);
});

test("caps detail without losing headline counts, even for escaped user text", () => {
  const long = '\\"'.repeat(500);
  const result = buildWeeklyDigest({ ...base,
    tasks: Array.from({ length: 300 }, (_, i) => task({ title: long, tags: [long, long, long], completedAt: i % 2 ? at(3) : null })),
    notes: Array.from({ length: 300 }, () => note({ title: long, content: long })),
    focusSessions: Array.from({ length: 300 }, (_, i) => session(3, 9, 1, `${i}${long}`)),
  });
  const parsed = JSON.parse(result.context);
  assert.equal(parsed.tasks.completedCount, 150);
  assert.equal(parsed.tasks.openCount, 150);
  assert.equal(parsed.notes.recentCount, 300);
  assert.ok(parsed.tasks.open.length <= 25);
  assert.ok(parsed.notes.recent.length <= 10);
  assert.ok(result.context.length <= 20_000);
  assert.equal(parsed.focus.byTagMinutes.length, 11);
  assert.equal(parsed.focus.byTagMinutes.at(-1)[1], 290);
});

test("empty context distinguishes missing plan data, omits sentinel names, handles year crossing", () => {
  const result = data({ name: "NULL" });
  assert.equal(result.name, undefined);
  assert.equal(result.plan, undefined);
  assert.equal(result.focus.busiestDay, null);
  assert.equal(result.focus.busiestHour, null);
  assert.equal(data({ name: "  Alex  ", timeblocks: [] }).name, "Alex");
  assert.equal(data({ timeblocks: [] }).plan.minutes, 0);
  const { title } = buildWeeklyDigest({ ...base, now: new Date(2027, 0, 2, 12) });
  assert.equal(title, "Week of Dec 27, 2026 – Jan 2, 2027 review");
});
