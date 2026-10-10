/**
 * Notes - Trash
 *
 * Trashed pages stay whole: trashing a page stamps it and its descendants, so
 * the list shows only the top of each trashed subtree (a page whose parent is
 * not trashed too). Restoring brings the subtree back; deleting forever
 * removes it with its images, behind a confirmation because it cannot be
 * undone.
 *
 * @fileoverview Trash list, trashed-page banner, and delete confirmation.
 * @since v0.23.4
 */

"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { useNotes } from "@/hooks/useNotes";
import { isTrashed, noteTitle, type Note } from "@/lib/notes";
import { NOTE_ICON } from "@/lib/notes";

const QUIET_BUTTON =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50";

/** Trashed pages whose parent is not trashed too, newest first. */
export function trashedRoots(notes: readonly Note[]): Note[] {
  const byId = new Map(notes.map((note) => [note.id, note]));
  return notes
    .filter((note) => {
      if (!isTrashed(note)) return false;
      const parent = note.parentId != null ? byId.get(note.parentId) : undefined;
      return !parent || !isTrashed(parent);
    })
    .sort(
      (a, b) =>
        new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime(),
    );
}

export async function restorePage(note: Note) {
  try {
    await useNotes.getState().restoreNote(note.id!);
    toast(`Restored ${noteTitle(note)}`);
  } catch {
    toast.error("Could not restore page");
  }
}

/** Confirmation before a permanent delete (one page or the whole trash). */
export function DeleteForeverDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: Note | "all";
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const all = target === "all";
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={all ? "Empty trash?" : "Delete page forever?"}
      description={
        all
          ? "Permanently delete every page in Trash, with their subpages and images. This cannot be undone."
          : `Permanently delete “${noteTitle(target)}”, its subpages, and their images. This cannot be undone.`
      }
    >
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="h-10 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              const store = useNotes.getState();
              if (all) await store.emptyTrash();
              else await store.deleteNoteForever(target.id!);
              toast(all ? "Trash emptied" : "Page deleted forever");
              onClose();
              onDeleted?.();
            } catch {
              toast.error(all ? "Could not empty trash" : "Could not delete page");
            } finally {
              setBusy(false);
            }
          }}
          className="h-10 rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-destructive disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? "Deleting…" : all ? "Empty trash" : "Delete forever"}
        </button>
      </div>
    </ResponsiveDialog>
  );
}

/** The Trash view in the page pane. */
export function NoteTrash({
  notes,
  onOpen,
}: {
  notes: Note[];
  onOpen: (note: Note) => void;
}) {
  const roots = useMemo(() => trashedRoots(notes), [notes]);
  const [confirm, setConfirm] = useState<Note | "all" | null>(null);
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
      <header className="mb-6 flex items-start gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Trash2 className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Trash
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Restore a page to put it back where it was.
          </p>
        </div>
        {roots.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirm("all")}
            className={`${QUIET_BUTTON} mt-1 text-destructive hover:bg-destructive/12 hover:text-destructive`}
          >
            <Trash2 className="size-4" />
            Empty trash
          </button>
        )}
      </header>
      {roots.length === 0 ? (
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-sm font-medium">Trash is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pages you move to Trash wait here until you restore or delete them.
          </p>
        </div>
      ) : (
        <ul className="rounded-xl bg-muted/40 p-1">
          {roots.map((note) => (
            <li
              key={note.id}
              className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg px-1 py-1 transition-colors duration-150 hover:bg-muted/50 sm:flex-nowrap"
            >
              <button
                type="button"
                onClick={() => onOpen(note)}
                className="flex min-w-0 flex-1 basis-48 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <ProjectIcon name={note.icon || NOTE_ICON} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {noteTitle(note)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Trashed{" "}
                    {formatDistanceToNow(new Date(note.deletedAt!), {
                      addSuffix: true,
                    })}
                  </span>
                </span>
              </button>
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void restorePage(note)}
                  className={QUIET_BUTTON}
                >
                  <RotateCcw className="size-4" />
                  Restore
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${noteTitle(note)} forever`}
                  title="Delete forever"
                  onClick={() => setConfirm(note)}
                  className={`${QUIET_BUTTON} w-9 justify-center px-0 hover:bg-destructive/12 hover:text-destructive`}
                >
                  <Trash2 className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <DeleteForeverDialog target={confirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  );
}

/** Banner above a trashed page opened read-only. */
export function TrashedBanner({
  note,
  onDeleted,
}: {
  note: Note;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2 rounded-xl bg-destructive/12 p-1 pl-3">
      <p className="min-w-0 flex-1 basis-48 py-1.5 text-sm font-medium text-destructive">
        This page is in Trash
      </p>
      <button type="button" onClick={() => void restorePage(note)} className={QUIET_BUTTON}>
        <RotateCcw className="size-4" />
        Restore
      </button>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className={`${QUIET_BUTTON} text-destructive hover:bg-destructive/12 hover:text-destructive`}
      >
        <Trash2 className="size-4" />
        Delete forever
      </button>
      {confirm && (
        <DeleteForeverDialog
          target={note}
          onClose={() => setConfirm(false)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
