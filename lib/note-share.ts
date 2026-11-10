/**
 * Notes - Shareable Read-Only Links
 *
 * A shared page is a snapshot: title, icon, body and the images it uses,
 * frozen at the moment it is shared (and again whenever the sharer updates
 * it). Viewers need no account and no BIT Focus data of their own.
 *
 * Two kinds of link carry the snapshot:
 *
 * - **Short links** (`/share/<id>`) store it in the `focus_shares` collection.
 *   Creating one needs a connected account; reading one does not, because the
 *   collection's view rule is public while its list rule is owner-only, so a
 *   link cannot be found without being given it.
 * - **Embedded links** (`/share#<data>`) hold the compressed snapshot in the
 *   URL fragment. Nothing is uploaded, so they work signed out, but they are
 *   long and leave images out.
 *
 * Everything a viewer loads came from someone else, so `readSharedNote`
 * rebuilds the payload field by field rather than trusting its shape.
 *
 * @fileoverview Share payloads, link encoding, and the share collection.
 * @since v0.25.2
 */

import type { JSONContent } from "@tiptap/core";
import { ClientResponseError } from "pocketbase";
import db from "@/lib/db";
import { noteLinkTitle, parseNoteContent, type Note } from "@/lib/notes";
import { pb, SHARES_COLLECTION } from "@/lib/pocketbase";

/** Snapshot a viewer renders. */
export interface SharedNote {
  v: 1;
  title: string;
  icon?: string;
  /** Tiptap JSON body. Page links carry their title, since viewers have no pages. */
  content: JSONContent;
  /** Image data URLs keyed by asset uid. Empty in embedded links. */
  assets: Record<string, string>;
  /** When the page itself was last edited, ISO. */
  editedAt: string;
  /** When this snapshot was taken, ISO. */
  sharedAt: string;
}

/** A page's short link, as its owner sees it. */
export interface ShareRecord {
  id: string;
  /** When the snapshot was last written, ISO. */
  updated: string;
}

/** Thrown when the server has no share collection; callers fall back to embedded links. */
export class SharesUnavailableError extends Error {
  constructor() {
    super("Short links are not set up on this server");
  }
}

/** Short links stay under the sync server's ~4.5 MB request cap. */
const SHORT_LINK_MAX_BYTES = 4_000_000;

/** Path of the viewer route. */
export const SHARE_PATH = "/share";

/** Absolute URL for a short link. */
export function shortShareUrl(id: string): string {
  return `${window.location.origin}${SHARE_PATH}/${encodeURIComponent(id)}`;
}

/** A stored page body as Tiptap JSON. Legacy HTML rows go through the editor schema. */
export async function noteContentJSON(content: string | undefined): Promise<JSONContent> {
  const parsed = parseNoteContent(content);
  if (typeof parsed !== "string") return parsed;
  const [{ generateJSON }, { noteExtensions }] = await Promise.all([import("@tiptap/core"), import("@/lib/note-extensions")]);
  return generateJSON(parsed, noteExtensions({ editable: false, headless: true }));
}

/**
 * Build a snapshot of a page.
 *
 * @param note - The page, with its live body in `content`.
 * @param includeImages - Embed image data. Off for embedded links.
 */
export async function buildSharedNote(note: Note, content: JSONContent, includeImages: boolean): Promise<SharedNote> {
  const pages = await db.notes.toArray();
  const assets: Record<string, string> = {};
  const wanted = new Set<string>();
  // Page links resolve to their current title: the viewer cannot look them up.
  const walk = (node: JSONContent): JSONContent => {
    if (node.type === "noteLink") return { ...node, attrs: { title: noteLinkTitle(node.attrs, pages) } };
    if (node.type === "noteImage" && typeof node.attrs?.asset === "string") wanted.add(node.attrs.asset);
    return node.content ? { ...node, content: node.content.map(walk) } : node;
  };
  const body = walk(content);
  if (includeImages && wanted.size) {
    const rows = await db.noteAssets.where("uid").anyOf([...wanted]).toArray();
    for (const row of rows) if (/^data:image\//i.test(row.dataUrl)) assets[row.uid] = row.dataUrl;
  }
  return {
    v: 1,
    title: note.title.trim(),
    icon: note.icon,
    content: body,
    assets,
    editedAt: new Date(note.updatedAt).toISOString(),
    sharedAt: new Date().toISOString(),
  };
}

/** Drop images, largest first, until the snapshot fits a short link. */
function fitShortLink(shared: SharedNote): { shared: SharedNote; dropped: number } {
  const size = () => new Blob([JSON.stringify(shared)]).size;
  let dropped = 0;
  const assets = { ...shared.assets };
  shared = { ...shared, assets };
  const order = Object.keys(assets).sort((a, b) => assets[b].length - assets[a].length);
  while (size() > SHORT_LINK_MAX_BYTES && order.length) {
    delete assets[order.shift() as string];
    dropped++;
  }
  if (size() > SHORT_LINK_MAX_BYTES) throw new Error("This page is too large to share");
  return { shared, dropped };
}

function missingCollection(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404 && /collection/i.test(error.message);
}

/** The signed-in user's short link for a page, or null when it has none. */
export async function findShare(noteUid: string): Promise<ShareRecord | null> {
  try {
    const record = await pb.collection(SHARES_COLLECTION).getFirstListItem(pb.filter("noteUid = {:uid}", { uid: noteUid }), { fields: "id,updated", requestKey: null });
    return { id: record.id, updated: String(record.updated) };
  } catch (error) {
    if (missingCollection(error)) throw new SharesUnavailableError();
    if (error instanceof ClientResponseError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Create or refresh a page's short link. The link id never changes, so
 * updating keeps every copy of the link working.
 *
 * @returns The record and how many images were left out to fit.
 */
export async function publishShare(noteUid: string, snapshot: SharedNote, existing?: string): Promise<{ record: ShareRecord; dropped: number }> {
  const owner = pb.authStore.record?.id;
  if (!owner) throw new Error("Sign in to create a short link");
  const { shared, dropped } = fitShortLink(snapshot);
  const data = { owner, noteUid, title: shared.title.slice(0, 200), payload: shared };
  try {
    const record = existing
      ? await pb.collection(SHARES_COLLECTION).update(existing, data, { fields: "id,updated", requestKey: null })
      : await pb.collection(SHARES_COLLECTION).create(data, { fields: "id,updated", requestKey: null });
    return { record: { id: record.id, updated: String(record.updated) }, dropped };
  } catch (error) {
    if (missingCollection(error)) throw new SharesUnavailableError();
    throw error;
  }
}

/** Stop sharing: the short link stops working everywhere. */
export async function deleteShare(id: string): Promise<void> {
  await pb.collection(SHARES_COLLECTION).delete(id, { requestKey: null });
}

/** Read a short link. Null when it does not exist or was deleted. */
export async function fetchShare(id: string): Promise<SharedNote | null> {
  try {
    const record = await pb.collection(SHARES_COLLECTION).getOne(id, { fields: "payload", requestKey: null });
    return readSharedNote(record.payload);
  } catch (error) {
    if (error instanceof ClientResponseError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

/** Embedded link for a snapshot. Images are never embedded. */
export async function embeddedShareUrl(shared: SharedNote): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ ...shared, assets: {} }));
  const packed = await pipe(json, new CompressionStream("deflate-raw"));
  return `${window.location.origin}${SHARE_PATH}#${toBase64Url(packed)}`;
}

/** Decode an embedded link's fragment. Null when it is not a valid snapshot. */
export async function decodeEmbeddedShare(fragment: string): Promise<SharedNote | null> {
  try {
    const json = await pipe(fromBase64Url(fragment.replace(/^#/, "")), new DecompressionStream("deflate-raw"));
    return readSharedNote(JSON.parse(new TextDecoder().decode(json)));
  } catch {
    return null;
  }
}

const SAFE_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;

function isDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

/** Validate untrusted payload data. The body is still parsed by the editor schema. */
export function readSharedNote(value: unknown): SharedNote | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const content = raw.content as JSONContent | undefined;
  if (raw.v !== 1 || typeof raw.title !== "string" || content?.type !== "doc") return null;
  const assets: Record<string, string> = {};
  if (raw.assets && typeof raw.assets === "object")
    for (const [uid, url] of Object.entries(raw.assets as Record<string, unknown>))
      if (typeof url === "string" && SAFE_IMAGE.test(url)) assets[uid] = url;
  const now = new Date().toISOString();
  return {
    v: 1,
    title: raw.title.slice(0, 500),
    icon: typeof raw.icon === "string" && /^[A-Za-z0-9]{1,64}$/.test(raw.icon) ? raw.icon : undefined,
    content,
    assets,
    editedAt: isDate(raw.editedAt) ? raw.editedAt : now,
    sharedAt: isDate(raw.sharedAt) ? raw.sharedAt : now,
  };
}
