import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";
import { convertToModelMessages } from "ai";
import { attachmentsOf, branchMessages, exportChat, isSourceHref, messagesWithAttachments, searchChat, sourcesOf } from "../lib/ai-conversations";
import { useAIChat } from "../hooks/useAIChat";
import db from "../lib/db";

const attachment = { key: "note:n1", label: "Note: Research", href: "/notes?page=n1", content: "Private selected content" };
const user: UIMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "Discuss my launch" }, { type: "data-attachment", data: attachment }] };
const assistant: UIMessage = { id: "a1", role: "assistant", parts: [{ type: "text", text: "The milestone is a November release." }, { type: "tool-getProjectsOverview", toolCallId: "call", state: "output-available", input: {}, output: { sources: [{ label: "Launch", href: "/projects?project=1" }] } }] };

test("history search finds message text case insensitively without indexing tool payloads", () => {
  const serialized = JSON.stringify([user, assistant]);
  assert.match(searchChat("New Chat", serialized, "NOVEMBER")!, /November/);
  assert.equal(searchChat("New Chat", serialized, "Private selected content"), null);
  assert.equal(searchChat("Launch", serialized, "launch"), "");
  assert.equal(searchChat("New Chat", "broken JSON", "release"), null);
});

test("selected attachment snapshots survive serialization and reach model as user data", async () => {
  const restored = JSON.parse(JSON.stringify(user));
  assert.deepEqual(attachmentsOf(restored), [attachment]);
  const prepared = messagesWithAttachments([restored]);
  assert.equal(prepared[0].parts.some((part) => part.type === "data-attachment"), false);
  const model = await convertToModelMessages(prepared);
  assert.match(JSON.stringify(model), /Private selected content/);
  assert.match(JSON.stringify(model), /untrusted content/);
  assert.equal(user.parts.length, 2);
  const malformed = { ...user, parts: [{ type: "data-attachment", data: { ...attachment, href: "javascript:alert(1)" } }] } as UIMessage;
  assert.deepEqual(attachmentsOf(malformed), []);
  assert.equal(isSourceHref("//evil.example/projects"), false);
  assert.equal(isSourceHref("/projects\\evil"), false);
});

test("only explicitly attached user data is expanded, with a bounded size", () => {
  const oversized = { ...user, parts: [{ type: "data-attachment", data: { ...attachment, content: "x".repeat(20000) } }] } as UIMessage;
  assert.ok(JSON.stringify(messagesWithAttachments([oversized])).length < 13000);
  assert.deepEqual(messagesWithAttachments([{ ...oversized, role: "assistant" }])[0].parts, []);
});

test("branching keeps history through the selected reply, excludes pending actions and isolates edits", () => {
  const pending = { type: "tool-createTask", toolCallId: "pending", state: "input-available", input: { title: "Do not execute" } };
  const reply = { ...assistant, parts: [...assistant.parts, pending] } as UIMessage;
  const original = [user, reply, { ...user, id: "u2" }];
  const branch = branchMessages(original, "a1");
  assert.equal(branch.length, 2);
  assert.equal(branch[1].parts.length, 2);
  assert.deepEqual(attachmentsOf(branch[0]), [attachment]);
  branch[0].parts = [];
  assert.equal(original[0].parts.length, 2);
  assert.equal(original[1].parts.length, 3);
  assert.throws(() => branchMessages(original, "missing"), /not found/);
});

test("source chips reject non-app URLs and Markdown export includes source references", () => {
  assert.deepEqual(sourcesOf(assistant), [{ label: "Launch", href: "/projects?project=1" }]);
  const markdown = exportChat("Launch review", [user, assistant]);
  assert.match(markdown, /# Launch review/);
  assert.match(markdown, /## You/);
  assert.match(markdown, /## Assistant/);
  assert.match(markdown, /\[Note: Research\]\(\/notes\?page=n1\)/);
  assert.match(markdown, /\[Launch\]\(\/projects\?project=1\)/);
  assert.ok(!markdown.includes("Private selected content"));
});

test("branched chats persist their messages, context, and chosen model without mutating the original", async () => {
  await db.open();
  try {
    const store = useAIChat.getState();
    const original = await store.createChat("model-old");
    await store.setChatContextSources(original.id, ["profile"]);
    await store.saveMessages(original.id, [user, assistant]);
    const branch = await store.branchChat(original.id, "model-new", branchMessages([user, assistant], "a1"));
    assert.notEqual(branch.id, original.id);
    assert.equal(branch.modelId, "model-new");
    assert.equal(branch.contextSources, JSON.stringify(["profile"]));
    assert.equal(branch.pinned, false);
    assert.equal((await db.aiChats.get(original.id))!.modelId, "model-old");
    assert.deepEqual(await store.loadMessages(branch.id), [user, assistant]);
    await store.saveMessages(branch.id, [user]);
    assert.equal((await store.loadMessages(original.id)).length, 2);
  } finally { await db.aiChats.clear(); db.close(); }
});
