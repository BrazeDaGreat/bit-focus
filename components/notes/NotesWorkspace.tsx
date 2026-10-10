/**
 * Notes - Workspace
 *
 * The /notes page: a page tree on the left and the open page on the right,
 * each scrolling on its own under the top bar. The URL is the source of truth
 * for what is open (`?page=<uid>`, `?view=trash`), so back and forward walk
 * through visited pages and a link to a page survives sync.
 *
 * Below `md` the two panes become two screens, like projects: the tree first,
 * then the page full width with a way back.
 *
 * The editor loads on demand. Export dependencies load with this route so
 * printing is available even if the connection disappears after opening it.
 *
 * @fileoverview Notes page shell: panes, routing, and page actions.
 * @since v0.23.4
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  FilePlus2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNotes } from "@/hooks/useNotes";
import { useConfig } from "@/hooks/useConfig";
import {
  ancestorsOf,
  childrenOf,
  isTrashed,
  noteHref,
  noteTitle,
  type Note,
} from "@/lib/notes";
import { cn } from "@/lib/utils";
import { exportNoteToPdf } from "@/lib/note-export";
import { NoteSearchResults, NoteTree } from "./NoteTree";
import {
  NoteMasthead,
  NoteSubpages,
  NoteToolbar,
  type SaveStatus,
} from "./NoteMasthead";
import { NoteMoveDialog } from "./NoteMoveDialog";
import { NoteTrash, TrashedBanner, restorePage, trashedRoots } from "./NoteTrash";
import { NoteEditorSkeleton, NotesSkeleton } from "./NotesSkeleton";

const NoteEditor = dynamic(() => import("./NoteEditor"), {
  ssr: false,
  loading: () => <NoteEditorSkeleton />,
});

const COLLAPSED_KEY = "bitfocus.notes.paneCollapsed";
const QUIET_ICON_BUTTON =
  "grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary";

/** Query-only navigation stays local; Next's router would fetch RSC while offline. */
function navigateNotes(href: string, replace = false) {
  if (replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* Private mode: the pane just opens expanded next time. */
  }
}

function isDesktop() {
  return window.matchMedia("(min-width: 768px)").matches;
}

/** A soft empty-state well: what is missing, then how to fix it. */
function EmptyWell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-10 sm:px-8 sm:pt-16">
      <div className="rounded-xl bg-muted/40 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

export function NotesWorkspace() {
  const notes = useNotes((state) => state.notes);
  const loaded = useNotes((state) => state.loaded);
  const { featureToggles } = useConfig();
  const disabled = featureToggles.notes === false;
  const params = useSearchParams();
  const pageUid = params.get("page");
  const trashView = params.get("view") === "trash";
  const wantsNew = params.get("new") === "1";
  const note = pageUid ? notes.find((n) => n.uid === pageUid) : undefined;
  const trashed = note ? isTrashed(note) : false;

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [exporting, setExporting] = useState(false);
  const [focusTitleUid, setFocusTitleUid] = useState<string | null>(null);
  // Uid of the open page being moved from its toolbar menu.
  const [movingUid, setMovingUid] = useState<string | null>(null);
  // Per-page status, keyed by uid so a newly opened page starts clean.
  const [editorState, setEditorState] = useState<{
    uid?: string;
    status: SaveStatus;
    words?: number;
  }>({ status: "saved" });
  const [titleStatus, setTitleStatus] = useState<{
    uid?: string;
    status: SaveStatus;
  }>({ status: "saved" });
  const editorRef = useRef<Editor | null>(null);
  const creating = useRef(false);

  const visible = useMemo(() => notes.filter((n) => !isTrashed(n)), [notes]);
  const trashCount = useMemo(() => trashedRoots(notes).length, [notes]);
  const ancestors = useMemo(
    () => (note?.id != null ? ancestorsOf(notes, note.id) : []),
    [notes, note?.id],
  );
  const subpages = useMemo(
    () => (note?.id != null && !trashed ? childrenOf(notes, note.id) : []),
    [notes, note?.id, trashed],
  );

  useEffect(() => {
    void useNotes.getState().loadNotes();
  }, []);

  const open = (target: Note) => {
    setFocusTitleUid(null);
    navigateNotes(noteHref(target));
  };

  const createPage = async (
    parentId: number | null,
    { replace = false } = {},
  ) => {
    if (creating.current) return;
    creating.current = true;
    try {
      const created = await useNotes.getState().createNote({ parentId });
      setFocusTitleUid(created.uid ?? null);
      setQuery("");
      navigateNotes(noteHref(created), replace);
    } catch {
      toast.error("Could not create page");
    } finally {
      creating.current = false;
    }
  };

  const trashPage = async (target: Note) => {
    if (target.id == null) return;
    const opened =
      note?.id != null &&
      (note.id === target.id ||
        ancestorsOf(notes, note.id).some((a) => a.id === target.id));
    try {
      await useNotes.getState().trashNote(target.id);
    } catch {
      toast.error("Could not move page to Trash");
      return;
    }
    toast(`Moved “${noteTitle(target)}” to Trash`, {
      action: { label: "Undo", onClick: () => void restorePage(target) },
    });
    if (opened) {
      const parent = notes.find((n) => n.id === target.parentId);
      if (parent && !isTrashed(parent))
        navigateNotes(noteHref(parent), true);
      else navigateNotes("/notes", true);
    }
  };

  const exportPdf = async (target: Note) => {
    if (exporting) return;
    setExporting(true);
    try {
      const latest =
        useNotes.getState().notes.find((n) => n.id === target.id) ?? target;
      // The open page may have keystrokes still waiting on autosave.
      const live =
        target.uid === note?.uid && editorRef.current && !editorRef.current.isDestroyed
          ? JSON.stringify(editorRef.current.getJSON())
          : latest.content;
      await exportNoteToPdf({ ...latest, content: live });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? `Could not export PDF: ${error.message}`
          : "Could not export PDF",
      );
    } finally {
      setExporting(false);
    }
  };

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      writeCollapsed(!current);
      return !current;
    });

  // `?new=1` (sidebar, command palette) creates a root page and opens it.
  useEffect(() => {
    if (!loaded || !wantsNew || disabled) return;
    void createPage(null, { replace: true });
  }, [loaded, wantsNew, disabled]);

  // On desktop an empty URL opens the most recently edited page. Phones keep
  // the tree as their first screen.
  useEffect(() => {
    if (!loaded || pageUid || trashView || wantsNew || !isDesktop()) return;
    const recent = [...visible].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
    if (recent) navigateNotes(noteHref(recent), true);
  }, [loaded, pageUid, trashView, wantsNew, visible]);

  useEffect(() => {
    const previous = document.title;
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    document.title = note
      ? `${noteTitle(note)} · Notes`
      : trashView
        ? "Trash · Notes"
        : "Notes";
  }, [note, trashView]);

  // Mod+\ shows or hides the pages pane, as in most editors.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "\\" || !(event.metaKey || event.ctrlKey) || event.altKey)
        return;
      event.preventDefault();
      setCollapsed((current) => {
        writeCollapsed(!current);
        return !current;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (disabled)
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <EmptyWell
          title="Notes are turned off"
          hint="Turn them back on in Settings → Features to write and organise pages."
        >
          <Link
            href="/settings#features"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            Open settings
          </Link>
        </EmptyWell>
      </div>
    );

  if (!loaded) return <NotesSkeleton />;

  const showPage = !!pageUid || trashView;
  const editorStatus =
    editorState.uid === note?.uid ? editorState.status : "saved";
  const words = editorState.uid === note?.uid ? editorState.words : undefined;
  const titleSave =
    titleStatus.uid === note?.uid ? titleStatus.status : "saved";
  const status: SaveStatus =
    editorStatus === "error" || titleSave === "error"
      ? "error"
      : editorStatus === "saving" || titleSave === "saving"
        ? "saving"
        : "saved";

  const leading = (
    <>
      <button
        type="button"
        onClick={() => navigateNotes("/notes")}
        className="-ml-0.5 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary md:hidden"
      >
        <ArrowLeft className="size-4" />
        Notes
      </button>
      {collapsed && (
        <button
          type="button"
          aria-label="Show pages"
          title="Show pages (Ctrl+\)"
          onClick={toggleCollapsed}
          className={cn(QUIET_ICON_BUTTON, "hidden md:grid")}
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}
    </>
  );

  const newPageButton = (
    <button
      type="button"
      onClick={() => void createPage(null)}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <FilePlus2 className="size-4" />
      New page
    </button>
  );

  let page: React.ReactNode;
  if (trashView) {
    page = (
      <>
        <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center bg-background/90 px-2 backdrop-blur-sm sm:px-3">
          {leading}
        </div>
        <NoteTrash notes={notes} onOpen={open} />
      </>
    );
  } else if (note) {
    page = (
      <>
        <NoteToolbar
          leading={leading}
          status={status}
          words={words}
          readOnly={trashed}
          exporting={exporting}
          onExport={() => void exportPdf(note)}
          onAddSubpage={() => void createPage(note.id!)}
          onMove={() => setMovingUid(note.uid ?? null)}
          onTrash={() => void trashPage(note)}
        />
        <div className="mx-auto w-full max-w-5xl px-5 pt-4 sm:px-8 sm:pt-10">
          {trashed && (
            <TrashedBanner
              note={note}
              onDeleted={() =>
                navigateNotes("/notes?view=trash", true)
              }
            />
          )}
          <NoteMasthead
            key={note.uid}
            note={note}
            ancestors={ancestors}
            readOnly={trashed}
            editorRef={editorRef}
            autoFocusTitle={focusTitleUid === note.uid}
            onOpen={open}
            onTitleStatus={(next) =>
              setTitleStatus({ uid: note.uid, status: next })
            }
          />
          <div className="min-h-[40vh] pb-8">
            <NoteEditor
              // Remount when the page enters or leaves Trash: flipping
              // read-only on a live editor tears out its floating menus.
              key={`${note.uid}:${trashed}`}
              note={note}
              readOnly={trashed}
              editorRef={editorRef}
              onStatusChange={(next) =>
                setEditorState((current) => ({
                  uid: note.uid,
                  status: next,
                  words: current.uid === note.uid ? current.words : undefined,
                }))
              }
              onStats={({ words: count }) =>
                setEditorState((current) => ({
                  uid: note.uid,
                  status: current.uid === note.uid ? current.status : "saved",
                  words: count,
                }))
              }
            />
          </div>
          <NoteSubpages pages={subpages} onOpen={open} />
        </div>
        {/* The tree reveals the open page's new parent on its own. */}
        {movingUid === note.uid && !trashed && (
          <NoteMoveDialog
            note={note}
            notes={notes}
            onClose={() => setMovingUid(null)}
          />
        )}
      </>
    );
  } else if (pageUid) {
    page = (
      <>
        <div className="sticky top-0 z-10 flex h-12 items-center px-2 sm:px-3">
          {leading}
        </div>
        <EmptyWell
          title="This page could not be found"
          hint="It may have been deleted forever on another device. Pick a page from the list."
        />
      </>
    );
  } else if (!visible.length) {
    page = (
      <>
        {collapsed && (
          <div className="flex h-12 items-center px-2 sm:px-3">{leading}</div>
        )}
        <EmptyWell title="No pages yet" hint="Create a page to start writing.">
          {newPageButton}
        </EmptyWell>
      </>
    );
  } else {
    page = (
      <>
        {collapsed && (
          <div className="flex h-12 items-center px-2 sm:px-3">{leading}</div>
        )}
        <EmptyWell
          title="No page open"
          hint="Pick a page from the list, or start a new one."
        >
          {newPageButton}
        </EmptyWell>
      </>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
      <aside
        aria-label="Notes"
        className={cn(
          "min-h-0 w-full shrink-0 flex-col bg-muted/30 md:w-[17rem]",
          showPage ? "hidden" : "flex",
          collapsed ? "md:hidden" : "md:flex",
        )}
      >
        <div className="flex items-center gap-1 px-3 pb-2 pt-3">
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
            Notes
          </h1>
          <button
            type="button"
            aria-label="Hide pages"
            title="Hide pages (Ctrl+\)"
            onClick={toggleCollapsed}
            className={cn(QUIET_ICON_BUTTON, "hidden md:grid")}
          >
            <PanelLeftClose className="size-4" />
          </button>
          <button
            type="button"
            aria-label="New page"
            title="New page"
            onClick={() => void createPage(null)}
            className={QUIET_ICON_BUTTON}
          >
            <Plus className="size-4" />
          </button>
        </div>
        <div className="px-2 pb-2">
          <label className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 focus-within:ring-2 focus-within:ring-primary/40">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              aria-label="Search pages"
              placeholder="Search pages"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  event.preventDefault();
                  event.stopPropagation();
                  setQuery("");
                }
              }}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground md:h-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="-mr-1 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
          {query.trim() ? (
            <NoteSearchResults
              notes={notes}
              query={query}
              selectedId={note?.id}
              onOpen={open}
            />
          ) : (
            <NoteTree
              notes={notes}
              selectedId={note?.id}
              onOpen={open}
              onCreateChild={(parentId) => void createPage(parentId)}
              onTrash={(target) => void trashPage(target)}
              onExport={(target) => void exportPdf(target)}
            />
          )}
        </div>
        <div className="p-2">
          <button
            type="button"
            aria-current={trashView ? "page" : undefined}
            onClick={() => navigateNotes("/notes?view=trash")}
            className={cn(
              "flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary md:h-9",
              trashView
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Trash2 className="size-4" />
            Trash
            {trashCount > 0 && (
              <span className="ml-auto font-mono text-xs tabular-nums">
                {trashCount}
              </span>
            )}
          </button>
        </div>
      </aside>
      <section
        aria-label={note ? noteTitle(note) : trashView ? "Trash" : "Page"}
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain",
          showPage ? "flex" : "hidden md:flex",
        )}
      >
        {page}
      </section>
    </div>
  );
}
