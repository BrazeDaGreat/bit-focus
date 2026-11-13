/**
 * Page History - Earlier Versions of Notes Pages
 *
 * Sync settles a page as one row, so when two devices edit the same page the
 * later edit replaces the earlier one whole. History is the safety net: before
 * a body is replaced, the old one is copied here, on this device only.
 *
 * A copy is kept when:
 * - you start editing again after a quiet gap (one per editing session),
 * - an edit removes a large part of the page,
 * - another device's version replaces this one (always, if this device had
 *   edits that had not been sent yet),
 * - a version is restored, so the restore itself can be undone.
 *
 * @fileoverview Device-local version snapshots for Notes pages.
 * @since v0.25.2
 */

import Dexie from "dexie";
import db from "@/lib/db";
import type { Note, NoteVersion } from "@/lib/notes";

/** Edits closer together than this belong to one editing session. */
export const VERSION_GAP_MS = 10 * 60_000;
/** Versions kept per page; the oldest go first. */
export const VERSIONS_PER_PAGE = 50;

/** True when `after` drops most of `before`, worth a copy whatever the gap. */
export function isBigDeletion(before: string, after: string): boolean {
  const removed = before.length - after.length;
  return removed > 400 && after.length < before.length * 0.6;
}

/**
 * Decide whether replacing `before` with `after` should keep a copy of `before`.
 *
 * @param latest - The newest version already kept for the page, if any.
 * @param force - Keep a copy regardless of timing (unsent edits, restores).
 */
export function shouldKeepVersion(
  latest: Pick<NoteVersion, "at" | "content"> | undefined,
  before: string,
  after: string,
  now: Date,
  force = false,
): boolean {
  if (!before || before === after) return false;
  if (latest?.content === before) return false;
  if (force || !latest) return true;
  return now.getTime() - latest.at.getTime() >= VERSION_GAP_MS || isBigDeletion(before, after);
}

/** The newest version kept for a page. */
export async function latestVersion(noteUid: string): Promise<NoteVersion | undefined> {
  return db.noteVersions
    .where("[noteUid+at]")
    .between([noteUid, Dexie.minKey], [noteUid, Dexie.maxKey])
    .last();
}

/** Every version of a page, newest first. */
export async function listVersions(noteUid: string): Promise<NoteVersion[]> {
  const rows = await db.noteVersions.where("noteUid").equals(noteUid).toArray();
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * Keep a copy of a page's current body before it is replaced.
 *
 * Failures are swallowed: history must never be the reason a save fails.
 *
 * @param note - The page as it is now, before the replacement.
 * @param next - The body about to replace it.
 * @returns True when a version was stored.
 */
export async function keepVersion(
  note: Pick<Note, "uid" | "title" | "content">,
  next: string,
  reason: NoteVersion["reason"],
  { force = false, now = new Date() }: { force?: boolean; now?: Date } = {},
): Promise<boolean> {
  if (!note.uid) return false;
  try {
    const latest = await latestVersion(note.uid);
    if (!shouldKeepVersion(latest, note.content ?? "", next, now, force)) return false;
    await db.noteVersions.add({ noteUid: note.uid, title: note.title, content: note.content ?? "", at: now, reason });
    await pruneVersions(note.uid);
    return true;
  } catch {
    return false;
  }
}

/** Drop the oldest versions past the per-page limit. */
export async function pruneVersions(noteUid: string): Promise<void> {
  const rows = await listVersions(noteUid);
  const extra = rows.slice(VERSIONS_PER_PAGE).map((row) => row.id!).filter((id) => id != null);
  if (extra.length) await db.noteVersions.bulkDelete(extra);
}

/** Forget every version of these pages, when they are deleted forever. */
export async function deleteVersions(noteUids: readonly string[]): Promise<void> {
  if (!noteUids.length) return;
  await db.noteVersions.where("noteUid").anyOf([...noteUids]).delete();
}
