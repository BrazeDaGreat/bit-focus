import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTaskInput, parsedToTaskFields, PARSE_EXAMPLES } from "../lib/task-parse";

const now = new Date(2026, 9, 10, 14);
const projects = [{ id: 1, title: "University" }, { id: 2, title: "Work" }, { id: 3, title: "Work Stuff" }];
const parse = (input: string) => parseTaskInput(input, { now, projects });

test("extracts the complete quick-add example with exact ordered token spans", () => {
  const input = "Submit OS assignment by Saturday 5pm #uni @University !high ~2h";
  const p = parse(input);
  assert.equal(p.title, "Submit OS assignment");
  assert.equal(p.dueDay, "2026-10-17");
  assert.equal(p.dueTime, "17:00");
  assert.equal(p.priority, 3);
  assert.deepEqual(p.tags, ["uni"]);
  assert.equal(p.projectId, 1);
  assert.equal(p.estimateMinutes, 120);
  assert.deepEqual(p.tokens.map(t => t.kind), ["date", "time", "tag", "project", "priority", "estimate"]);
  for (const token of p.tokens) {
    assert.equal(input.slice(token.start, token.end), token.text);
    assert.equal(token.key, `${token.kind}:${token.text.toLowerCase()}`);
  }
  assert.equal(p.tokens[0].label, "Sat, Oct 17");
});

test("relative dates and aliases use local calendar math", () => {
  const cases = {
    today: "2026-10-10", tonight: "2026-10-10", tomorrow: "2026-10-11", tmrw: "2026-10-11", tmr: "2026-10-11",
    "day after tomorrow": "2026-10-12", "in 2 days": "2026-10-12", "in 1 week": "2026-10-17", "in 2 weeks": "2026-10-24",
    "in 1 month": "2026-11-10", "in 2 months": "2026-12-10", "next week": "2026-10-12", "this weekend": "2026-10-10",
    "end of week": "2026-10-16", eow: "2026-10-16", "end of month": "2026-10-31", eom: "2026-10-31", "next month": "2026-11-01",
  };
  for (const [syntax, day] of Object.entries(cases)) assert.equal(parse(`Task ${syntax}`).dueDay, day, syntax);
  assert.equal(parse("Task tonight").dueTime, "20:00");
  assert.equal(parse("Task tonight at 5pm").dueTime, "17:00");
  assert.equal(parse("tomorrow write notes").title, "write notes");
  assert.equal(parse("Task (tomorrow)").dueDay, "2026-10-11");
  assert.equal(parseTaskInput("Task in 1 month", { now: new Date(2026, 0, 31) }).dueDay, "2026-02-28");
});

test("weekday abbreviations, connectors and next calendar week", () => {
  for (const word of ["mon", "Monday", "tue", "Tuesday", "wed", "Wednesday", "thu", "Thursday", "fri", "Friday", "sat", "Saturday", "sun", "Sunday"]) {
    assert.ok(parse(`Task by ${word}`).dueDay, word);
    assert.ok(parse(`Task ${word}`).dueDay, word);
  }
  for (const prefix of ["by", "on", "due", "before", "until", "this"]) assert.equal(parse(`Task ${prefix} Saturday`).dueDay, "2026-10-17");
  const wed = new Date(2026, 9, 14, 14);
  assert.equal(parseTaskInput("Task by Friday", { now: wed }).dueDay, "2026-10-16");
  assert.equal(parseTaskInput("Task next Friday", { now: wed }).dueDay, "2026-10-23");
  assert.equal(parse("Task next Monday").dueDay, "2026-10-12");
  assert.equal(parse("Task next Sunday").dueDay, "2026-10-18");
});

test("absolute formats, years, validity and rollover", () => {
  for (const word of ["Oct 17", "17 Oct", "October 17th", "17th of October", "Oct 17 2026", "17 Oct 2026", "October 17th, 2026", "17th of October 2026", "2026-10-17"]) {
    assert.equal(parse(`Task by ${word}`).dueDay, "2026-10-17", word);
    assert.equal(parse(`Task ${word}`).dueDay, "2026-10-17", word);
  }
  assert.equal(parse("Task on Oct 9").dueDay, "2027-10-09");
  assert.equal(parse("Task on Oct 9 2025").dueDay, "2025-10-09");
  assert.equal(parse("Task on Oct 10").dueDay, "2026-10-10");
  assert.equal(parse("Task this Oct 17 then rest").dueDay, "2026-10-17");
  assert.equal(parse("Task on February 30").dueDay, undefined);
  assert.equal(parse("Task 2026-10-17 follow up").title, "Task follow up");
});

test("explicit times, named times and invalid clock values", () => {
  const cases = { "at 5pm": "17:00", "5pm": "17:00", "5:30 pm": "17:30", "17:00": "17:00", "at 17": "17:00", noon: "12:00", midnight: "23:59", "in the morning": "09:00", "this morning": "09:00", "in the evening": "18:00", "this evening": "18:00", "12am": "00:00", "12pm": "12:00" };
  for (const [word, clock] of Object.entries(cases)) assert.equal(parse(`Task ${word}`).dueTime, clock, word);
  for (const word of ["25:00", "17:99", "13pm", "at 24", "morning", "evening"]) assert.equal(parse(`Task ${word}`).dueTime, undefined, word);
});

test("priority forms are standalone and first wins", () => {
  const cases = { "!high": 3, "!med": 2, "!medium": 2, "!low": 1, "!!!": 3, "!!": 2, "!": 1, p1: 3, p2: 2, p3: 1 };
  for (const [word, priority] of Object.entries(cases)) assert.equal(parse(`Task ${word.toUpperCase()}`).priority, priority, word);
  assert.equal(parse("Task !high !low").title, "Task !low");
  for (const word of ["wow!", "!highway", "p12", "!!!!"]) assert.equal(parse(word).priority, undefined);
});

test("tags, longest existing project and estimate syntax", () => {
  assert.deepEqual(parse("Task #Uni #work-stuff #abc_2 #5").tags, ["Uni", "work-stuff", "abc_2", "5"]);
  assert.equal(parse("@work stuff fix").projectId, 3);
  assert.equal(parse("@work stuff fix").title, "fix");
  assert.equal(parse("Task @Unknown").projectId, undefined);
  assert.equal(parse("Task @Workplace").projectId, undefined);
  assert.equal(parseTaskInput("Task @Draft", { projects: [{ title: "Draft" }] }).title, "Task @Draft");
  const cases = { "~30m": 30, "~1h": 60, "~1.5h": 90, "~1h30m": 90, "~90": 90, "est 2h": 120, "est 45min": 45 };
  for (const [word, minutes] of Object.entries(cases)) assert.equal(parse(`Task ${word}`).estimateMinutes, minutes, word);
});

test("ordinary prose and word boundaries stay literal", () => {
  for (const title of ["Read chapter 5", "C#", "Monday meeting notes", "Oct 17 meeting notes", "someday tomorrowish", "foo#bar", "name@Work", "estimate ~2hours"]) {
    const p = parse(title);
    assert.equal(p.title, title);
    assert.equal(p.tokens.length, 0);
  }
});

test("ignore keys, quotes, duplicates, connector cleanup and empty guard", () => {
  const p = parseTaskInput("Task by Saturday 5pm #uni ~2h", { now, ignore: ["date:by saturday", "time:5pm", "tag:#uni", "estimate:~2h"] });
  assert.equal(p.title, "Task by Saturday 5pm #uni ~2h");
  assert.equal(p.tokens.length, 0);
  assert.equal(parse('Read "tomorrow #uni !high at 5pm" today').title, "Read tomorrow #uni !high at 5pm");
  assert.equal(parse('Read "on" today').title, "Read on");
  assert.equal(parse("Task tomorrow today 5pm 6pm").title, "Task today 6pm");
  assert.equal(parse("Task due at 5pm").title, "Task");
  assert.equal(parse("today").title, "today");
  assert.equal(parse("#uni !high").title, "#uni !high");
  assert.equal(parse("😀 Task tomorrow").title, "😀 Task");
  assert.equal(parse("Task   tomorrow  #uni").title, "Task");
});

test("conversion includes only extracted fields and resolves time-only deadlines", () => {
  assert.deepEqual(parsedToTaskFields(parse("Task"), now), {});
  const fields = parsedToTaskFields(parse("Task #uni !high ~2h @University tomorrow 5pm"), now);
  assert.deepEqual(fields, { dueDay: "2026-10-11", dueDate: new Date(2026, 9, 11, 17), dueTime: true, tags: ["uni"], primaryTag: "uni", priority: 3, estimateMinutes: 120, projectId: 1 });
  assert.equal(parsedToTaskFields(parse("Task 5pm"), now).dueDay, "2026-10-10");
  assert.equal(parsedToTaskFields(parse("Task noon"), now).dueDay, "2026-10-11");
  assert.equal(parsedToTaskFields(parse("Task today"), now).dueTime, false);
  assert.equal(parsedToTaskFields(parse("Task tonight"), now).dueTime, true);
  assert.equal(parsedToTaskFields(parse("Task at 14"), now).dueDay, "2026-10-10");
});

test("help examples document calendar-week and midnight conventions", () => {
  const help = PARSE_EXAMPLES.flatMap(group => group.items).map(item => item.result).join(" ");
  assert.match(help, /following calendar week/);
  assert.match(help, /11:59 PM/);
});
