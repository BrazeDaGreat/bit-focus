/** Quiet incoming links, derived locally; unchanged bodies keep their parsed cache. */
"use client";

import { useMemo, useState } from "react";
import { useNotes } from "@/hooks/useNotes";
import { createBacklinkIndex, NOTE_ICON, noteTitle, type Note } from "@/lib/notes";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";

export function NoteBacklinks({ uid, onOpen }: { uid: string; onOpen: (note: Note) => void }) {
  const notes = useNotes((state) => state.notes);
  const [index] = useState(createBacklinkIndex);
  const sources = useMemo(() => index(notes).get(uid) ?? [], [index, notes, uid]);
  if (!sources.length) return null;
  return <section aria-label="Linked from" className="border-t border-border/60 py-6">
    <h2 className="mb-2 text-xs text-muted-foreground">Linked from <span className="ml-1 font-mono tabular-nums">{sources.length}</span></h2>
    <ul className="space-y-0.5">{sources.map((source) => <li key={source.uid}>
      <button type="button" onClick={() => onOpen(source)} className="-ml-2 flex max-w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
        <ProjectIcon name={source.icon || NOTE_ICON} className="size-3.5 shrink-0" /><span className="truncate">{noteTitle(source)}</span>
      </button>
    </li>)}</ul>
  </section>;
}
