/** A small caret menu listens to selection changes without rendering the whole editor. */
"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { Type, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Minus, MessageSquare, ChevronRight, Code2, Table2, ImageIcon, Sigma, Radical, Columns2, Columns3, Columns4, type LucideIcon } from "lucide-react";
import { insertBlock, insertColumns } from "./commands";
import { cn } from "@/lib/utils";

interface Command { label: string; hint: string; group: string; Icon: LucideIcon; run: (editor: Editor) => void }
interface Match { from: number; to: number; query: string; left: number; top: number; bottom: number }

export function SlashMenu({ editor, keyHandler, onImage }: { editor: Editor; keyHandler: MutableRefObject<((event: KeyboardEvent) => boolean) | null>; onImage: () => void }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [active, setActive] = useState(0);
  const dismissed = useRef<string | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const commands: Command[] = [
    { label: "Text", hint: "Plain paragraph", group: "Basic blocks", Icon: Type, run: (e) => { e.chain().focus().setParagraph().run(); } },
    ...([1, 2, 3] as const).map((level) => ({ label: `Heading ${level}`, hint: `Ctrl+Alt+${level}`, group: "Basic blocks", Icon: [Heading1, Heading2, Heading3][level - 1], run: (e: Editor) => { e.chain().focus().setHeading({ level }).run(); } })),
    { label: "Bulleted list", hint: "Unordered items", group: "Basic blocks", Icon: List, run: (e) => { e.chain().focus().toggleBulletList().run(); } },
    { label: "Numbered list", hint: "Ordered items", group: "Basic blocks", Icon: ListOrdered, run: (e) => { e.chain().focus().toggleOrderedList().run(); } },
    { label: "Checklist", hint: "Track small tasks", group: "Basic blocks", Icon: ListTodo, run: (e) => { e.chain().focus().toggleTaskList().run(); } },
    { label: "Quote", hint: "A quoted passage", group: "Basic blocks", Icon: Quote, run: (e) => { e.chain().focus().toggleBlockquote().run(); } },
    { label: "Divider", hint: "Separate sections", group: "Basic blocks", Icon: Minus, run: (e) => { e.chain().focus().setHorizontalRule().run(); } },
    { label: "Callout", hint: "Make something stand out", group: "Rich blocks", Icon: MessageSquare, run: (e) => { insertBlock(e, "callout"); } },
    { label: "Toggle", hint: "Collapsible details", group: "Rich blocks", Icon: ChevronRight, run: (e) => { insertBlock(e, "toggle"); } },
    { label: "Code block", hint: "Syntax-highlighted code", group: "Rich blocks", Icon: Code2, run: (e) => { e.chain().focus().setCodeBlock().run(); } },
    { label: "Table", hint: "3 × 3, with header", group: "Rich blocks", Icon: Table2, run: (e) => { e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); } },
    { label: "Image", hint: "Upload from this device", group: "Rich blocks", Icon: ImageIcon, run: onImage },
    { label: "Math equation", hint: "Centered on its own line · $$", group: "Rich blocks", Icon: Sigma, run: (e) => { e.chain().focus().insertMathBlock().run(); } },
    { label: "Inline equation", hint: "Inside the sentence · $x$ or Ctrl+Shift+M", group: "Rich blocks", Icon: Radical, run: (e) => { e.chain().focus().insertMathInline().run(); } },
    ...([2, 3, 4] as const).map((count) => ({ label: `${count} columns`, hint: "Side-by-side blocks", group: "Layout", Icon: [Columns2, Columns3, Columns4][count - 2], run: (e: Editor) => { insertColumns(e, count); } })),
  ];
  const filtered = commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(match?.query.toLowerCase() || ""));

  useEffect(() => {
    const update = () => {
      const { $from, empty, from } = editor.state.selection;
      if (!editor.isEditable || !editor.isFocused || !empty || !$from.parent.isTextblock || editor.isActive("codeBlock")) { setMatch(null); return; }
      const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
      const found = before.match(/(?:^|\s)\/([^/\n]{0,60})$/);
      if (!found) { dismissed.current = null; setMatch(null); return; }
      const query = found[1], start = from - query.length - 1;
      if (dismissed.current === `${start}:${query}`) return;
      const rect = editor.view.coordsAtPos(from);
      setMatch((previous) => {
        if (previous?.from === start && previous.to === from && previous.query === query && previous.left === rect.left && previous.top === rect.top) return previous;
        return { from: start, to: from, query, left: rect.left, top: rect.top, bottom: rect.bottom };
      });
    };
    editor.on("transaction", update); editor.on("focus", update); editor.on("blur", update);
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => { editor.off("transaction", update); editor.off("focus", update); editor.off("blur", update); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [editor]);
  useEffect(() => { setActive(0); }, [match?.query]);
  useEffect(() => { menu.current?.querySelector(`[data-command-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const choose = (index: number) => {
    const command = filtered[index];
    if (!match || !command) return;
    editor.chain().focus().deleteRange({ from: match.from, to: match.to }).run();
    setMatch(null); command.run(editor);
  };
  keyHandler.current = (event) => {
    if (!match) return false;
    if (event.key === "Escape") { dismissed.current = `${match.from}:${match.query}`; setMatch(null); return true; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + Math.max(1, filtered.length)) % Math.max(1, filtered.length)); return true; }
    if (event.key === "Enter" && filtered.length) { choose(active); return true; }
    return false;
  };
  useEffect(() => () => { keyHandler.current = null; }, [keyHandler]);
  if (!match) return null;
  const height = Math.min(340, window.innerHeight - 24);
  const below = window.innerHeight - match.bottom - 12;
  const preferredTop = below < height ? match.top - height - 8 : match.bottom + 8;
  const top = Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8));
  return createPortal(<div className="note-prose" style={{ position: "fixed", zIndex: 80, left: Math.max(8, Math.min(match.left, window.innerWidth - 296)), top, width: Math.min(288, window.innerWidth - 16) }}>
    <div ref={menu} role="listbox" aria-label="Insert a block" className="overflow-y-auto rounded-xl border bg-popover p-1 shadow-xs" style={{ maxHeight: height }}>
      {!filtered.length && <p className="px-3 py-2 text-sm text-muted-foreground">No matching commands</p>}
      {filtered.map(({ label, hint, group, Icon }, index) => <div key={label}>
        {(index === 0 || filtered[index - 1].group !== group) && <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group}</div>}
        <button type="button" role="option" aria-selected={index === active} data-command-index={index}
          className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring", index === active && "bg-muted")}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}>
          <Icon className="size-4 shrink-0 text-muted-foreground" /><span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
        </button>
      </div>)}
    </div>
  </div>, document.body);
}
