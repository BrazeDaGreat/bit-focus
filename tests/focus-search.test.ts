/** Command palette search over focus history. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDayQuery, searchFocusHistory } from "../lib/focus-search";

// Friday, Nov 13 2026, local time.
const now = new Date(2026, 10, 13, 15, 0);
const session = (tag: string, day: number, hour: number, minutes: number) => ({
  tag,
  startTime: new Date(2026, 10, day, hour),
  endTime: new Date(2026, 10, day, hour, minutes),
});
const sessions = [session("uni", 13, 9, 50), session("uni", 12, 9, 25), session("work", 12, 14, 60), session("unity", 3, 10, 30)];

test("days are read from words, ISO dates, weekdays, and month names", () => {
  assert.deepEqual(parseDayQuery("today", now)?.day, new Date(2026, 10, 13));
  assert.deepEqual(parseDayQuery("uni yesterday", now), { day: new Date(2026, 10, 12), rest: "uni" });
  assert.deepEqual(parseDayQuery("2026-11-03", now)?.day, new Date(2026, 10, 3));
  assert.deepEqual(parseDayQuery("mon", now)?.day, new Date(2026, 10, 9));
  assert.deepEqual(parseDayQuery("friday", now)?.day, new Date(2026, 10, 13));
  assert.deepEqual(parseDayQuery("thu", now)?.day, new Date(2026, 10, 12));
  assert.deepEqual(parseDayQuery("nov 3 work", now), { day: new Date(2026, 10, 3), rest: "work" });
  assert.deepEqual(parseDayQuery("3 nov", now)?.day, new Date(2026, 10, 3));
  // A month and day still ahead this year means last year.
  assert.deepEqual(parseDayQuery("dec 25", now)?.day, new Date(2025, 11, 25));
  assert.equal(parseDayQuery("uni", now), null);
  assert.equal(parseDayQuery("2026-02-30", now), null);
});

test("a tag query sums every matching tag, exact match first", () => {
  const matches = searchFocusHistory(sessions, "#uni", now);
  assert.deepEqual(matches.map((m) => m.label), ["All #uni sessions", "All #unity sessions"]);
  assert.equal(matches[0].detail, "1h 15m · 2 sessions");
  assert.equal(matches[0].href, "/focus-table?tag=uni");
});

test("a day query summarizes that day and links Focus Table to it", () => {
  const [day] = searchFocusHistory(sessions, "yesterday", now);
  assert.equal(day.label, "Focus yesterday");
  assert.equal(day.detail, "1h 25m · 2 sessions");
  const url = new URL(day.href, "https://x.invalid");
  const from = Date.parse(url.searchParams.get("sourceFrom")!);
  const to = Date.parse(url.searchParams.get("sourceTo")!);
  // Focus Table keeps sessions with from < start <= to.
  assert.ok(from < new Date(2026, 10, 12).getTime() && new Date(2026, 10, 12).getTime() <= to);
  assert.ok(to < new Date(2026, 10, 13).getTime());
});

test("tag and day combine, and nothing is offered for empty or unmatched queries", () => {
  const matches = searchFocusHistory(sessions, "work yesterday", now);
  assert.deepEqual(matches.map((m) => [m.label, m.detail]), [["#work yesterday", "1h · 1 session"]]);
  assert.match(matches[0].href, /tag=work/);
  assert.deepEqual(searchFocusHistory(sessions, "u", now), []);
  assert.deepEqual(searchFocusHistory(sessions, "chores", now), []);
  assert.deepEqual(searchFocusHistory(sessions, "nov 1", now), []);
});
