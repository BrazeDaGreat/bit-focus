/** Templates live beside the page tree, with the same quiet row menus and icon picker. */
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Copy, FilePlus2, LayoutTemplate, MoreHorizontal, Pencil, Shapes, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNotes } from "@/hooks/useNotes";
import { isTrashed, NOTE_ICON, noteHref, noteTitle, type Note } from "@/lib/notes";
import { cn } from "@/lib/utils";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { ProjectIconPicker } from "@/components/tasks/ProjectIconPicker";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Shared by the page menu, tree context menus, and the new-page button. */
export function NoteTemplateSubmenu({ parentId = null, onCreated }: { parentId?: number | null; onCreated?: (note: Note) => void }) {
  const notes = useNotes((state) => state.notes);
  const templates = notes.filter((note) => note.isTemplate && !isTrashed(note));
  const create = async (template: Note) => {
    try {
      const created = await useNotes.getState().createNote({ parentId, copyFrom: template });
      if (onCreated) onCreated(created);
      else window.history.pushState(null, "", noteHref(created));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create page from template"); }
  };
  return <DropdownMenuSub>
    <DropdownMenuSubTrigger className="gap-2"><LayoutTemplate className="size-4 text-muted-foreground" />New page from template</DropdownMenuSubTrigger>
    <DropdownMenuPortal><DropdownMenuSubContent className="max-h-72 max-w-[min(20rem,90vw)] overflow-y-auto rounded-xl shadow-xs">
      {templates.length ? templates.map((template) => <DropdownMenuItem key={template.uid} onSelect={() => void create(template)}>
        <ProjectIcon name={template.icon || NOTE_ICON} className="size-4" /><span className="truncate">{noteTitle(template)}</span>
      </DropdownMenuItem>) : <DropdownMenuItem disabled>No templates yet</DropdownMenuItem>}
    </DropdownMenuSubContent></DropdownMenuPortal>
  </DropdownMenuSub>;
}

/** Both right-click and the quiet button open this one creation menu. */
export function NoteCreateMenu({ onCreate, onCreated, children, className }: { onCreate: () => void; onCreated: (note: Note) => void; children: ReactNode; className: string }) {
  const [open, setOpen] = useState(false);
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger aria-label="New page" title="New page" className={className} onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}>{children}</DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="rounded-xl shadow-xs">
      <DropdownMenuItem onSelect={onCreate}><FilePlus2 className="size-4" />New page</DropdownMenuItem>
      <NoteTemplateSubmenu onCreated={onCreated} />
    </DropdownMenuContent>
  </DropdownMenu>;
}

export async function saveNoteAsTemplate(note: Note) {
  try {
    await useNotes.getState().createNote({ isTemplate: true, copyFrom: note });
    toast(`Saved “${noteTitle(note)}” as a template`);
  } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save template"); }
}

export function NoteTemplates({ selectedUid, onOpen, onCreated }: { selectedUid?: string; onOpen: (note: Note) => void; onCreated: (note: Note) => void }) {
  const notes = useNotes((state) => state.notes);
  const templates = notes.filter((note) => note.isTemplate && !isTrashed(note));
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedIsTemplate = notes.some((note) => note.uid === selectedUid && note.isTemplate);
  useEffect(() => { if (selectedIsTemplate) setExpanded(true); }, [selectedIsTemplate, selectedUid]);
  const create = async () => {
    try { onCreated(await useNotes.getState().createNote({ isTemplate: true, title: "Untitled template" })); setExpanded(true); }
    catch { toast.error("Could not create template"); }
  };
  return <div className="mb-1">
    <div className="group flex h-9 items-center rounded-lg text-muted-foreground hover:bg-muted/50" onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary">
        <ChevronRight className={cn("size-3 shrink-0", expanded && "rotate-90")} /><LayoutTemplate className="size-4" />Templates
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger aria-label="Template options" title="Template options" className="mr-1 grid size-7 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><MoreHorizontal className="size-3.5" /></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-xl shadow-xs"><DropdownMenuItem onSelect={() => void create()}><FilePlus2 className="size-4" />New template</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
    </div>
    {expanded && <div className="max-h-60 overflow-y-auto pl-4 pt-0.5">
      {templates.map((template) => <TemplateRow key={template.uid} note={template} selected={template.uid === selectedUid} onOpen={onOpen} onCreated={onCreated} />)}
      {!templates.length && <p className="px-2 py-2 text-xs text-muted-foreground">Use template options to create one.</p>}
    </div>}
  </div>;
}

function TemplateRow({ note, selected, onOpen, onCreated }: { note: Note; selected: boolean; onOpen: (note: Note) => void; onCreated: (note: Note) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [title, setTitle] = useState(note.title);
  const picker = useRef<HTMLSpanElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);
  const renameDone = useRef(false);
  const act = async (operation: () => Promise<unknown>) => {
    try { await operation(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update template"); }
  };
  useEffect(() => {
    if (!iconOpen) return;
    const trigger = picker.current?.querySelector("button");
    if (!trigger) return;
    const timer = setTimeout(() => trigger.click(), 0);
    let opened = false;
    const observer = new MutationObserver(() => {
      if (trigger.dataset.state === "open") opened = true;
      if (trigger.dataset.state === "closed" && opened) { setIconOpen(false); row.current?.focus(); }
    });
    observer.observe(trigger, { attributes: true, attributeFilter: ["data-state"] });
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [iconOpen]);
  const finishRename = () => {
    if (renameDone.current) return;
    renameDone.current = true;
    setRenaming(false);
    if (!cancelled.current && title !== note.title) void act(() => useNotes.getState().updateNote(note.id!, { title: title.trim() }));
    row.current?.focus();
  };
  return <div ref={row} tabIndex={-1} className={cn("group flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60", selected ? "bg-primary/12 text-primary" : "hover:bg-muted/50")}
    onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>
    {iconOpen ? <span ref={picker}><ProjectIconPicker value={note.icon} label="Change template icon" className="size-5 bg-transparent" onChange={(icon) => void act(() => useNotes.getState().updateNote(note.id!, { icon }))}>
      <ProjectIcon name={note.icon || NOTE_ICON} className="size-4" />
    </ProjectIconPicker></span> : <ProjectIcon name={note.icon || NOTE_ICON} className="size-4 shrink-0 text-muted-foreground" />}
    {renaming ? <input autoFocus aria-label="Template title" value={title} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setTitle(event.target.value)}
      onBlur={finishRename} onKeyDown={(event) => { if (event.key === "Escape") { cancelled.current = true; finishRename(); } if (event.key === "Enter") finishRename(); }} className="h-7 min-w-0 flex-1 rounded-md bg-background px-1 outline-none ring-2 ring-primary/40" />
      : <button type="button" aria-current={selected ? "page" : undefined} className="min-w-0 flex-1 truncate py-1.5 text-left focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onOpen(note)}>{noteTitle(note)}</button>}
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger aria-label={`Options for template ${noteTitle(note)}`} title="Template options" className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><MoreHorizontal className="size-3.5" /></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-xl shadow-xs" onCloseAutoFocus={(event) => { event.preventDefault(); if (!renaming && !iconOpen) row.current?.querySelector("button")?.focus(); }}>
        <DropdownMenuItem onSelect={() => { cancelled.current = false; renameDone.current = false; setTitle(note.title); setRenaming(true); }}><Pencil className="size-4" />Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setIconOpen(true)}><Shapes className="size-4" />Change icon</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void act(async () => onCreated(await useNotes.getState().createNote({ isTemplate: true, copyFrom: note, title: `${noteTitle(note)} (copy)` })))}><Copy className="size-4" />Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void act(async () => {
          await useNotes.getState().trashNote(note.id!);
          toast(`Deleted template “${noteTitle(note)}”`, { action: { label: "Undo", onClick: () => void act(() => useNotes.getState().restoreNote(note.id!)) } });
          if (selected) window.history.replaceState(null, "", "/notes");
        })}><Trash2 className="size-4" />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
