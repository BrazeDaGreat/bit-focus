/**
 * Notes - Page Tree
 *
 * The left pane's hierarchy of pages. Rows are rendered flat (each carries its
 * `aria-level`) rather than as nested groups, which keeps the roving focus,
 * drag targets, and indentation guides simple: every visible row is one
 * element in one list, and depth is only padding plus a guide line per level.
 *
 * Keyboard follows the WAI-ARIA tree pattern: one tab stop, arrows to move and
 * expand, Enter to open, F2 to rename, Delete to move a page to Trash (undo
 * lives in the toast, so there is no confirm step). Drag a row onto the top or
 * bottom third of another to reorder, or onto its middle to nest inside it.
 * Drag needs a mouse, so the row menu also offers Move up / Move down and a
 * "Move to…" dialog for touch screens and keyboards.
 *
 * Expanded pages are remembered per device in localStorage.
 *
 * @fileoverview Notes page tree and search results.
 * @since v0.23.4
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CornerDownRight,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Plus,
  Shapes,
  FileDown,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  ancestorsOf,
  buildTree,
  descendantIds,
  isTrashed,
  noteTitle,
  type Note,
  type NoteTreeNode,
} from "@/lib/notes";
import { cn } from "@/lib/utils";
import { NoteMoveDialog } from "./NoteMoveDialog";

/** Default icon for a page without one. */
import { NOTE_ICON } from "@/lib/notes";

const EXPANDED_KEY = "bitfocus.notes.expanded";
const INDENT = 14;
const PAD = 4;
/** Horizontal centre of a row's chevron, relative to its level's start. */
const GUIDE = 10;

type DropPosition = "before" | "after" | "inside";

interface FlatRow {
  note: Note;
  id: number;
  depth: number;
  parentId: number | null;
  hasChildren: boolean;
  expanded: boolean;
  posinset: number;
  setsize: number;
}

function readExpanded(): Set<number> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(ids)
        ? ids.filter((id): id is number => typeof id === "number")
        : [],
    );
  } catch {
    return new Set();
  }
}

function writeExpanded(ids: Set<number>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]));
  } catch {
    /* Private mode: expansion just won't persist. */
  }
}

interface NoteTreeProps {
  notes: Note[];
  selectedId?: number;
  onOpen: (note: Note) => void;
  /** Create a subpage, open it, and focus its title. */
  onCreateChild: (parentId: number) => void;
  onTrash: (note: Note) => void;
  onExport: (note: Note) => void;
}

export function NoteTree({
  notes,
  selectedId,
  onOpen,
  onCreateChild,
  onTrash,
  onExport,
}: NoteTreeProps) {
  const tree = useMemo(() => buildTree(notes), [notes]);
  const [expanded, setExpanded] = useState<Set<number>>(readExpanded);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [iconId, setIconId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [drop, setDrop] = useState<{
    id: number | "root";
    pos: DropPosition;
  } | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const pickerRef = useRef<HTMLSpanElement>(null);
  // What the closing row menu should hand focus to.
  const afterMenu = useRef<"row" | "keep" | "icon">("row");

  const updateExpanded = (change: (next: Set<number>) => void) =>
    setExpanded((current) => {
      const next = new Set(current);
      change(next);
      writeExpanded(next);
      return next;
    });

  // Opening a page reveals it. Only on open (or a move), so collapsing its
  // parent afterwards sticks.
  const revealed = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId == null) return;
    const chain = ancestorsOf(notes, selectedId).map((note) => note.id!);
    const key = `${selectedId}:${chain.join(",")}`;
    if (revealed.current === key) return;
    revealed.current = key;
    if (chain.every((id) => expanded.has(id))) return;
    updateExpanded((next) => chain.forEach((id) => next.add(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, notes]);

  const { rows, childIds } = useMemo(() => {
    const rows: FlatRow[] = [];
    const childIds = new Map<number | null, number[]>();
    const walk = (
      nodes: NoteTreeNode[],
      depth: number,
      parentId: number | null,
      visible: boolean,
    ) => {
      childIds.set(
        parentId,
        nodes.map((node) => node.note.id!),
      );
      nodes.forEach((node, index) => {
        const id = node.note.id!;
        const open = expanded.has(id);
        if (visible)
          rows.push({
            note: node.note,
            id,
            depth,
            parentId,
            hasChildren: node.children.length > 0,
            expanded: open && node.children.length > 0,
            posinset: index + 1,
            setsize: nodes.length,
          });
        walk(node.children, depth + 1, id, visible && open);
      });
    };
    walk(tree, 0, null, true);
    return { rows, childIds };
  }, [tree, expanded]);

  const dragBlocked = useMemo(
    () =>
      dragId == null
        ? new Set<number>()
        : new Set([dragId, ...descendantIds(notes, dragId)]),
    [dragId, notes],
  );

  // Open the icon picker that replaced the row icon, then drop it again once
  // the popover closes. The picker owns its open state, so its trigger is
  // clicked and its `data-state` watched instead.
  useEffect(() => {
    if (iconId == null) return;
    const button = pickerRef.current?.querySelector("button");
    if (!button) return;
    const timer = window.setTimeout(() => button.click(), 0);
    let opened = false;
    const observer = new MutationObserver(() => {
      const state = button.getAttribute("data-state");
      if (state === "open") opened = true;
      if (state === "closed" && opened) {
        setIconId(null);
        rowRefs.current.get(iconId)?.focus();
      }
    });
    observer.observe(button, { attributes: true, attributeFilter: ["data-state"] });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [iconId]);

  const tabbableId =
    (activeId != null && rows.some((row) => row.id === activeId) && activeId) ||
    (selectedId != null && rows.some((row) => row.id === selectedId) && selectedId) ||
    rows[0]?.id;

  const focusRow = (id: number | undefined) => {
    if (id == null) return;
    setActiveId(id);
    rowRefs.current.get(id)?.focus();
  };

  const act = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save changes",
      );
    }
  };

  const addChild = (row: FlatRow) => {
    updateExpanded((next) => next.add(row.id));
    onCreateChild(row.id);
  };

  /** Shift a page one place among its siblings; focus stays on its row. */
  const reorder = (row: FlatRow, offset: -1 | 1) => {
    const siblings = childIds.get(row.parentId) ?? [];
    const index = siblings.indexOf(row.id) + offset;
    if (index < 0 || index >= siblings.length) return;
    void act(() =>
      useNotes
        .getState()
        .moveNote(row.id, { parentId: row.parentId, index }),
    );
  };

  // After "Move to…", open the new parent and its ancestors so the page shows.
  const revealParent = (parentId: number | null) => {
    if (parentId == null) return;
    const chain = [
      parentId,
      ...ancestorsOf(notes, parentId).map((note) => note.id!),
    ];
    updateExpanded((next) => chain.forEach((id) => next.add(id)));
  };

  const trash = (row: FlatRow) => {
    const index = rows.findIndex((r) => r.id === row.id);
    // Skip the page's own visible descendants when picking the next focus.
    const after = rows
      .slice(index + 1)
      .find((r) => r.depth <= row.depth);
    onTrash(row.note);
    const next = after ?? rows[index - 1];
    if (next) requestAnimationFrame(() => focusRow(next.id));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute("role") !== "treeitem") return;
    const targetId = Number(target.dataset.noteId);
    const index = rows.findIndex((row) => row.id === targetId);
    const row = rows[index];
    if (!row) return;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    switch (event.key) {
      case "ArrowDown":
        handled();
        focusRow(rows[index + 1]?.id);
        break;
      case "ArrowUp":
        handled();
        focusRow(rows[index - 1]?.id);
        break;
      case "Home":
        handled();
        focusRow(rows[0]?.id);
        break;
      case "End":
        handled();
        focusRow(rows[rows.length - 1]?.id);
        break;
      case "ArrowRight":
        handled();
        if (row.hasChildren && !row.expanded)
          updateExpanded((next) => next.add(row.id));
        else if (row.expanded) focusRow(rows[index + 1]?.id);
        break;
      case "ArrowLeft":
        handled();
        if (row.expanded) updateExpanded((next) => next.delete(row.id));
        else if (row.parentId != null) focusRow(row.parentId);
        break;
      case "Enter":
        handled();
        onOpen(row.note);
        break;
      case "F2":
        handled();
        setRenamingId(row.id);
        break;
      case "Delete":
        handled();
        trash(row);
        break;
      case "ContextMenu":
        handled();
        setMenuId(row.id);
        break;
      case "F10":
        if (event.shiftKey) {
          handled();
          setMenuId(row.id);
        }
        break;
    }
  };

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const positionFor = (event: React.DragEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const y = (event.clientY - rect.top) / rect.height;
    return y < 1 / 3 ? "before" : y > 2 / 3 ? "after" : "inside";
  };

  const finishDrag = () => {
    setDragId(null);
    setDrop(null);
  };

  const dropOnRow = (row: FlatRow, pos: DropPosition) => {
    const id = dragId;
    finishDrag();
    if (id == null || dragBlocked.has(row.id)) return;
    let parentId: number | null;
    let index: number;
    if (pos === "inside" || (pos === "after" && row.expanded)) {
      parentId = row.id;
      const kids = (childIds.get(row.id) ?? []).filter((kid) => kid !== id);
      index = pos === "inside" ? kids.length : 0;
      updateExpanded((next) => next.add(row.id));
    } else {
      parentId = row.parentId;
      const siblings = (childIds.get(row.parentId) ?? []).filter(
        (sibling) => sibling !== id,
      );
      index = siblings.indexOf(row.id) + (pos === "after" ? 1 : 0);
    }
    void act(() => useNotes.getState().moveNote(id, { parentId, index }));
  };

  const dropAtRoot = () => {
    const id = dragId;
    finishDrag();
    if (id == null) return;
    const roots = (childIds.get(null) ?? []).filter((root) => root !== id);
    void act(() =>
      useNotes.getState().moveNote(id, { parentId: null, index: roots.length }),
    );
  };

  const indicatorDepth = (row: FlatRow, pos: DropPosition) =>
    pos === "after" && row.expanded ? row.depth + 1 : row.depth;

  const renderRow = (row: FlatRow) => {
    const { note, id, depth } = row;
    const selected = id === selectedId;
    const renaming = renamingId === id;
    const target = drop && drop.id === id ? drop.pos : null;
    return (
      <div
        key={id}
        ref={(element) => {
          if (element) rowRefs.current.set(id, element);
          else rowRefs.current.delete(id);
        }}
        role="treeitem"
        data-note-id={id}
        aria-level={depth + 1}
        aria-setsize={row.setsize}
        aria-posinset={row.posinset}
        aria-expanded={row.hasChildren ? row.expanded : undefined}
        aria-selected={selected}
        aria-label={noteTitle(note)}
        tabIndex={tabbableId === id ? 0 : -1}
        draggable={!renaming}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setActiveId(id);
        }}
        onClick={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          setActiveId(id);
          if (!renaming) onOpen(note);
        }}
        onContextMenu={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          event.preventDefault();
          setActiveId(id);
          setMenuId(id);
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", noteTitle(note));
          setDragId(id);
        }}
        onDragEnd={finishDrag}
        onDragOver={(event) => {
          if (dragId == null || dragBlocked.has(id)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          const pos = positionFor(event, event.currentTarget);
          if (drop?.id !== id || drop.pos !== pos) setDrop({ id, pos });
        }}
        onDrop={(event) => {
          event.preventDefault();
          dropOnRow(row, positionFor(event, event.currentTarget));
        }}
        className={cn(
          "group relative flex h-10 min-w-0 cursor-default select-none items-center gap-1 rounded-lg pr-1 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 md:h-8",
          selected
            ? "bg-primary/12 text-primary"
            : "text-foreground/90 hover:bg-muted/50",
          dragId === id && "opacity-50",
          target === "inside" && "bg-primary/12 ring-2 ring-inset ring-primary/50",
        )}
        style={{ paddingLeft: PAD + depth * INDENT }}
      >
        {Array.from({ length: depth }, (_, level) => (
          <span
            key={level}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 border-l border-border/60"
            style={{ left: PAD + level * INDENT + GUIDE }}
          />
        ))}
        {row.hasChildren ? (
          <span
            aria-hidden
            onClick={(event) => {
              event.stopPropagation();
              updateExpanded((next) =>
                row.expanded ? next.delete(id) : next.add(id),
              );
            }}
            className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <ChevronRight
              className={cn(
                "size-3.5 motion-safe:transition-transform motion-safe:duration-150",
                row.expanded && "rotate-90",
              )}
            />
          </span>
        ) : (
          <span aria-hidden className="size-5 shrink-0" />
        )}
        {iconId === id ? (
          <span
            ref={pickerRef}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="contents"
          >
            <ProjectIconPicker
              value={note.icon}
              label="Change page icon"
              onChange={(icon) =>
                void act(() => useNotes.getState().updateNote(id, { icon }))
              }
              className="size-5 rounded-md bg-transparent text-current"
            >
              <ProjectIcon name={note.icon || NOTE_ICON} className="size-4" />
            </ProjectIconPicker>
          </span>
        ) : (
          <ProjectIcon
            name={note.icon || NOTE_ICON}
            className={cn(
              "size-4 shrink-0",
              selected ? "text-primary" : "text-muted-foreground",
            )}
          />
        )}
        {renaming ? (
          <RenameInput
            initial={note.title}
            onDone={(title) => {
              setRenamingId(null);
              if (title !== undefined && title !== note.title)
                void act(() => useNotes.getState().updateNote(id, { title }));
              requestAnimationFrame(() => focusRow(id));
            }}
          />
        ) : (
          <span
            className={cn(
              "ml-1 min-w-0 flex-1 truncate",
              !note.title.trim() && "text-muted-foreground",
            )}
          >
            {noteTitle(note)}
          </span>
        )}
        {!renaming && (
          <span
            className={cn(
              "flex shrink-0 items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
              menuId === id && "opacity-100",
            )}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Add a page inside ${noteTitle(note)}`}
              title="Add subpage"
              onClick={(event) => {
                event.stopPropagation();
                addChild(row);
              }}
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:size-6"
            >
              <Plus className="size-3.5" />
            </button>
            <DropdownMenu
              open={menuId === id}
              onOpenChange={(open) => {
                if (open) afterMenu.current = "row";
                setMenuId(open ? id : null);
              }}
            >
              <DropdownMenuTrigger
                tabIndex={-1}
                aria-label={`Options for ${noteTitle(note)}`}
                title="Page options"
                onClick={(event) => event.stopPropagation()}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:size-6"
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-44 rounded-xl shadow-xs"
                onClick={(event) => event.stopPropagation()}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  const next = afterMenu.current;
                  if (next === "row") focusRow(id);
                }}
              >
                <DropdownMenuItem
                  onSelect={() => {
                    afterMenu.current = "keep";
                    setRenamingId(id);
                  }}
                >
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    afterMenu.current = "icon";
                    setIconId(id);
                  }}
                >
                  <Shapes className="size-4" />
                  Change icon
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    afterMenu.current = "keep";
                    addChild(row);
                  }}
                >
                  <FilePlus2 className="size-4" />
                  Add subpage
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    afterMenu.current = "keep";
                    setMovingId(id);
                  }}
                >
                  <CornerDownRight className="size-4" />
                  Move to…
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={row.posinset === 1}
                  onSelect={() => reorder(row, -1)}
                >
                  <ArrowUp className="size-4" />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={row.posinset === row.setsize}
                  onSelect={() => reorder(row, 1)}
                >
                  <ArrowDown className="size-4" />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onExport(note)}>
                  <FileDown className="size-4" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    afterMenu.current = "keep";
                    trash(row);
                  }}
                >
                  <Trash2 className="size-4" />
                  Move to trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
        {target && target !== "inside" && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute right-1 h-0.5 rounded-full bg-primary",
              target === "before" ? "-top-px" : "-bottom-px",
            )}
            style={{
              left: PAD + indicatorDepth(row, target) * INDENT + GUIDE,
            }}
          />
        )}
      </div>
    );
  };

  const moving =
    movingId != null ? notes.find((note) => note.id === movingId) : undefined;

  return (
    <div className="flex min-h-full flex-col">
      {moving && (
        <NoteMoveDialog
          note={moving}
          notes={notes}
          onMoved={revealParent}
          onClose={() => {
            setMovingId(null);
            requestAnimationFrame(() => focusRow(moving.id));
          }}
        />
      )}
      {rows.length === 0 ? (
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-sm font-medium">No pages yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the plus above to add your first page.
          </p>
        </div>
      ) : (
        <div
          role="tree"
          aria-label="Pages"
          onKeyDown={onKeyDown}
          className="min-w-0"
        >
          {rows.map(renderRow)}
        </div>
      )}
      <div
        aria-hidden
        onDragOver={(event) => {
          if (dragId == null) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (drop?.id !== "root") setDrop({ id: "root", pos: "after" });
        }}
        onDragLeave={() => {
          if (drop?.id === "root") setDrop(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dropAtRoot();
        }}
        className="relative min-h-12 flex-1"
      >
        {drop?.id === "root" && (
          <span
            className="pointer-events-none absolute right-1 top-0 h-0.5 rounded-full bg-primary"
            style={{ left: PAD + GUIDE }}
          />
        )}
      </div>
    </div>
  );
}

/** Inline title field for F2 / Rename. Enter or blur saves, Escape cancels. */
function RenameInput({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (title: string | undefined) => void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (title: string | undefined) => {
    if (done.current) return;
    done.current = true;
    onDone(title);
  };
  return (
    <input
      autoFocus
      aria-label="Page title"
      value={value}
      placeholder="Untitled"
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(value.trim());
        if (event.key === "Escape") finish(undefined);
      }}
      onBlur={() => finish(value.trim())}
      className="ml-1 h-7 min-w-0 flex-1 rounded-md bg-background px-1.5 text-sm text-foreground shadow-xs outline-none ring-2 ring-primary/40 md:h-6"
    />
  );
}

/** Flat list of title matches, each with a muted path of its ancestors. */
export function NoteSearchResults({
  notes,
  query,
  selectedId,
  onOpen,
}: {
  notes: Note[];
  query: string;
  selectedId?: number;
  onOpen: (note: Note) => void;
}) {
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    return notes
      .filter(
        (note) =>
          !isTrashed(note) &&
          note.id != null &&
          noteTitle(note).toLowerCase().includes(search),
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .map((note) => ({
        note,
        path: ancestorsOf(notes, note.id!)
          .filter((ancestor) => !isTrashed(ancestor))
          .map(noteTitle)
          .join(" / "),
      }));
  }, [notes, query]);

  if (!matches.length)
    return (
      <div className="rounded-xl bg-muted/40 p-3">
        <p className="break-words text-sm font-medium">
          No pages match “{query.trim()}”
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Search looks at page titles. Try a shorter word.
        </p>
      </div>
    );

  return (
    <ul aria-label="Search results" className="space-y-0.5">
      {matches.map(({ note, path }) => {
        const selected = note.id === selectedId;
        return (
          <li key={note.id}>
            <button
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onOpen(note)}
              className={cn(
                "flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary",
                selected ? "bg-primary/12 text-primary" : "hover:bg-muted/50",
              )}
            >
              <ProjectIcon
                name={note.icon || NOTE_ICON}
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  selected ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm",
                    !note.title.trim() && "text-muted-foreground",
                  )}
                >
                  {noteTitle(note)}
                </span>
                {path && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {path}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
