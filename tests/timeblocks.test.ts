import { test } from "node:test";
import assert from "node:assert/strict";
import { blocksAround, describeRecurrence, expandTimeblocks, pomodoroHint, templateBlockTimes, templateFromDay } from "../lib/timeblocks";
import type { TimeBlock } from "../lib/db";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
// Oct 2026: the 26th is a Monday.
const series: TimeBlock = { id: 1, uid: "s", tag: "Study", startTime: at(26, 9), endTime: at(26, 10, 30), recurrence: { freq: "weekdays" } };

test("expands a weekday series only on weekdays, keeping time and length", () => {
  const occ = expandTimeblocks([series], at(26, 0), at(2 + 31, 0)); // Mon 26 → Mon Nov 2 (exclusive)
  assert.deepEqual(occ.map((o) => o.day), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
  assert.ok(occ.every((o) => o.start.getHours() === 9 && o.end.getTime() - o.start.getTime() === 90 * 60_000));
  assert.ok(occ.every((o) => o.recurring && o.key.startsWith("s:")));
});

test("exceptions, until, and days before the first occurrence are skipped", () => {
  const rule: TimeBlock = { ...series, recurrence: { freq: "daily", until: "2026-10-28" }, exceptions: ["2026-10-27"] };
  const occ = expandTimeblocks([rule], at(20, 0), at(31, 0));
  assert.deepEqual(occ.map((o) => o.day), ["2026-10-26", "2026-10-28"]);
});

test("weekly repeats on chosen days and defaults to the first day's weekday", () => {
  const weekly: TimeBlock = { ...series, recurrence: { freq: "weekly", days: [1, 3] } };
  assert.deepEqual(expandTimeblocks([weekly], at(26, 0), at(31, 0)).map((o) => o.day), ["2026-10-26", "2026-10-28"]);
  const plain: TimeBlock = { ...series, recurrence: { freq: "weekly" } };
  assert.deepEqual(expandTimeblocks([plain], at(26, 0), at(31 + 3, 0)).map((o) => o.day), ["2026-10-26", "2026-11-02"]);
  assert.equal(describeRecurrence({ freq: "weekly", days: [0, 3, 1] }, at(26, 9)), "Mon, Wed, Sun");
});

test("finds the current and next block and the free stretch", () => {
  const blocks: TimeBlock[] = [
    { id: 2, uid: "a", tag: "A", startTime: at(26, 9), endTime: at(26, 10) },
    { id: 3, uid: "b", tag: "B", startTime: at(26, 13), endTime: at(26, 14) },
  ];
  const during = blocksAround(blocks, at(26, 9, 30));
  assert.equal(during.current?.key, "a");
  assert.equal(during.next?.key, "b");
  assert.equal(during.freeUntil, null);
  assert.equal(during.progress, 0.5);
  const gap = blocksAround(blocks, at(26, 11));
  assert.equal(gap.current, null);
  assert.equal(gap.freeUntil?.getHours(), 13);
  assert.equal(blocksAround(blocks, at(26, 15)).freeUntil, null);
});

test("pomodoro hint fits whole focus periods without a trailing break", () => {
  assert.equal(pomodoroHint(120, { focusDuration: 25, breakDuration: 5 })?.label, "4 × 25/5");
  assert.equal(pomodoroHint(55, { focusDuration: 25, breakDuration: 5 })?.count, 2);
  assert.equal(pomodoroHint(20, { focusDuration: 25, breakDuration: 5 }), null);
});

test("templates round-trip a day's blocks to another day", () => {
  const rows = templateFromDay(expandTimeblocks([series], at(26, 0), at(27, 0)));
  assert.deepEqual(rows.map((r) => [r.startMinutes, r.endMinutes]), [[540, 630]]);
  const { start, end } = templateBlockTimes(rows[0], at(29, 0));
  assert.equal(start.getTime(), at(29, 9).getTime());
  assert.equal(end.getTime(), at(29, 10, 30).getTime());
});
