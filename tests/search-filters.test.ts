import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_TASK_FILTERS, filterTaskTree } from "../lib/task-search";
import { createNoteSearchIndex, matchesNoteSearch, noteSearchSnippet, noteSearchText } from "../lib/note-search";
import type { Task } from "../lib/tasks";
import type { Note } from "../lib/notes";

const now = new Date(2026, 10, 11, 12);
function task(id: number, fields: Partial<Task> = {}): Task {
  return { id, title: `Task ${id}`, description: "", tags: [], priority: 0, order: id,
    estimateMinutes: 0, createdAt: now, updatedAt: now, ...fields };
}
function note(id: number, fields: Partial<Note> = {}): Note {
  return { id, title: `Page ${id}`, type: "document", createdAt: now, updatedAt: now, ...fields };
}

test("task filters combine text, exact tag, priority, and local overdue rules", () => {
  const tasks = [
    task(1, { description: "<p>Ship &amp; review</p>", tags: ["Work"], priority: 3, dueDate: new Date(2026, 10, 10) }),
    task(2, { title: "Ship & review", tags: ["Work"], priority: 3, dueDate: new Date(2026, 10, 11) }),
    task(3, { title: "Ship & review", tags: ["Homework"], priority: 3, dueDate: new Date(2026, 10, 10) }),
    task(4, { title: "Ship & review", tags: ["Work"], priority: 2, dueDate: new Date(2026, 10, 10) }),
  ];
  const result = filterTaskTree(tasks, { text: "review ship", tag: "work", priority: "3", overdue: true }, now);
  assert.deepEqual(result.tasks.map((task) => task.id), [1]);
  assert.equal(filterTaskTree(tasks, { ...EMPTY_TASK_FILTERS, priority: "0" }).matches, 0);
  assert.equal(filterTaskTree(tasks, EMPTY_TASK_FILTERS).tasks, tasks);
  assert.equal(filterTaskTree([task(5, { primaryTag: "Legacy" })], { ...EMPTY_TASK_FILTERS, tag: "legacy" }).matches, 1);
});

test("matching subtasks retain and expand only their in-scope ancestors", () => {
  const tasks = [task(1), task(2, { parentId: 1, title: "Needle" }), task(3, { parentId: 1 }), task(4, { parentId: 99, title: "Needle" })];
  const result = filterTaskTree(tasks, { ...EMPTY_TASK_FILTERS, text: "needle" });
  assert.deepEqual(result.tasks.map((task) => task.id), [1, 2, 4]);
  assert.deepEqual([...result.expanded], [1]);
  assert.equal(result.matches, 2);
  const cycle = [task(1, { parentId: 2 }), task(2, { parentId: 1, title: "Needle" })];
  assert.equal(filterTaskTree(cycle, { ...EMPTY_TASK_FILTERS, text: "needle" }).tasks.length, 2);
});

test("note extraction handles formatted Tiptap, legacy HTML, and malformed content safely", () => {
  const content = JSON.stringify({ type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Con" }, { type: "text", text: "tent", marks: [{ type: "bold" }] }] },
    { type: "paragraph", content: [{ type: "text", text: "search" }] },
  ] });
  assert.equal(noteSearchText(content), "Content search");
  assert.equal(noteSearchText('<p>Fish &amp; chips</p><script>secret</script>'), "Fish & chips");
  assert.equal(noteSearchText('{"broken":'), '{"broken":');
  assert.equal(noteSearchText('{"type":"doc","content":[null,42,{"content":"bad"}]}'), "");
  assert.equal(noteSearchText(undefined), "");
});

test("note index excludes templates/trash, refreshes changed bodies and prunes removed pages", () => {
  const index = createNoteSearchIndex();
  const notes = [note(1, { content: "old body" }), note(2, { isTemplate: true }), note(3, { deletedAt: now })];
  assert.deepEqual(index(notes).map((entry) => entry.text), ["old body"]);
  assert.equal(index([{ ...notes[0], title: "Renamed" }])[0].title, "Renamed");
  assert.equal(index([{ ...notes[0], content: "new body" }])[0].text, "new body");
  assert.deepEqual(index([]), []);
  assert.equal(index([notes[0]])[0].text, "old body");
});

test("note snippets center body matches and omit unrelated content", () => {
  const text = `${"before ".repeat(30)}Unique body result ${"after ".repeat(30)}`;
  const snippet = noteSearchSnippet(text, "unique");
  assert.match(snippet, /Unique body result/);
  assert.ok(snippet.startsWith("…"));
  assert.ok(snippet.endsWith("…"));
  assert.equal(noteSearchSnippet(text, "missing"), "");
  assert.equal(noteSearchSnippet(text, "  "), "");
});

test("palette note matching searches all tokens across title and body keywords", () => {
  assert.equal(matchesNoteSearch("note 1 Planning", "  planning COBALT ", ["The cobalt milestone is ready"]), true);
  assert.equal(matchesNoteSearch("note 1 Planning", "cobalt missing", ["The cobalt milestone is ready"]), false);
  assert.equal(matchesNoteSearch("note 1 Planning", "", []), true);
});
