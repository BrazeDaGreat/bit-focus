/** The [[ caret menu follows the same transaction-driven interaction as slash commands. */
"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useNotes } from "@/hooks/useNotes";
import { isTrashed, NOTE_ICON, noteTitle } from "@/lib/notes";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { cn } from "@/lib/utils";

interface Match { from: number; to: number; query: string; left: number; top: number; bottom: number }

export function NoteLinkMenu({ editor, keyHandler }: { editor: Editor; keyHandler: MutableRefObject<((event: KeyboardEvent) => boolean) | null> }) {
  const notes = useNotes((state) => state.notes);
  const [match, setMatch] = useState<Match | null>(null);
  const [active, setActive] = useState(0);
  const dismissed = useRef<string | null>(null);
  const busy = useRef(false);
  const menu = useRef<HTMLDivElement>(null);
  const matches = notes.filter((note) => note.uid && !isTrashed(note) && !note.isTemplate && noteTitle(note).toLowerCase().includes(match?.query.trim().toLowerCase() || ""))
    .sort((a, b) => noteTitle(a).localeCompare(noteTitle(b))).slice(0, 30);
  const canCreate = !!match?.query.trim();
  const count = matches.length + (canCreate ? 1 : 0);
  const activeIndex = Math.min(active, Math.max(0, count - 1));

  useEffect(() => {
    const update = () => {
      const { $from, empty, from } = editor.state.selection;
      if (!editor.isEditable || !editor.isFocused || !empty || !$from.parent.isTextblock || editor.isActive("codeBlock") || editor.isActive("code")) { setMatch(null); return; }
      const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
      const found = before.match(/\[\[([^\[\]\n\ufffc]{0,100})$/);
      if (!found) { dismissed.current = null; setMatch(null); return; }
      const query = found[1], start = from - query.length - 2;
      if (dismissed.current === `${start}:${query}`) return;
      const rect = editor.view.coordsAtPos(from);
      setMatch({ from: start, to: from, query, left: rect.left, top: rect.top, bottom: rect.bottom });
    };
    editor.on("transaction", update); editor.on("focus", update); editor.on("blur", update);
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => { editor.off("transaction", update); editor.off("focus", update); editor.off("blur", update); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [editor]);
  useEffect(() => { setActive(0); }, [match?.query]);
  useEffect(() => { menu.current?.querySelector(`[data-link-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" }); }, [activeIndex]);

  const choose = async (index: number) => {
    if (!match || busy.current || (!matches[index] && !canCreate)) return;
    busy.current = true;
    let from = match.from, to = match.to;
    const expected = editor.state.doc.textBetween(from, to);
    const map = ({ transaction }: { transaction: Transaction }) => { from = transaction.mapping.map(from); to = transaction.mapping.map(to); };
    editor.on("transaction", map);
    try {
      const target = matches[index] ?? await useNotes.getState().createNote({ title: match.query.trim() });
      if (editor.isDestroyed || !editor.isEditable || editor.state.doc.textBetween(from, to) !== expected) return;
      editor.chain().focus().insertContentAt({ from, to }, { type: "noteLink", attrs: { uid: target.uid, title: noteTitle(target) } }).run();
      setMatch(null);
    } catch { toast.error("Could not create linked page"); }
    finally { busy.current = false; editor.off("transaction", map); }
  };
  keyHandler.current = (event) => {
    if (!match || event.isComposing) return false;
    if (event.key === "Escape") { dismissed.current = `${match.from}:${match.query}`; setMatch(null); return true; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + Math.max(1, count)) % Math.max(1, count)); return true; }
    if (event.key === "Enter" && count) { void choose(activeIndex); return true; }
    return false;
  };
  useEffect(() => () => { keyHandler.current = null; }, [keyHandler]);
  if (!match) return null;
  const height = Math.min(300, window.innerHeight - 24);
  const top = Math.max(8, Math.min(window.innerHeight - match.bottom < height + 12 ? match.top - height - 8 : match.bottom + 8, window.innerHeight - height - 8));
  return createPortal(<div ref={menu} role="listbox" aria-label="Link to a page" className="fixed z-80 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-xs"
    style={{ left: Math.max(8, Math.min(match.left, window.innerWidth - 296)), top, width: Math.min(288, window.innerWidth - 16), maxHeight: height }}>
    <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Link to a page</p>
    {!count && <p className="px-2 py-2 text-xs text-muted-foreground">Type a page title to find or create it.</p>}
    {[...matches.map((target) => ({ key: target.uid!, title: noteTitle(target), icon: target.icon })), ...(canCreate ? [{ key: "create", title: `Create page ‘${match.query.trim()}’`, icon: undefined }] : [])].map((item, index) => <button
      type="button" key={item.key} role="option" aria-selected={index === activeIndex} data-link-index={index}
      className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring", index === activeIndex && "bg-muted")}
      onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => void choose(index)}>
      {index === matches.length ? <Plus className="size-4 shrink-0 text-muted-foreground" /> : <ProjectIcon name={item.icon || NOTE_ICON} className="size-4 shrink-0 text-muted-foreground" />}<span className="truncate">{item.title}</span>
    </button>)}
  </div>, document.body);
}
