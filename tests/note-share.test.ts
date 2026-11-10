/** Share snapshots resolve links, carry only referenced images, and distrust what they decode. */
import "fake-indexeddb/auto";
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import db from "../lib/db";
import { buildSharedNote, decodeEmbeddedShare, embeddedShareUrl, readSharedNote, type SharedNote } from "../lib/note-share";
import type { Note } from "../lib/notes";

Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://focus.test" } } });

const now = new Date("2026-11-10T10:00:00Z");
const page: Note = { uid: "page-a", title: " Plan ", icon: "BookOpen", type: "document", createdAt: now, updatedAt: now };
const body = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Intro" }] },
    { type: "paragraph", content: [{ type: "text", text: "See " }, { type: "noteLink", attrs: { uid: "page-b", title: "Old" } }] },
    { type: "noteImage", attrs: { asset: "img-1", width: 100, align: "left" } },
  ],
};

beforeEach(async () => {
  await db.notes.clear();
  await db.noteAssets.clear();
  await db.notes.add({ uid: "page-b", title: "Reading list", type: "document", createdAt: now, updatedAt: now });
  for (const uid of ["img-1", "img-2"])
    await db.noteAssets.add({ uid, noteUid: "page-a", name: uid, type: "image/png", dataUrl: "data:image/png;base64,AAAA", width: 1, height: 1, size: 3, createdAt: now, updatedAt: now });
});

test("snapshots resolve page links to current titles and carry only referenced images", async () => {
  const shared = await buildSharedNote(page, body, true);
  assert.equal(shared.title, "Plan");
  assert.deepEqual(shared.content.content?.[1].content?.[1].attrs, { title: "Reading list" });
  assert.deepEqual(Object.keys(shared.assets), ["img-1"]);
  assert.equal((await buildSharedNote(page, body, false)).assets["img-1"], undefined);
});

test("embedded links round-trip without images", async () => {
  const shared = await buildSharedNote(page, body, true);
  const url = await embeddedShareUrl(shared);
  assert.ok(url.startsWith("https://focus.test/share#"));
  const decoded = await decodeEmbeddedShare(url.slice(url.indexOf("#")));
  assert.deepEqual(decoded, { ...shared, assets: {} });
  assert.equal(await decodeEmbeddedShare("#not-a-link"), null);
});

test("decoded payloads drop unsafe images, icons and dates", () => {
  assert.equal(readSharedNote({ v: 1, title: "x", content: { type: "paragraph" } }), null);
  assert.equal(readSharedNote({ v: 2, title: "x", content: { type: "doc" } }), null);
  const read = readSharedNote({
    v: 1, title: "x", icon: "<svg>", editedAt: "nope", sharedAt: "2026-11-01T00:00:00Z",
    content: { type: "doc" },
    assets: { ok: "data:image/png;base64,AAAA", svg: "data:image/svg+xml;base64,PHN2Zz4=", remote: "https://evil.test/a.png" },
  }) as SharedNote;
  assert.deepEqual(read.assets, { ok: "data:image/png;base64,AAAA" });
  assert.equal(read.icon, undefined);
  assert.equal(read.sharedAt, "2026-11-01T00:00:00Z");
  assert.ok(!Number.isNaN(new Date(read.editedAt).getTime()));
});
