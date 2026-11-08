/** Stable page references and template copies survive sync, deletion, and offline reuse. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import db from "../lib/db";
import { useNotes } from "../hooks/useNotes";
import { buildTree, childrenOf, createBacklinkIndex, noteLinkUidsIn, parseNoteContent, plainText, type Note, type NoteAsset } from "../lib/notes";
import { NoteLink } from "../components/notes/extensions/note-link";
import { noteContentToMarkdown } from "../lib/note-markdown";
import { prepareNoteCopy } from "../lib/note-copy";
import { STARTER_TEMPLATES, TEMPLATE_SEED_KEY } from "../lib/note-templates";
import { COLLECTION_BY_KEY } from "../lib/sync/registry";
import { fromWire, IdCache, toWire } from "../lib/sync/codec";
import { validateBackup } from "../lib/backup-validation";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
const now = new Date("2026-11-08T12:00:00Z");
const page = (uid: string, fields: Partial<Note> = {}): Note => ({ uid, title: uid, type: "document", createdAt: now, updatedAt: now, ...fields });
const link = (uid: string, title = uid) => ({ type: "noteLink", attrs: { uid, title } });
const content = (...nodes: object[]) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: nodes }] });

beforeEach(async () => { await db.open(); });

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
  await db.delete();
  storage.clear();
  useNotes.setState({ notes: [], loaded: false });
});

test("inline atoms preserve uids, fallback titles, current titles, and Markdown references", () => {
  const body = content({ type: "text", text: "Read " }, link("target", "Original"));
  const parsed = parseNoteContent(body);
  assert.notEqual(typeof parsed, "string");
  if (typeof parsed === "string") return;
  const schema = getSchema([StarterKit, NoteLink]);
  const doc = schema.nodeFromJSON(parsed);
  assert.equal(doc.firstChild!.lastChild!.isAtom, true);
  assert.equal(doc.firstChild!.lastChild!.isInline, true);
  assert.equal(doc.toJSON().content[0].content[1].attrs.uid, "target");
  assert.match(plainText(parsed), /Original/);
  assert.match(plainText(parsed, [page("target", { title: "Renamed" })]), /Renamed/);
  assert.equal(noteContentToMarkdown(body, [page("target", { title: "Renamed" })]), "Read [[Renamed]]");
  assert.equal(noteContentToMarkdown(body), "Read [[Original]]");
  assert.deepEqual([...noteLinkUidsIn(parsed)], ["target"]);
});

test("backlinks deduplicate, ignore templates/trash, and follow edited bodies", () => {
  const index = createBacklinkIndex();
  const source = page("source", { content: content(link("target"), link("target")) });
  const template = page("template", { isTemplate: true, content: source.content });
  const trashed = page("trashed", { deletedAt: now, content: source.content });
  const self = page("target", { content: content(link("target")) });
  assert.deepEqual(index([source, template, trashed, self]).get("target")?.map((note) => note.uid), ["source", "target"]);
  const renamed = { ...source, title: "New source title" };
  assert.equal(index([renamed]).get("target")?.[0], renamed);
  assert.equal(index([{ ...renamed, content: content(link("other")) }]).has("target"), false);
  assert.equal(index([]).size, 0);
});

test("templates stay outside page trees and cannot become regular-page parents", async () => {
  const template = await useNotes.getState().createNote({ isTemplate: true, title: "Template" });
  const regular = await useNotes.getState().createNote({ title: "Page" });
  assert.deepEqual(buildTree(useNotes.getState().notes).map((node) => node.note.uid), [regular.uid]);
  assert.deepEqual(childrenOf(useNotes.getState().notes, null).map((note) => note.uid), [regular.uid]);
  await assert.rejects(useNotes.getState().createNote({ parentId: template.id }), /Parent page not found/);
  await assert.rejects(useNotes.getState().moveNote(regular.id!, { parentId: template.id!, index: 0 }), /Parent page not found/);
});

test("copying templates clones assets once per new owner and survives deleting the source", async () => {
  const template = await useNotes.getState().createNote({ title: "Illustrated", icon: "Sun", isTemplate: true });
  const asset: NoteAsset = { uid: "image-original", noteUid: template.uid!, name: "image.webp", type: "image/webp", dataUrl: "data:image/webp;base64,AA==", width: 1, height: 1, size: 1, createdAt: now, updatedAt: now };
  await db.noteAssets.add(asset);
  const body = JSON.stringify({ type: "doc", content: [{ type: "noteImage", attrs: { asset: asset.uid } }, { type: "noteImage", attrs: { asset: asset.uid } }, { type: "paragraph", content: [link("other-page")] }] });
  await useNotes.getState().saveContent(template.id!, body);
  const source = useNotes.getState().getByUid(template.uid!)!;
  const copy = await useNotes.getState().createNote({ copyFrom: source });
  assert.equal(copy.title, "Illustrated");
  assert.equal(copy.icon, "Sun");
  assert.equal(copy.isTemplate, undefined);
  const assets = await db.noteAssets.where("noteUid").equals(copy.uid!).toArray();
  assert.equal(assets.length, 1);
  assert.notEqual(assets[0].uid, asset.uid);
  const parsed = JSON.parse(copy.content!);
  assert.equal(parsed.content[0].attrs.asset, assets[0].uid);
  assert.equal(parsed.content[1].attrs.asset, assets[0].uid);
  assert.equal(parsed.content[2].content[0].attrs.uid, "other-page");
  await useNotes.getState().deleteNoteForever(template.id!);
  assert.equal(await db.noteAssets.where("uid").equals(asset.uid).count(), 0);
  assert.equal(await db.noteAssets.where("uid").equals(assets[0].uid).count(), 1);
  const duplicate = await useNotes.getState().createNote({ isTemplate: true, copyFrom: copy });
  assert.equal(duplicate.isTemplate, true);
  assert.equal((await db.noteAssets.where("noteUid").equals(duplicate.uid!).toArray()).length, 1);
});

test("missing images block copies atomically and draft journals supply latest edits", async () => {
  const template = await useNotes.getState().createNote({ isTemplate: true });
  const missing = { ...template, content: JSON.stringify({ type: "doc", content: [{ type: "noteImage", attrs: { asset: "not-synced" } }] }) };
  await assert.rejects(useNotes.getState().createNote({ copyFrom: missing }), /not on this device/);
  assert.equal(await db.notes.count(), 1);
  storage.set(`bitfocus.notes.bodyDraft.${template.uid}`, content(link("new-link")));
  storage.set(`bitfocus.notes.titleDraft.${template.uid}`, "Pending title");
  const copy = await useNotes.getState().createNote({ copyFrom: template });
  assert.equal(copy.title, "Pending title");
  assert.match(copy.content!, /new-link/);
  const prepared = await prepareNoteCopy("<p>Legacy</p>", copy.uid!);
  assert.equal(prepared.content, "<p>Legacy</p>");
});

test("first-visit seeding is idempotent, remembers deletion, and respects existing templates", async () => {
  await Promise.all([useNotes.getState().seedTemplates(), useNotes.getState().seedTemplates()]);
  assert.equal(await db.notes.count(), 3);
  assert.equal(storage.get(TEMPLATE_SEED_KEY), "1");
  for (const starter of STARTER_TEMPLATES) assert.equal(useNotes.getState().getByUid(starter.uid)?.isTemplate, true);
  await useNotes.getState().deleteNoteForever(useNotes.getState().notes[0].id!);
  await useNotes.getState().seedTemplates();
  assert.equal(await db.notes.count(), 2);
  storage.clear();
  await useNotes.getState().seedTemplates();
  assert.equal(await db.notes.count(), 2);
});

test("template flags and UID link JSON round-trip through sync and backup validation", async () => {
  const template = await useNotes.getState().createNote({ isTemplate: true, title: "Portable" });
  const body = content(link("stable-target", "Target"));
  const row = { ...template, content: body };
  const col = COLLECTION_BY_KEY.get("notes")!;
  const wire = await toWire(col, row as unknown as Record<string, unknown>, new IdCache());
  assert.equal(wire.isTemplate, true);
  assert.equal(wire.content, body);
  const decoded = await fromWire(col, wire, template.uid!, new IdCache());
  assert.equal(decoded.row.isTemplate, true);
  assert.equal(decoded.row.content, body);
  const backup = { localStorage: {}, indexedDB: { configuration: [], focus: [], notes: [{ ...row, createdAt: now.toISOString(), updatedAt: now.toISOString() }] } };
  validateBackup(backup);
  assert.equal(backup.indexedDB.notes[0].isTemplate, true);
});
