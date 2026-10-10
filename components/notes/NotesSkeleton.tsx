/**
 * Notes - Loading Skeletons
 *
 * Placeholders shaped like the notes workspace: tree rows in the left pane and
 * the masthead (icon tile, serif title, a few body lines) in the reading
 * column, so the page does not jump when the notes table answers.
 *
 * @fileoverview Skeletons for the notes workspace and the lazy editor.
 * @since v0.23.4
 */

import { Skeleton } from "@/components/ui/skeleton";

const PULSE =
  "[&_[data-slot=skeleton]]:animate-none motion-safe:[&_[data-slot=skeleton]]:animate-pulse";

/** Rows of the page tree, with a few nested ones. */
export function NoteTreeSkeleton({ rows = 8 }: { rows?: number }) {
  const depths = [0, 1, 1, 2, 0, 0, 1, 0, 0, 1];
  return (
    <div className={`space-y-1 ${PULSE}`} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex h-8 items-center gap-2 px-2"
          style={{ paddingLeft: 8 + depths[i % depths.length] * 14 }}
        >
          <Skeleton className="size-4 shrink-0 rounded-md" />
          <Skeleton
            className="h-3 rounded-md"
            style={{ width: `${45 + ((i * 17) % 40)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/** Body lines while the editor chunk loads. */
export function NoteEditorSkeleton() {
  return (
    <div className={`space-y-3 pt-2 ${PULSE}`} aria-label="Loading editor">
      <Skeleton className="h-4 w-11/12 rounded-md" />
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-4/5 rounded-md" />
      <Skeleton className="mt-6 h-4 w-2/3 rounded-md" />
      <Skeleton className="h-4 w-5/6 rounded-md" />
    </div>
  );
}

/** Masthead and a few lines of body. */
export function NotePageSkeleton() {
  return (
    <div className={`mx-auto w-full max-w-5xl px-5 pt-14 sm:px-8 ${PULSE}`}>
      <Skeleton className="mb-6 h-3 w-40 rounded-md" />
      <Skeleton className="size-14 rounded-2xl" />
      <Skeleton className="mt-5 h-10 w-2/3 rounded-lg" />
      <div className="mt-8">
        <NoteEditorSkeleton />
      </div>
    </div>
  );
}

/** The whole workspace: tree pane and page. */
export function NotesSkeleton() {
  return (
    <div
      aria-label="Loading notes"
      className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden"
    >
      <div className="flex w-full shrink-0 flex-col bg-muted/30 p-3 md:w-[17rem]">
        <div className={`mb-3 flex items-center justify-between ${PULSE}`}>
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
        <Skeleton className="mb-3 h-9 w-full rounded-lg motion-safe:animate-pulse" />
        <NoteTreeSkeleton />
      </div>
      <div className="hidden min-w-0 flex-1 md:block">
        <NotePageSkeleton />
      </div>
    </div>
  );
}
