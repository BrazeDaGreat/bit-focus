/**
 * Notes - Move Dialog
 *
 * "Move to…" for a page: a searchable list of every place it can go. Drag and
 * drop in the tree does not work on touch screens, so this is the way to
 * re-parent a page there (and from the keyboard everywhere).
 *
 * The page itself and its descendants are left out, since a page cannot move
 * inside itself; its current parent stays listed but disabled so the list
 * still shows where the page lives now. The page lands last among its new
 * siblings.
 *
 * @fileoverview Notes move-to-page dialog.
 * @since v0.23.4
 */

"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ArrowUpToLine, Search } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { useNotes } from "@/hooks/useNotes";
import {
  buildTree,
  descendantIds,
  isTrashed,
  noteTitle,
  type Note,
  type NoteTreeNode,
} from "@/lib/notes";
import { cn } from "@/lib/utils";
import { NOTE_ICON } from "@/lib/notes";

interface Destination {
  key: string;
  parentId: number | null;
  note?: Note;
  title: string;
  path: string;
  current: boolean;
}

export function NoteMoveDialog({
  note,
  notes,
  onClose,
  onMoved,
}: {
  note: Note;
  notes: Note[];
  onClose: () => void;
  /** Called with the new parent after the move is saved. */
  onMoved?: (parentId: number | null) => void;
}) {
  const id = note.id!;
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // Every place the page may go, in tree order, with its ancestor path.
  const destinations = useMemo(() => {
    const blocked = new Set([id, ...descendantIds(notes, id)]);
    // A page whose parent is gone sits at the top level, like in the tree.
    const parentId =
      note.parentId != null &&
      notes.some((row) => row.id === note.parentId && !isTrashed(row))
        ? note.parentId
        : null;
    const list: Destination[] = [
      {
        key: "root",
        parentId: null,
        title: "Top level",
        path: "",
        current: parentId === null,
      },
    ];
    const walk = (nodes: NoteTreeNode[], path: string[]) => {
      for (const node of nodes) {
        const nodeId = node.note.id!;
        if (blocked.has(nodeId)) continue;
        const title = noteTitle(node.note);
        list.push({
          key: String(nodeId),
          parentId: nodeId,
          note: node.note,
          title,
          path: path.join(" / "),
          current: nodeId === parentId,
        });
        walk(node.children, [...path, title]);
      }
    };
    walk(buildTree(notes), []);
    return list;
  }, [notes, id, note.parentId]);

  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search
      ? destinations.filter((place) => place.title.toLowerCase().includes(search))
      : destinations;
  }, [destinations, query]);

  const enabled = (index: number) =>
    index >= 0 && index < matches.length && !matches[index].current;
  const firstEnabled = matches.findIndex((place) => !place.current);
  const activeIndex = enabled(active) ? active : firstEnabled;

  const step = (direction: 1 | -1) => {
    if (firstEnabled < 0) return;
    let next = activeIndex;
    do next = (next + direction + matches.length) % matches.length;
    while (!enabled(next));
    setActive(next);
    listRef.current
      ?.querySelector(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  const choose = async (place: Destination) => {
    if (busy || place.current) return;
    setBusy(true);
    try {
      await useNotes.getState().moveNote(id, {
        parentId: place.parentId,
        index: Number.MAX_SAFE_INTEGER,
      });
    } catch (error) {
      setBusy(false);
      toast.error(
        error instanceof Error ? error.message : "Could not move page",
      );
      return;
    }
    toast(place.note ? `Moved to ${place.title}` : "Moved to top level");
    onMoved?.(place.parentId);
    onClose();
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={`Move “${noteTitle(note)}”`}
      description="Pick the page to put it in. It goes last among that page's subpages."
    >
      <label className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 focus-within:ring-2 focus-within:ring-primary/40">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          role="combobox"
          aria-label="Search pages"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          autoComplete="off"
          placeholder="Search pages"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              step(event.key === "ArrowDown" ? 1 : -1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (enabled(activeIndex)) void choose(matches[activeIndex]);
            }
          }}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
      {matches.length === 0 ? (
        <div className="mt-3 rounded-xl bg-muted/40 p-3">
          <p className="break-words text-sm font-medium">
            No pages match “{query.trim()}”
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Search looks at page titles. Try a shorter word.
          </p>
        </div>
      ) : (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Destinations"
          className="-mx-1 mt-3 max-h-[min(50dvh,22rem)] space-y-0.5 overflow-y-auto overscroll-contain px-1 pb-1"
        >
          {matches.map((place, index) => (
            <li
              key={place.key}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === activeIndex}
              aria-disabled={place.current || undefined}
              onPointerMove={() => {
                if (!place.current && index !== activeIndex) setActive(index);
              }}
              onClick={() => void choose(place)}
              className={cn(
                "flex min-w-0 items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150 md:py-1.5",
                place.current
                  ? "cursor-default opacity-60"
                  : "cursor-pointer",
                index === activeIndex && "bg-muted/60",
              )}
            >
              {place.note ? (
                <ProjectIcon
                  name={place.note.icon || NOTE_ICON}
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
              ) : (
                <ArrowUpToLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm",
                    place.note &&
                      !place.note.title.trim() &&
                      "text-muted-foreground",
                  )}
                >
                  {place.title}
                </span>
                {place.path && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {place.path}
                  </span>
                )}
              </span>
              {place.current && (
                <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
                  Current location
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </ResponsiveDialog>
  );
}
