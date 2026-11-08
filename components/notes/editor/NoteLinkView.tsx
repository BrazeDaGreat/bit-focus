/** Resolve link labels from the store without rewriting source pages on rename. */
"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useNotes } from "@/hooks/useNotes";
import { isTrashed, NOTE_ICON, noteHref, noteTitle } from "@/lib/notes";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function NoteLinkView({ node }: NodeViewProps) {
  const target = useNotes((state) => state.notes.find((note) => note.uid === node.attrs.uid));
  const unavailable = !target || isTrashed(target) || target.isTemplate;
  const title = target ? noteTitle(target) : node.attrs.title || "Deleted page";
  return <NodeViewWrapper as="span" contentEditable={false} className="note-page-link-wrap">
    <Tooltip><TooltipTrigger asChild>
      <button type="button" className="note-page-link" data-unavailable={unavailable || undefined}
        aria-label={unavailable ? `${title}, page unavailable` : `Open ${title}`}
        aria-disabled={unavailable || undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (target && !unavailable) window.history.pushState(null, "", noteHref(target)); }}>
        <ProjectIcon name={target?.icon || NOTE_ICON} className="size-3.5 shrink-0" />
        <span>{title}</span>
      </button>
    </TooltipTrigger><TooltipContent>{unavailable ? target && isTrashed(target) ? "This page is in Trash" : "This page is unavailable" : `Open ${title}`}</TooltipContent></Tooltip>
  </NodeViewWrapper>;
}
