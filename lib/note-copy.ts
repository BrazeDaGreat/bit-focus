/** Copy embedded assets with fresh identities so either page can be deleted safely. */
import type { JSONContent } from "@tiptap/core";
import db from "./db";
import { assetUidsIn, parseNoteContent, type Note, type NoteAsset } from "./notes";

/** Include pending editor/title journals when a row menu copies an open page. */
export function noteCopySource(note: Note): Note {
  try {
    return { ...note, content: localStorage.getItem(`bitfocus.notes.bodyDraft.${note.uid}`) ?? note.content,
      title: localStorage.getItem(`bitfocus.notes.titleDraft.${note.uid}`) ?? note.title };
  } catch { return note; }
}

export async function prepareNoteCopy(content: string | undefined, noteUid: string): Promise<{ content: string; assets: NoteAsset[] }> {
  const parsed = parseNoteContent(content);
  const references = typeof parsed === "string"
    ? new Set([...parsed.matchAll(/data-asset=["']([^"']+)["']/g)].map((match) => match[1]))
    : assetUidsIn(parsed);
  const remap = new Map<string, string>();
  const assets: NoteAsset[] = [];
  for (const uid of references) {
    const original = await db.noteAssets.where("uid").equals(uid).first();
    // Do not leave a reference owned by another page, even if it has not synced yet.
    if (!original) throw new Error("Some images are not on this device yet. Sync them before copying this page.");
    const nextUid = crypto.randomUUID();
    remap.set(uid, nextUid);
    const { id: _id, ...fields } = original;
    void _id;
    const now = new Date();
    assets.push({ ...fields, uid: nextUid, noteUid, createdAt: now, updatedAt: now });
  }
  if (typeof parsed === "string") return { content: parsed.replace(/(data-asset=["'])([^"']+)(["'])/g, (_match, start, uid, end) => `${start}${remap.get(uid) ?? uid}${end}`), assets };
  const rewrite = (node: JSONContent): JSONContent => ({
    ...node,
    ...(node.attrs?.asset && remap.has(node.attrs.asset) ? { attrs: { ...node.attrs, asset: remap.get(node.attrs.asset) } } : {}),
    ...(node.content ? { content: node.content.map(rewrite) } : {}),
  });
  return { content: JSON.stringify(rewrite(parsed)), assets };
}
