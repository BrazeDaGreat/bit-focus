/**
 * Notes - Page Masthead and Chrome
 *
 * Everything around the editor body on an open page: the quiet toolbar pinned
 * to the top of the page pane (save status, word count, export, page menu),
 * the masthead in the reading column (breadcrumb, icon tile, serif title), and
 * the list of subpages under the body so nested pages are reachable from the
 * page itself.
 *
 * The title saves on its own short debounce and on blur, independently of the
 * body, and is a single line: Enter moves the caret into the body instead.
 *
 * @fileoverview Notes toolbar, masthead, and subpage list.
 * @since v0.23.4
 */

"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/react";
import {
  ChevronRight,
  CornerDownRight,
  FileDown,
  FilePlus2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { ProjectIconPicker } from "@/components/tasks/ProjectIconPicker";
import { useNotes } from "@/hooks/useNotes";
import { noteTitle, type Note } from "@/lib/notes";
import { cn } from "@/lib/utils";
import { NOTE_ICON } from "@/lib/notes";

export type SaveStatus = "saved" | "saving" | "error";

const TITLE_DEBOUNCE_MS = 400;
const QUIET_BUTTON =
  "flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50";

/** The bar pinned to the top of the page pane. */
export function NoteToolbar({
  leading,
  status,
  words,
  readOnly,
  exporting,
  onExport,
  onAddSubpage,
  onMove,
  onTrash,
}: {
  leading?: ReactNode;
  status: SaveStatus;
  words?: number;
  readOnly: boolean;
  exporting: boolean;
  onExport: () => void;
  onAddSubpage: () => void;
  onMove: () => void;
  onTrash: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-1 bg-background/90 px-2 backdrop-blur-sm sm:px-3">
      {leading}
      <div className="ml-auto flex min-w-0 items-center gap-1">
        {!readOnly && (
          <p
            aria-live="polite"
            className="mr-1 flex min-w-0 items-center gap-2 truncate font-mono text-[11px] tabular-nums text-muted-foreground"
          >
            <span className={cn(status === "error" && "text-destructive")}>
              {status === "saving"
                ? "Saving…"
                : status === "error"
                  ? "Couldn't save"
                  : "Saved"}
            </span>
            {words !== undefined && (
              <span className="hidden sm:inline">
                · {words.toLocaleString()} {words === 1 ? "word" : "words"}
              </span>
            )}
          </p>
        )}
        <button
          type="button"
          aria-label="Export page as PDF"
          title="Export as PDF"
          disabled={exporting}
          onClick={onExport}
          className={cn(QUIET_BUTTON, "w-9 justify-center px-0 sm:w-auto sm:px-2.5")}
        >
          <FileDown className="size-4" />
          <span className="hidden sm:inline">
            {exporting ? "Exporting…" : "Export PDF"}
          </span>
        </button>
        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Page options"
              className={cn(QUIET_BUTTON, "w-9 justify-center px-0")}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 rounded-xl shadow-xs">
              <DropdownMenuItem onSelect={onAddSubpage}>
                <FilePlus2 className="size-4" />
                Add subpage
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onMove}>
                <CornerDownRight className="size-4" />
                Move to…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onTrash}>
                <Trash2 className="size-4" />
                Move to trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

/** Ancestor trail. Long trails keep the first and last two, folding the middle. */
function Breadcrumb({
  ancestors,
  onOpen,
}: {
  ancestors: Note[];
  onOpen: (note: Note) => void;
}) {
  if (!ancestors.length) return null;
  const folded = ancestors.length > 3 ? ancestors.slice(1, -2) : [];
  const shown =
    folded.length > 0
      ? [ancestors[0], null, ...ancestors.slice(-2)]
      : ancestors;
  const crumb = (note: Note) => (
    <button
      type="button"
      onClick={() => onOpen(note)}
      className="flex h-7 min-w-0 max-w-[12rem] items-center gap-1.5 rounded-md px-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
    >
      <ProjectIcon name={note.icon || NOTE_ICON} className="size-3.5 shrink-0" />
      <span className="truncate">{noteTitle(note)}</span>
    </button>
  );
  return (
    <nav aria-label="Page path" className="-ml-1.5 mb-6 min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-0.5 text-xs">
        {shown.map((note, index) => (
          <li key={note?.id ?? "folded"} className="flex min-w-0 items-center gap-0.5">
            {index > 0 && (
              <ChevronRight
                aria-hidden
                className="size-3 shrink-0 text-muted-foreground/60"
              />
            )}
            {note ? (
              crumb(note)
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Show ${folded.length} more pages in the path`}
                  className="h-7 rounded-md px-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  …
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-xl shadow-xs">
                  {folded.map((hidden) => (
                    <DropdownMenuItem key={hidden.id} onSelect={() => onOpen(hidden)}>
                      <ProjectIcon
                        name={hidden.icon || NOTE_ICON}
                        className="size-4"
                      />
                      <span className="max-w-[16rem] truncate">
                        {noteTitle(hidden)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Breadcrumb, icon tile, and title of the open page. */
export function NoteMasthead({
  note,
  ancestors,
  readOnly,
  editorRef,
  autoFocusTitle,
  onOpen,
  onTitleStatus,
}: {
  note: Note;
  ancestors: Note[];
  readOnly: boolean;
  editorRef: MutableRefObject<Editor | null>;
  autoFocusTitle?: boolean;
  onOpen: (note: Note) => void;
  onTitleStatus: (status: SaveStatus) => void;
}) {
  const id = note.id!;
  const draftKey = `bitfocus.notes.titleDraft.${note.uid}`;
  const [title, setTitle] = useState(() => { try { return readOnly ? note.title : localStorage.getItem(draftKey) ?? note.title; } catch { return note.title; } });
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef(title);
  const statusRef = useRef(onTitleStatus);
  useEffect(() => {
    statusRef.current = onTitleStatus;
  });

  const save = (value: string) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    useNotes
      .getState()
      .updateNote(id, { title: value })
      .then(() => {
        try { if (localStorage.getItem(draftKey) === value) localStorage.removeItem(draftKey); } catch { /* Private mode. */ }
        if (latest.current === value) statusRef.current("saved");
      })
      .catch(() => statusRef.current("error"));
  };

  useEffect(() => {
    if (readOnly) return;
    const flush = () => { if (timer.current != null) save(latest.current); };
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    // A recovered title commits on mount, before following remote renames.
    try { if (localStorage.getItem(draftKey) !== null) save(latest.current); } catch { /* Private mode. */ }
    window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", hidden); };
    // The masthead is keyed by UID; this listener owns that page's draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, readOnly]);

  // Flush a pending title when the page closes mid-debounce.
  useEffect(
    () => () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        const value = latest.current;
        void useNotes
          .getState()
          .updateNote(id, { title: value })
          .then(() => {
            try { if (localStorage.getItem(draftKey) === value) localStorage.removeItem(draftKey); } catch { /* Private mode. */ }
          })
          .catch(() => undefined);
      }
    },
    [id, draftKey],
  );

  // Follow renames from the tree or another device while not typing here.
  useEffect(() => {
    if (timer.current != null || document.activeElement === titleRef.current)
      return;
    try { if (localStorage.getItem(draftKey) !== null) return; } catch { /* Private mode. */ }
    latest.current = note.title;
    setTitle(note.title);
  }, [note.title, draftKey]);

  useEffect(() => {
    if (!autoFocusTitle || readOnly) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [autoFocusTitle, readOnly]);

  // Grow with the text. `field-sizing: content` covers most browsers; this
  // covers the rest and re-measures when the column width changes.
  useLayoutEffect(() => {
    const element = titleRef.current;
    if (!element) return;
    const fit = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    };
    fit();
    let width = element.getBoundingClientRect().width;
    let frame: number | null = null;
    // Height changes caused by fitting must not recursively fit the same field.
    const observer = new ResizeObserver(() => {
      const nextWidth = element.getBoundingClientRect().width;
      if (Math.abs(nextWidth - width) < 0.5) return;
      width = nextWidth;
      if (frame != null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(element);
    return () => { observer.disconnect(); if (frame != null) cancelAnimationFrame(frame); };
  }, [title]);

  const change = (value: string) => {
    const single = value.replace(/\r?\n/g, " ");
    setTitle(single);
    latest.current = single;
    try { localStorage.setItem(draftKey, single); } catch { /* Debounced IndexedDB save remains available. */ }
    onTitleStatus("saving");
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(single), TITLE_DEBOUNCE_MS);
  };

  return (
    <header className="pb-4">
      <Breadcrumb ancestors={ancestors} onOpen={onOpen} />
      {readOnly ? (
        <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <ProjectIcon name={note.icon || NOTE_ICON} className="size-7" />
        </span>
      ) : note.icon ? (
        <ProjectIconPicker
          value={note.icon}
          label="Change page icon"
          onChange={(icon) =>
            void useNotes
              .getState()
              .updateNote(id, { icon })
              .catch(() => onTitleStatus("error"))
          }
          className="size-14 rounded-2xl text-foreground/80"
        >
          <ProjectIcon name={note.icon} className="size-7" />
        </ProjectIconPicker>
      ) : (
        <ProjectIconPicker
          label="Add page icon"
          onChange={(icon) =>
            void useNotes
              .getState()
              .updateNote(id, { icon })
              .catch(() => onTitleStatus("error"))
          }
          className="-ml-2 flex h-8 w-auto items-center gap-1.5 rounded-lg bg-transparent px-2 text-xs font-medium"
        >
          <Plus className="size-3.5" />
          Add icon
        </ProjectIconPicker>
      )}
      <textarea
        ref={titleRef}
        rows={1}
        value={title}
        readOnly={readOnly}
        aria-label="Page title"
        placeholder="Untitled"
        spellCheck
        onChange={(event) => change(event.target.value)}
        onBlur={() => {
          if (timer.current != null) save(latest.current);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (timer.current != null) save(latest.current);
          editorRef.current?.commands.focus("start");
        }}
        className="mt-4 block w-full resize-none overflow-hidden rounded-lg bg-transparent font-serif text-3xl font-semibold leading-tight tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-4 focus-visible:ring-offset-background [field-sizing:content] placeholder:text-muted-foreground/50 sm:text-4xl"
      />
    </header>
  );
}

/** Links to the page's children, under the body. */
export function NoteSubpages({
  pages,
  onOpen,
}: {
  pages: Note[];
  onOpen: (note: Note) => void;
}) {
  if (!pages.length) return null;
  return (
    <section aria-labelledby="note-subpages" className="mt-12 pb-16">
      <div className="mb-2 flex items-center gap-3">
        <h2
          id="note-subpages"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
        >
          Subpages
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <ul className="space-y-0.5">
        {pages.map((page) => (
          <li key={page.uid ?? page.id}>
            <button
              type="button"
              onClick={() => onOpen(page)}
              className="-mx-2 flex w-[calc(100%+1rem)] min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ProjectIcon
                name={page.icon || NOTE_ICON}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span
                className={cn(
                  "truncate underline decoration-border underline-offset-4",
                  !page.title.trim() && "text-muted-foreground",
                )}
              >
                {noteTitle(page)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
