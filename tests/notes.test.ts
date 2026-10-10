/** Notes contracts and persistence are exercised against real Dexie with fake IndexedDB. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import Dexie from "dexie";
import db from "../lib/db";
import SaveManager from "../lib/SaveManager";
import { useNotes } from "../hooks/useNotes";
import { addNoteAssets, compressImage, getNoteAsset } from "../lib/note-assets";
import {
  ancestorsOf, assetUidsIn, buildTree, childrenOf, compareSiblings,
  descendantIds, EMPTY_DOC, isTrashed, noteHref, noteTitle, orderBetween,
  parseNoteContent, plainText, NOTE_ASSET_MAX_BYTES, type Note, type NoteAsset, type NoteTreeNode,
} from "../lib/notes";
import { COLLECTION_BY_KEY } from "../lib/sync/registry";
import { IdCache, fromWire, toWire } from "../lib/sync/codec";
import { installTracking } from "../lib/sync/tracker";

const storage = new Map<string, string>();
const local = {
  get length() { return storage.size; },
  key: (i: number) => [...storage.keys()][i] ?? null,
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
};
Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true });
const at = new Date("2026-10-10T10:00:00Z");
function page(id: number, fields: Partial<Note> = {}): Note {
  return { id, uid: `page-${id}`, title: `Page ${id}`, type: "document", parentId: null, createdAt: at, updatedAt: at, ...fields };
}
function asset(noteUid: string, uid = `image-${noteUid}`): NoteAsset {
  return { uid, noteUid, name: "image.webp", type: "image/webp", dataUrl: "data:image/webp;base64,AA==",
    width: 1, height: 1, size: 1, createdAt: at, updatedAt: at };
}
const treeIds = (nodes: NoteTreeNode[]): number[] => nodes.flatMap((node) => [node.note.id!, ...treeIds(node.children)]);
const sortedIds = () => childrenOf(useNotes.getState().notes, null).map((note) => note.id);

beforeEach(async () => { await db.open(); });

afterEach(async () => {
  // Allow the existing tracker to flush its deferred bookkeeping before deleting the DB.
  await new Promise((resolve) => setTimeout(resolve, 30));
  await db.delete();
  storage.clear();
  useNotes.setState({ notes: [], loaded: false });
});

test("tree surfaces orphans, children of trash, and cycles exactly once", () => {
  const rows = [page(1, { order: 2 }), page(2, { parentId: 1 }), page(3, { parentId: 999, order: 1 }),
    page(4, { deletedAt: at }), page(5, { parentId: 4 }), page(6, { parentId: 7 }),
    page(7, { parentId: 6 }), page(8, { parentId: 8 })];
  const tree = buildTree(rows);
  assert.equal(tree[0].note.id, 3);
  assert.deepEqual(treeIds(tree).sort((a, b) => a - b), [1, 2, 3, 5, 6, 7, 8]);
  assert.equal(new Set(treeIds(tree)).size, treeIds(tree).length);
  assert.ok(tree.some((node) => node.note.id === 5));
  assert.deepEqual(buildTree([page(1, { deletedAt: at })]), []);
});

test("ancestors and descendants handle depth, missing parents, trash, and cycles", () => {
  const rows = [page(1), page(2, { parentId: 1 }), page(3, { parentId: 2, deletedAt: at }), page(4, { parentId: 3 })];
  assert.deepEqual(ancestorsOf(rows, 4).map((note) => note.id), [1, 2, 3]);
  assert.deepEqual(descendantIds(rows, 1).sort(), [2, 3, 4]);
  assert.deepEqual(ancestorsOf([page(1, { parentId: 99 })], 1), []);
  assert.deepEqual(descendantIds(rows, 99), []);
  const cycle = [page(1, { parentId: 2 }), page(2, { parentId: 1 })];
  assert.deepEqual(ancestorsOf(cycle, 1).map((note) => note.id), [2]);
  assert.deepEqual(descendantIds(cycle, 1), [2]);
});

test("ordering compares explicit keys before legacy creation dates and ids", () => {
  assert.equal(orderBetween(), 1024);
  assert.equal(orderBetween(undefined, 1024), 0);
  assert.equal(orderBetween(1024), 2048);
  assert.equal(orderBetween(1024, 2048), 1536);
  assert.equal(orderBetween(-4, -2), -3);
  const rows = [page(4), page(2), page(3, { createdAt: new Date(at.getTime() - 1) }), page(1, { order: 20 })];
  assert.deepEqual(rows.sort(compareSiblings).map((note) => note.id), [1, 3, 2, 4]);
  assert.deepEqual(childrenOf([page(1), page(2, { deletedAt: at }), page(3, { parentId: 1 })], null).map((note) => note.id), [1]);
});

test("content parsing preserves JSON and HTML and escapes legacy plain text", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
  assert.deepEqual(parseNoteContent(JSON.stringify(doc)), doc);
  assert.equal(parseNoteContent("<p><strong>Legacy</strong></p>"), "<p><strong>Legacy</strong></p>");
  assert.equal(parseNoteContent("A & B\nC < D"), "<p>A &amp; B</p><p>C &lt; D</p>");
  assert.equal(parseNoteContent("{broken"), "<p>{broken</p>");
  assert.equal(parseNoteContent('{"type":"paragraph"}'), '<p>{"type":"paragraph"}</p>');
  assert.deepEqual(parseNoteContent(undefined), EMPTY_DOC);
  assert.deepEqual(parseNoteContent("  "), EMPTY_DOC);
  assert.equal(plainText(doc), "Hello");
});

test("nested asset collection deduplicates uids and ignores external sources", () => {
  assert.deepEqual([...assetUidsIn({ type: "doc", content: [
    { type: "image", attrs: { asset: "first" } },
    { type: "callout", content: [{ type: "image", attrs: { asset: "second" } }, { type: "image", attrs: { asset: "first" } }] },
    { type: "image", attrs: { src: "https://example.com/image.png" } },
    { type: "image", attrs: { asset: "" } },
  ] })], ["first", "second"]);
  assert.equal(assetUidsIn(undefined).size, 0);
  assert.equal(noteTitle({ title: "  " }), "Untitled");
  assert.equal(noteTitle({ title: " Name " }), "Name");
  assert.equal(noteHref({ uid: "a b" }), "/notes?page=a%20b");
  assert.equal(noteHref({}), "/notes");
  assert.ok(isTrashed(page(1, { deletedAt: at })));
});

test("v16 preserves note indexes and provides unique indexed asset identities", async () => {
  await db.open();
  assert.equal(db.verno, 16);
  assert.deepEqual(db.notes.schema.indexes.map((index) => index.name), ["title", "type", "parentId", "createdAt", "updatedAt", "uid", "deletedAt", "order"]);
  assert.deepEqual(db.noteAssets.schema.indexes.map((index) => index.name), ["uid", "noteUid", "createdAt"]);
  await db.noteAssets.add(asset("page-a", "image-a"));
  await assert.rejects(db.noteAssets.add(asset("page-b", "image-a")), /ConstraintError/);
  assert.equal((await getNoteAsset("image-a"))!.noteUid, "page-a");
  assert.equal(await getNoteAsset("missing"), undefined);
});

test("v15 upgrade retains legacy pages and boards without inventing sort keys", async () => {
  const schemas = Object.fromEntries(db.tables.filter((table) => table.name !== "note_assets").map((table) => [
    table.name, table.name === "notes" ? "++id, title, type, parentId, createdAt, updatedAt, &uid" :
      [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(", "),
  ]));
  await db.delete();
  const old = new Dexie("BitFocusDB");
  old.version(15).stores(schemas);
  await old.open();
  const legacy = page(1, { type: "board", boardData: [{ category: "Legacy", children: [2] }], content: "Old body" });
  await old.table("notes").add(legacy);
  old.close();
  await db.open();
  assert.deepEqual(await db.notes.get(1), legacy);
  assert.equal(await db.noteAssets.count(), 0);
});

test("legacy loading preserves Date, board data, and undefined order until insertion", async () => {
  await db.notes.bulkAdd([page(1, { type: "board", boardData: [{ category: "Old", children: [2] }] }), page(2)]);
  await useNotes.getState().loadNotes();
  assert.ok(useNotes.getState().loaded);
  const legacy = useNotes.getState().getByUid("page-1")!;
  assert.ok(legacy.createdAt instanceof Date);
  assert.equal(legacy.order, undefined);
  assert.equal(legacy.type, "board");
  assert.deepEqual(legacy.boardData, [{ category: "Old", children: [2] }]);
  const created = await useNotes.getState().createNote();
  assert.equal(created.title, "");
  assert.equal(created.type, "document");
  assert.ok(created.id != null && created.uid);
  assert.deepEqual(sortedIds(), [1, 2, created.id]);
  const inserted = await useNotes.getState().createNote({ title: "Between", afterId: 1, icon: "FileText" });
  assert.deepEqual(sortedIds(), [1, inserted.id, 2, created.id]);
  assert.equal((await db.notes.get(inserted.id!))!.icon, "FileText");
});

test("move uses post-removal index, supports nesting, and rejects cycles and absent parents", async () => {
  const store = useNotes.getState();
  const a = await store.createNote({ title: "A" });
  const b = await store.createNote({ title: "B" });
  const c = await store.createNote({ title: "C" });
  await store.moveNote(a.id!, { parentId: null, index: 2 });
  assert.deepEqual(sortedIds(), [b.id, c.id, a.id]);
  await store.moveNote(a.id!, { parentId: null, index: 1 });
  assert.deepEqual(sortedIds(), [b.id, a.id, c.id]);
  await store.moveNote(c.id!, { parentId: a.id!, index: 0 });
  const grandchild = await store.createNote({ parentId: c.id });
  await assert.rejects(store.moveNote(a.id!, { parentId: grandchild.id!, index: 0 }), /descendant/);
  await assert.rejects(store.moveNote(a.id!, { parentId: a.id!, index: 0 }), /itself/);
  await assert.rejects(store.moveNote(a.id!, { parentId: 999, index: 0 }), /not found/);
  assert.equal((await db.notes.get(c.id!))!.parentId, a.id);
  await store.moveNote(c.id!, { parentId: null, index: 0 });
  assert.deepEqual(sortedIds(), [c.id, b.id, a.id]);
});

test("autosave updates one row optimistically without replacing unrelated rows", async () => {
  const store = useNotes.getState();
  const a = await store.createNote();
  const b = await store.createNote();
  const untouched = useNotes.getState().getByUid(b.uid!)!;
  let writes = 0;
  const count = () => { writes++; };
  db.notes.hook("updating", count);
  try {
    const saving = store.saveContent(a.id!, JSON.stringify(EMPTY_DOC));
    assert.equal(useNotes.getState().getByUid(a.uid!)!.content, JSON.stringify(EMPTY_DOC));
    await saving;
    assert.equal(writes, 1);
    assert.equal(useNotes.getState().getByUid(b.uid!), untouched);
    assert.equal((await db.notes.get(a.id!))!.content, JSON.stringify(EMPTY_DOC));
    await store.updateNote(a.id!, { title: "Updated", icon: "BookOpen" });
    assert.equal((await db.notes.get(a.id!))!.title, "Updated");
    assert.ok(useNotes.getState().getByUid(a.uid!)!.updatedAt instanceof Date);
  } finally { db.notes.hook("updating").unsubscribe(count); }
});

test("palette reloads overlapping optimistic autosave and creates preserve committed edits", async () => {
  const store = useNotes.getState();
  const note = await store.createNote();
  await Promise.all([store.loadNotes(), store.saveContent(note.id!, "Latest body")]);
  assert.equal(useNotes.getState().getByUid(note.uid!)!.content, "Latest body");
  const [created] = await Promise.all([store.createNote({ title: "New" }), store.loadNotes()]);
  assert.equal(useNotes.getState().getByUid(created.uid!)!.id, created.id);
  const [a, b] = await Promise.all([store.createNote({ title: "A" }), store.createNote({ title: "B" })]);
  assert.ok(a.order! < b.order!);
  assert.equal(useNotes.getState().notes.length, 4);
  const moving = store.moveNote(note.id!, { parentId: created.id!, index: 0 });
  const saving = store.saveContent(note.id!, "Newest body");
  await Promise.all([moving, saving, store.loadNotes()]);
  assert.equal((await db.notes.get(note.id!))!.content, "Newest body");
  assert.equal(useNotes.getState().getByUid(note.uid!)!.content, "Newest body");
});

test("trash is recursive and restore revives only descendants trashed with the page", async () => {
  const store = useNotes.getState();
  const parent = await store.createNote();
  const child = await store.createNote({ parentId: parent.id });
  const grandchild = await store.createNote({ parentId: child.id });
  const separatelyTrashed = await store.createNote({ parentId: parent.id });
  await db.notes.update(separatelyTrashed.id!, { deletedAt: at });
  await store.loadNotes();
  await store.trashNote(parent.id!);
  const rows = await db.notes.toArray();
  const stamp = rows.find((note) => note.id === parent.id)!.deletedAt!;
  assert.ok(stamp instanceof Date);
  assert.deepEqual(rows.find((note) => note.id === child.id)!.deletedAt, stamp);
  assert.deepEqual(rows.find((note) => note.id === grandchild.id)!.deletedAt, stamp);
  assert.deepEqual(rows.find((note) => note.id === separatelyTrashed.id)!.deletedAt, at);
  await assert.rejects(store.createNote({ parentId: parent.id }), /not found/);
  await store.restoreNote(parent.id!);
  assert.equal((await db.notes.get(grandchild.id!))!.deletedAt, null);
  assert.deepEqual((await db.notes.get(separatelyTrashed.id!))!.deletedAt, at);
});

test("restoring under a trashed or missing parent moves the branch to root", async () => {
  const store = useNotes.getState();
  const parent = await store.createNote();
  const child = await store.createNote({ parentId: parent.id });
  await store.trashNote(parent.id!);
  await store.restoreNote(child.id!);
  assert.equal((await db.notes.get(child.id!))!.parentId, null);
  assert.ok((await db.notes.get(parent.id!))!.deletedAt);
  await db.notes.add(page(99, { parentId: 777, deletedAt: at }));
  await store.loadNotes();
  await store.restoreNote(99);
  assert.equal((await db.notes.get(99))!.parentId, null);
});

test("permanent deletion removes all descendants and assets and records both tombstones", async () => {
  Object.defineProperty(globalThis, "window", { value: { localStorage: local }, configurable: true });
  installTracking();
  const store = useNotes.getState();
  const parent = await store.createNote();
  const child = await store.createNote({ parentId: parent.id });
  const grandchild = await store.createNote({ parentId: child.id });
  const other = await store.createNote();
  for (const note of [parent, child, grandchild, other]) await db.noteAssets.add(asset(note.uid!));
  await store.deleteNoteForever(parent.id!);
  assert.deepEqual((await db.notes.toArray()).map((note) => note.uid), [other.uid]);
  assert.deepEqual((await db.noteAssets.toArray()).map((row) => row.noteUid), [other.uid]);
  assert.deepEqual(useNotes.getState().notes.map((note) => note.uid), [other.uid]);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal((await db.syncState.get(["notes", parent.uid!]))!.deleted, 1);
  assert.equal((await db.syncState.get(["noteAssets", `image-${child.uid}`]))!.deleted, 1);
});

test("empty Trash removes trashed pages and their images and preserves visible pages", async () => {
  const store = useNotes.getState();
  const trashed = await store.createNote();
  const visible = await store.createNote();
  await db.noteAssets.bulkAdd([asset(trashed.uid!), asset(visible.uid!)]);
  await store.trashNote(trashed.id!);
  await store.emptyTrash();
  assert.deepEqual(useNotes.getState().notes.map((note) => note.uid), [visible.uid]);
  assert.deepEqual((await db.noteAssets.toArray()).map((row) => row.noteUid), [visible.uid]);
});

test("failed multi-row deletion and edits roll back persistence and optimistic state", async () => {
  const store = useNotes.getState();
  const parent = await store.createNote();
  const child = await store.createNote({ parentId: parent.id });
  await db.noteAssets.add(asset(parent.uid!));
  const fail = () => { throw new Error("Write failed"); };
  db.notes.hook("deleting", fail);
  try {
    await assert.rejects(store.deleteNoteForever(parent.id!), /Write failed/);
    assert.equal(await db.notes.count(), 2);
    assert.equal(await db.noteAssets.count(), 1);
    assert.equal(useNotes.getState().notes.length, 2);
  } finally { db.notes.hook("deleting").unsubscribe(fail); }
  db.notes.hook("updating", fail);
  try {
    await assert.rejects(store.trashNote(parent.id!), /Write failed/);
    assert.ok(!useNotes.getState().getByUid(child.uid!)!.deletedAt);
    await assert.rejects(store.saveContent(parent.id!, "Changed"), /Write failed/);
    assert.equal(useNotes.getState().getByUid(parent.uid!)!.content, "");
    assert.equal((await db.notes.get(parent.id!))!.content, "");
  } finally { db.notes.hook("updating").unsubscribe(fail); }
});

test("sync codec revives trash and image dates while keeping noteUid untranslated", async () => {
  const notes = COLLECTION_BY_KEY.get("notes")!;
  const wire = await toWire(notes, page(1, { deletedAt: at, icon: "FileText", order: 42 }) as unknown as Record<string, unknown>, new IdCache());
  assert.equal(wire.deletedAt, at.toISOString());
  const decoded = await fromWire(notes, wire, "page-a", new IdCache());
  assert.deepEqual(decoded.row.deletedAt, at);
  assert.equal(decoded.row.icon, "FileText");
  assert.equal(decoded.row.order, 42);
  const images = COLLECTION_BY_KEY.get("noteAssets")!;
  assert.equal(images.order, 3);
  assert.equal(images.refs, undefined);
  const imageWire = await toWire(images, asset("page-a") as unknown as Record<string, unknown>, new IdCache());
  assert.equal(imageWire.noteUid, "page-a");
  assert.equal(imageWire.createdAt, at.toISOString());
  assert.deepEqual((await fromWire(images, imageWire, "image-a", new IdCache())).row.updatedAt, at);
});

test("manual backups restore note metadata and assets; omitted assets stay untouched", async () => {
  const note = page(1, { icon: "FileText", order: 42, deletedAt: at, content: JSON.stringify(EMPTY_DOC) });
  await db.notes.add(note);
  await db.noteAssets.add(asset(note.uid!));
  const automatic = await SaveManager.exportJSON();
  assert.equal(automatic.indexedDB.noteAssets, undefined);
  const manual = await SaveManager.exportJSON({ includeAttachments: true });
  assert.equal(manual.indexedDB.notes[0].deletedAt, at.toISOString());
  assert.equal(manual.indexedDB.noteAssets![0].createdAt, at.toISOString());
  await db.noteAssets.clear();
  await SaveManager.importJSON(JSON.parse(JSON.stringify(manual)));
  assert.deepEqual((await db.notes.get(1))!.deletedAt, at);
  assert.equal((await db.notes.get(1))!.content, note.content);
  assert.equal((await db.notes.get(1))!.icon, "FileText");
  assert.equal((await db.notes.get(1))!.order, 42);
  assert.ok((await db.noteAssets.toArray())[0].updatedAt instanceof Date);
  await SaveManager.importJSON(automatic);
  assert.equal(await db.noteAssets.count(), 1);
  manual.indexedDB.noteAssets = [];
  await SaveManager.importJSON(manual);
  assert.equal(await db.noteAssets.count(), 0);
});

test("compression rejects non-image blobs before calling browser APIs", async () => {
  await assert.rejects(compressImage(new Blob(["Text"], { type: "text/plain" })), /Only image files/);
});

test("image compression scales SVG, steps quality, falls back to JPEG, and keeps small GIFs", async () => {
  const globals = ["createImageBitmap", "OffscreenCanvas", "HTMLCanvasElement", "FileReader"];
  const previous = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let width = 4800;
  let height = 1200;
  let closed = 0;
  let webpSupported = true;
  const encodes: { type: string; quality: number }[] = [];
  const draws: number[][] = [];
  class Reader {
    result: string | null = null;
    onload: (() => void) | null = null;
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onload?.();
      });
    }
  }
  class Canvas {
    constructor(public width: number, public height: number) {}
    getContext() { return { drawImage: (_source: unknown, _x: number, _y: number, w: number, h: number) => draws.push([w, h]) }; }
    async convertToBlob(options: { type: string; quality: number }) {
      encodes.push(options);
      if (!webpSupported && options.type === "image/webp") return new Blob(["png"], { type: "image/png" });
      return new Blob([options.quality === 0.9 ? new Uint8Array(NOTE_ASSET_MAX_BYTES + 1) : "small"], { type: options.type });
    }
  }
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => ({ width, height, close: () => { closed++; } }) });
  Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Canvas });
  Object.defineProperty(globalThis, "HTMLCanvasElement", { configurable: true, value: class {} });
  Object.defineProperty(globalThis, "FileReader", { configurable: true, value: Reader });
  try {
    const scaled = await compressImage(new Blob(["<svg/>"], { type: "image/svg+xml" }));
    assert.equal(scaled.type, "image/webp");
    assert.deepEqual([scaled.width, scaled.height], [2400, 600]);
    assert.deepEqual(draws, [[2400, 600]]);
    assert.deepEqual(encodes.map((entry) => entry.quality), [0.9, 0.8]);
    assert.equal(scaled.size, 5);
    assert.equal(scaled.dataUrl, "data:image/webp;base64,c21hbGw=");
    webpSupported = false;
    encodes.length = 0;
    assert.equal((await compressImage(new Blob(["png"], { type: "image/png" }))).type, "image/jpeg");
    assert.deepEqual(encodes.map((entry) => entry.type), ["image/webp", "image/jpeg", "image/jpeg"]);
    width = 100;
    height = 50;
    encodes.length = 0;
    const gif = new File(["gif"], "animation.gif", { type: "image/gif" });
    const kept = await compressImage(gif);
    assert.equal(kept.type, "image/gif");
    assert.equal(kept.dataUrl, "data:image/gif;base64,Z2lm");
    assert.equal(encodes.length, 0);
    const stored = await addNoteAssets("page-images", [new File(["Text"], "text.txt", { type: "text/plain" }), gif]);
    assert.equal(stored.length, 1);
    assert.ok(stored[0].id != null);
    assert.equal((await getNoteAsset(stored[0].uid))!.noteUid, "page-images");
    assert.equal(closed, 4);
  } finally {
    for (const key of globals) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
