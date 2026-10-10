/**
 * Notes - Shared Types and Pure Helpers
 *
 * Notes are pages arranged in a tree. Each page stores its body as a Tiptap
 * JSON document (serialized into `content`), points at its parent by local id
 * (the sync registry translates that to a uid on the wire), and orders itself
 * among its siblings with a fractional `order` so a move rewrites one row.
 *
 * Images live in their own synced table (`noteAssets`) as compressed data
 * URLs. A page body only references an image by asset uid, which keeps every
 * page record small and lets one image change without resending the page.
 *
 * Everything here is free of Dexie and React so it can be unit tested.
 *
 * @fileoverview Note types, tree helpers, and content parsing.
 * @since v0.23.4
 */

import type { JSONContent } from "@tiptap/core";

/** A page in the notes tree. */
export interface Note {
  id?: number;
  uid?: string;
  title: string;
  /** Legacy discriminator. Every page is a document now; boards are read as documents. */
  type: "document" | "board";
  /** Lucide icon name, picked with the same picker projects use. */
  icon?: string;
  /** Local id of the parent page, or null at the root. */
  parentId?: number | null;
  /** Sort key among siblings. Lower first. Fractional so moves touch one row. */
  order?: number;
  /** Serialized Tiptap JSON document. Legacy rows may hold HTML or plain text. */
  content?: string;
  /** Legacy board columns. Kept so old rows round-trip through sync untouched. */
  boardData?: { category: string; children: number[] }[];
  /** Set when the page is in Trash. Descendants trashed with it share the stamp. */
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** An image embedded in a page. Synced, so it is stored as a data URL. */
export interface NoteAsset {
  id?: number;
  uid: string;
  /** Page the image was added to. Plain uid, needs no id translation. */
  noteUid: string;
  name: string;
  /** MIME type of the stored data. */
  type: string;
  /** `data:` URL of the (usually recompressed) image. */
  dataUrl: string;
  width: number;
  height: number;
  /** Byte length of the encoded image. */
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Largest single image record. The sync server caps a record at ~4.5 MB. */
// Base64 adds one third: leave room under the sync engine's 4.5 MB row cap.
export const NOTE_ASSET_MAX_BYTES = 3_300_000;

/** A node of the visible (non-trashed) notes tree. */
export interface NoteTreeNode {
  note: Note;
  children: NoteTreeNode[];
}

/** An empty Tiptap document. */
export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/** True when the page is in Trash. */
export function isTrashed(note: Note): boolean {
  return note.deletedAt instanceof Date || (note.deletedAt != null && !Number.isNaN(new Date(note.deletedAt).getTime()));
}

/** Sibling comparator: explicit order first, then creation time, then id. */
export function compareSiblings(a: Note, b: Note): number {
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao < bo ? -1 : 1;
  const at = new Date(a.createdAt).getTime();
  const bt = new Date(b.createdAt).getTime();
  if (at !== bt) return at - bt;
  return (a.id ?? 0) - (b.id ?? 0);
}

/** Visible children of a parent (null for root), sorted. */
export function childrenOf(notes: readonly Note[], parentId: number | null): Note[] {
  return notes
    .filter((note) => !isTrashed(note) && (note.parentId ?? null) === parentId)
    .sort(compareSiblings);
}

/**
 * Build the visible tree. A page whose parent is missing or trashed is shown at
 * the root rather than vanishing, so an out-of-order sync never hides data.
 */
export function buildTree(notes: readonly Note[]): NoteTreeNode[] {
  const visible = notes.filter((note) => !isTrashed(note) && note.id != null);
  const ids = new Set(visible.map((note) => note.id as number));
  const byParent = new Map<number | null, Note[]>();
  for (const note of visible) {
    const parent = note.parentId != null && ids.has(note.parentId) && note.parentId !== note.id ? note.parentId : null;
    const list = byParent.get(parent) ?? [];
    list.push(note);
    byParent.set(parent, list);
  }
  const seen = new Set<number>();
  const build = (parent: number | null): NoteTreeNode[] =>
    (byParent.get(parent) ?? []).sort(compareSiblings).flatMap((note) => {
      const id = note.id as number;
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ note, children: build(id) }];
    });
  const roots = build(null);
  // Pages caught in a parent cycle (only possible through conflicting syncs)
  // never get reached from the root. Surface them at the top level.
  for (const note of visible.sort(compareSiblings)) {
    if (!seen.has(note.id as number)) {
      seen.add(note.id as number);
      roots.push({ note, children: build(note.id as number) });
    }
  }
  return roots;
}

/** Ancestors of a page, root first, excluding the page itself. Cycle-safe. */
export function ancestorsOf(notes: readonly Note[], id: number): Note[] {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const chain: Note[] = [];
  const seen = new Set<number>([id]);
  let parent = byId.get(id)?.parentId ?? null;
  while (parent != null && !seen.has(parent)) {
    seen.add(parent);
    const note = byId.get(parent);
    if (!note) break;
    chain.unshift(note);
    parent = note.parentId ?? null;
  }
  return chain;
}

/** Ids of every descendant of a page (trashed or not), excluding the page. */
export function descendantIds(notes: readonly Note[], id: number): number[] {
  const byParent = new Map<number, number[]>();
  for (const note of notes) {
    if (note.id == null || note.parentId == null) continue;
    const list = byParent.get(note.parentId) ?? [];
    list.push(note.id);
    byParent.set(note.parentId, list);
  }
  const out: number[] = [];
  const seen = new Set<number>([id]);
  const stack = [...(byParent.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop() as number;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    stack.push(...(byParent.get(next) ?? []));
  }
  return out;
}

/**
 * A sort key strictly between two neighbours. Either side may be missing
 * (start or end of the list).
 */
export function orderBetween(before?: number, after?: number): number {
  if (before == null && after == null) return 1024;
  if (before == null) return (after as number) - 1024;
  if (after == null) return before + 1024;
  return (before + after) / 2;
}

/** Escape text for inclusion in HTML. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Read a page body for the editor.
 *
 * Returns a Tiptap JSON document when the content is one, HTML for legacy rows
 * (which Tiptap parses itself), and an empty document otherwise.
 */
export function parseNoteContent(content: string | undefined | null): JSONContent | string {
  const raw = (content ?? "").trim();
  if (!raw) return EMPTY_DOC;
  if (raw.startsWith("{")) {
    try {
      const doc = JSON.parse(raw) as JSONContent;
      if (doc && doc.type === "doc") return doc;
    } catch {
      /* Not JSON: fall through and treat as text. */
    }
  }
  if (raw.startsWith("<")) return raw;
  return raw
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

/** Plain text of a Tiptap JSON node, for search and previews. */
export function plainText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const parts = (node.content ?? []).map(plainText);
  const block = node.type && node.type !== "doc" && node.type !== "text";
  return parts.join(block ? " " : "\n");
}

/** Asset uids referenced by a page body. */
export function assetUidsIn(node: JSONContent | undefined, out = new Set<string>()): Set<string> {
  if (!node) return out;
  const asset = node.attrs?.asset;
  if (typeof asset === "string" && asset) out.add(asset);
  for (const child of node.content ?? []) assetUidsIn(child, out);
  return out;
}

/** Display title, with the placeholder for an unnamed page. */
export function noteTitle(note: Pick<Note, "title"> | undefined): string {
  return note?.title?.trim() || "Untitled";
}

/** Link target for a page. Pages are addressed by uid so links survive sync. */
export function noteHref(note: Pick<Note, "uid">): string {
  return note.uid ? `/notes?page=${encodeURIComponent(note.uid)}` : "/notes";
}

/** Icon shown for a page that has not picked one. */
export const NOTE_ICON = "FileText";
