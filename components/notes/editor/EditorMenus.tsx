/**
 * Selection-driven editor chrome. Everything here floats over the page instead
 * of taking space in it, so the text never jumps when a control appears.
 */
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from "react";
import { BubbleMenu, useEditorState, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import {
  Bold, Italic, Underline, Strikethrough, Code, Highlighter, Link as LinkIcon, Subscript, Superscript, RemoveFormatting,
  Check, X, ExternalLink, BetweenHorizontalStart, BetweenHorizontalEnd, BetweenVerticalStart, BetweenVerticalEnd, Rows2,
  Columns2, Columns3, PanelTop, PanelLeft, TableCellsMerge, TableCellsSplit, Trash2, Ungroup, Info, Lightbulb, TriangleAlert,
  OctagonAlert, Minus, Plus, Type, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Code2,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { validNoteLink } from "@/lib/note-extensions";
import { cn } from "@/lib/utils";
import { changeColumns, columnContext } from "./commands";
import { NoteSelect, type NoteSelectOption } from "./NoteSelect";

const control = "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-35";
const bar = "flex items-center gap-0.5 rounded-xl border bg-popover p-1 text-popover-foreground shadow-xs";
const divider = <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;

interface MarkAction { name: string; label: string; Icon: LucideIcon; run: (editor: Editor) => void }
const actions: MarkAction[] = [
  { name: "bold", label: "Bold · Ctrl/⌘ B", Icon: Bold, run: (e) => { e.chain().focus().toggleBold().run(); } },
  { name: "italic", label: "Italic · Ctrl/⌘ I", Icon: Italic, run: (e) => { e.chain().focus().toggleItalic().run(); } },
  { name: "underline", label: "Underline · Ctrl/⌘ U", Icon: Underline, run: (e) => { e.chain().focus().toggleUnderline().run(); } },
  { name: "strike", label: "Strikethrough · Ctrl/⌘ Shift X", Icon: Strikethrough, run: (e) => { e.chain().focus().toggleStrike().run(); } },
  { name: "code", label: "Inline code · Ctrl/⌘ E", Icon: Code, run: (e) => { e.chain().focus().toggleCode().run(); } },
  { name: "highlight", label: "Highlight · Ctrl/⌘ Shift H", Icon: Highlighter, run: (e) => { e.chain().focus().toggleHighlight().run(); } },
  { name: "subscript", label: "Subscript", Icon: Subscript, run: (e) => { e.chain().focus().toggleSubscript().run(); } },
  { name: "superscript", label: "Superscript", Icon: Superscript, run: (e) => { e.chain().focus().toggleSuperscript().run(); } },
];

const callouts: { variant: string; label: string; Icon: LucideIcon }[] = [
  { variant: "note", label: "Note", Icon: Info },
  { variant: "tip", label: "Tip", Icon: Lightbulb },
  { variant: "warning", label: "Warning", Icon: TriangleAlert },
  { variant: "danger", label: "Danger", Icon: OctagonAlert },
];

/** An icon with a small plus or minus badge, for actions lucide has no glyph for. */
function Badged({ Icon, badge }: { Icon: LucideIcon; badge: "plus" | "minus" }) {
  const Mark = badge === "plus" ? Plus : Minus;
  return <span className="relative grid size-4 place-items-center">
    <Icon className="size-4" />
    <Mark className="absolute -right-1.5 -bottom-1.5 size-2.5 rounded-full bg-popover" strokeWidth={3} />
  </span>;
}

/** Icon-only button with a hover/focus tooltip. Keeps editor focus on click. */
function IconButton({ label, onClick, pressed, disabled, children }: {
  label: string; onClick: () => void; pressed?: boolean; disabled?: boolean; children: ReactNode;
}) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" aria-label={label} aria-pressed={pressed} disabled={disabled}
        className={cn(control, pressed && "bg-muted text-foreground")}
        onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</button>
    </TooltipTrigger>
    <TooltipContent side="top" sideOffset={6}>{label}</TooltipContent>
  </Tooltip>;
}

const BLOCK_KINDS: NoteSelectOption[] = [
  { value: "paragraph", label: "Text", icon: <Type className="size-4" /> },
  { value: "h1", label: "Heading 1", icon: <Heading1 className="size-4" /> },
  { value: "h2", label: "Heading 2", icon: <Heading2 className="size-4" /> },
  { value: "h3", label: "Heading 3", icon: <Heading3 className="size-4" /> },
  { value: "bulletList", label: "Bulleted list", icon: <List className="size-4" /> },
  { value: "orderedList", label: "Numbered list", icon: <ListOrdered className="size-4" /> },
  { value: "taskList", label: "Checklist", icon: <ListTodo className="size-4" /> },
  { value: "blockquote", label: "Quote", icon: <Quote className="size-4" /> },
  { value: "codeBlock", label: "Code block", icon: <Code2 className="size-4" /> },
];

const ALIGNMENTS: NoteSelectOption[] = [
  { value: "left", label: "Align left", icon: <AlignLeft className="size-4" /> },
  { value: "center", label: "Align center", icon: <AlignCenter className="size-4" /> },
  { value: "right", label: "Align right", icon: <AlignRight className="size-4" /> },
  { value: "justify", label: "Justify", icon: <AlignJustify className="size-4" /> },
];

const BLOCK_TYPES = new Set(["table", "columns", "callout"]);

/** Innermost table, column layout or callout around the selection. */
function activeBlock(editor: Editor): { type: string; pos: number } | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const type = $from.node(depth).type.name;
    if (BLOCK_TYPES.has(type)) return { type, pos: $from.before(depth) };
  }
  return null;
}

/**
 * Absolutely positioned layer inside the editor column. Anchored to a rect
 * from the editor, re-measured on every transaction and on resize, and
 * scrolls with the page because it lives in the same container.
 */
function Floating({ editor, anchor, placement, children, label, role = "toolbar" }: {
  editor: Editor; anchor: () => DOMRect | null; placement: "above" | "below"; children: ReactNode; label: string; role?: string;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const measure = useCallback(() => {
    const element = layer.current;
    const host = element?.offsetParent as HTMLElement | null;
    const rect = anchor();
    if (!element || !host || !rect) { setStyle({ visibility: "hidden" }); return; }
    const box = host.getBoundingClientRect();
    const width = element.offsetWidth;
    const left = Math.max(0, Math.min(rect.left - box.left, box.width - width));
    let top = placement === "above" ? rect.top - box.top - element.offsetHeight - 8 : rect.bottom - box.top + 8;
    // No room above the first block: drop below the anchor instead.
    if (placement === "above" && rect.top - element.offsetHeight - 8 < 0) top = rect.bottom - box.top + 8;
    setStyle({ top, left });
  }, [anchor, placement]);
  useLayoutEffect(() => {
    measure();
    editor.on("transaction", measure);
    window.addEventListener("resize", measure);
    return () => { editor.off("transaction", measure); window.removeEventListener("resize", measure); };
  }, [editor, measure]);
  return <div ref={layer} role={role} aria-label={label} style={style}
    className="absolute z-30 max-w-full motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
    {children}
  </div>;
}

export function EditorMenus({ editor, openLinkRef }: { editor: Editor; openLinkRef: MutableRefObject<(() => void) | null> }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [focused, setFocused] = useState(editor.isFocused);
  const chrome = useRef<HTMLDivElement>(null);
  const state = useEditorState({ editor, selector: ({ editor: e }) => {
    const block = activeBlock(e);
    const can = e.can();
    const table = block?.type === "table" ? e.state.doc.nodeAt(block.pos) : null;
    const rows = table ? Array.from({ length: table.childCount }, (_, i) => table.child(i)) : [];
    return {
      marks: actions.map(({ name }) => e.isActive(name)), link: e.isActive("link"),
      block: block?.type ?? null, blockPos: block?.pos ?? -1,
      columns: columnContext(e)?.node.childCount || 0,
      variant: e.getAttributes("callout").variant || "note",
      can: block?.type === "table" ? {
        addRowBefore: can.addRowBefore(), addRowAfter: can.addRowAfter(), deleteRow: can.deleteRow(),
        addColumnBefore: can.addColumnBefore(), addColumnAfter: can.addColumnAfter(), deleteColumn: can.deleteColumn(),
        mergeCells: can.mergeCells(), splitCell: can.splitCell(),
        headerRow: !!rows[0] && Array.from({ length: rows[0].childCount }, (_, i) => rows[0].child(i)).every((cell) => cell.type.name === "tableHeader"),
        headerColumn: rows.length > 0 && rows.every((row) => row.firstChild?.type.name === "tableHeader"),
      } : null,
      kind: e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("taskList") ? "taskList" : e.isActive("bulletList") ? "bulletList" : e.isActive("orderedList") ? "orderedList" : e.isActive("blockquote") ? "blockquote" : e.isActive("codeBlock") ? "codeBlock" : "paragraph",
      align: e.getAttributes("heading").textAlign || e.getAttributes("paragraph").textAlign || "left",
    };
  } });

  // Block controls belong to the editing session: hide them once focus leaves
  // both the editor and the controls themselves.
  useEffect(() => {
    const onFocus = () => setFocused(true);
    const onBlur = ({ event }: { event: FocusEvent }) => {
      if (!chrome.current?.contains(event.relatedTarget as Node | null)) setFocused(false);
    };
    editor.on("focus", onFocus); editor.on("blur", onBlur);
    return () => { editor.off("focus", onFocus); editor.off("blur", onBlur); };
  }, [editor]);

  openLinkRef.current = () => { setUrl(editor.getAttributes("link").href || ""); setLinkOpen(true); };
  useEffect(() => () => { openLinkRef.current = null; }, [openLinkRef]);

  const blockAnchor = useCallback(() => {
    if (state.blockPos < 0) return null;
    const dom = editor.view.nodeDOM(state.blockPos);
    return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
  }, [editor, state.blockPos]);
  const selectionAnchor = useCallback(() => {
    const { from, to } = editor.state.selection;
    const start = editor.view.coordsAtPos(from), end = editor.view.coordsAtPos(to);
    return new DOMRect(start.left, start.top, Math.max(1, end.right - start.left), Math.max(end.bottom, start.bottom) - start.top);
  }, [editor]);

  const setBlock = (value: string) => {
    const chain = editor.chain().focus();
    if (value === "paragraph") chain.clearNodes().setParagraph().run();
    else if (/^h[123]$/.test(value)) chain.setHeading({ level: Number(value[1]) as 1 | 2 | 3 }).run();
    else if (value === "bulletList") chain.toggleBulletList().run();
    else if (value === "orderedList") chain.toggleOrderedList().run();
    else if (value === "taskList") chain.toggleTaskList().run();
    else if (value === "blockquote") chain.toggleBlockquote().run();
    else if (value === "codeBlock") chain.toggleCodeBlock().run();
  };
  const closeLink = () => { setLinkOpen(false); editor.commands.focus(); };

  return <div ref={chrome} className="contents">
    <BubbleMenu editor={editor} tippyOptions={{ duration: 100, maxWidth: "none", placement: "top", interactive: true }} shouldShow={({ state: selectionState }) => editor.isEditable && !linkOpen && selectionState.selection instanceof TextSelection && !selectionState.selection.empty && !editor.isActive("codeBlock")}>
      <div className={cn(bar, "max-w-[calc(100vw-2rem)] flex-wrap")} aria-label="Text formatting" role="toolbar">
        <NoteSelect label="Turn into" value={state.kind} options={BLOCK_KINDS} onChange={setBlock} />
        {divider}
        {actions.map(({ name, label, Icon, run }, index) => <IconButton key={name} label={label} pressed={state.marks[index]} onClick={() => run(editor)}><Icon className="size-4" /></IconButton>)}
        <IconButton label="Link · Ctrl/⌘ K" pressed={state.link} onClick={() => openLinkRef.current?.()}><LinkIcon className="size-4" /></IconButton>
        {divider}
        <NoteSelect label="Text alignment" iconOnly value={state.align} options={ALIGNMENTS} onChange={(align) => editor.chain().focus().setTextAlign(align).run()} />
        <IconButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="size-4" /></IconButton>
      </div>
    </BubbleMenu>

    {linkOpen && <Floating editor={editor} anchor={selectionAnchor} placement="below" label="Edit link" role="dialog">
      <form className={cn(bar, "w-80 max-w-full gap-1 p-1.5")} onSubmit={(event) => {
        event.preventDefault(); const value = url.trim();
        if (value && !validNoteLink(value)) { toast.error("Use an https, http or email link"); return; }
        const chain = editor.chain().focus().extendMarkRange("link");
        if (value) chain.setLink({ href: value }).run(); else chain.unsetLink().run();
        setLinkOpen(false);
      }}>
        <input autoFocus aria-label="Link URL" placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") closeLink(); }}
          className="h-8 min-w-0 flex-1 rounded-lg bg-muted/60 px-2 text-sm outline-none" />
        {validNoteLink(url) && <Tooltip><TooltipTrigger asChild><a className={control} href={url} target="_blank" rel="noopener noreferrer" aria-label="Open link"><ExternalLink className="size-4" /></a></TooltipTrigger><TooltipContent side="top" sideOffset={6}>Open link</TooltipContent></Tooltip>}
        <Tooltip><TooltipTrigger asChild><button type="submit" className={control} aria-label="Save link"><Check className="size-4" /></button></TooltipTrigger><TooltipContent side="top" sideOffset={6}>Save link</TooltipContent></Tooltip>
        <IconButton label="Cancel" onClick={closeLink}><X className="size-4" /></IconButton>
      </form>
    </Floating>}

    {focused && !linkOpen && editor.isEditable && state.block && <Floating key={`${state.block}:${state.blockPos}`} editor={editor} anchor={blockAnchor} placement="above"
      label={state.block === "table" ? "Table controls" : state.block === "columns" ? "Column controls" : "Callout style"}>
      <div className={cn(bar, "flex-wrap")}>
        {state.block === "table" && state.can && <>
          <IconButton label="Add row above" disabled={!state.can.addRowBefore} onClick={() => editor.chain().focus().addRowBefore().run()}><BetweenHorizontalStart className="size-4" /></IconButton>
          <IconButton label="Add row below" disabled={!state.can.addRowAfter} onClick={() => editor.chain().focus().addRowAfter().run()}><BetweenHorizontalEnd className="size-4" /></IconButton>
          <IconButton label="Delete row" disabled={!state.can.deleteRow} onClick={() => editor.chain().focus().deleteRow().run()}><Badged Icon={Rows2} badge="minus" /></IconButton>
          {divider}
          <IconButton label="Add column left" disabled={!state.can.addColumnBefore} onClick={() => editor.chain().focus().addColumnBefore().run()}><BetweenVerticalStart className="size-4" /></IconButton>
          <IconButton label="Add column right" disabled={!state.can.addColumnAfter} onClick={() => editor.chain().focus().addColumnAfter().run()}><BetweenVerticalEnd className="size-4" /></IconButton>
          <IconButton label="Delete column" disabled={!state.can.deleteColumn} onClick={() => editor.chain().focus().deleteColumn().run()}><Badged Icon={Columns2} badge="minus" /></IconButton>
          {divider}
          <IconButton label="Header row" pressed={state.can.headerRow} onClick={() => editor.chain().focus().toggleHeaderRow().run()}><PanelTop className="size-4" /></IconButton>
          <IconButton label="Header column" pressed={state.can.headerColumn} onClick={() => editor.chain().focus().toggleHeaderColumn().run()}><PanelLeft className="size-4" /></IconButton>
          <IconButton label="Merge cells" disabled={!state.can.mergeCells} onClick={() => editor.chain().focus().mergeCells().run()}><TableCellsMerge className="size-4" /></IconButton>
          <IconButton label="Split cell" disabled={!state.can.splitCell} onClick={() => editor.chain().focus().splitCell().run()}><TableCellsSplit className="size-4" /></IconButton>
          {divider}
          <IconButton label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="size-4" /></IconButton>
        </>}
        {state.block === "columns" && <>
          <IconButton label="Add column" disabled={state.columns >= 4} onClick={() => changeColumns(editor, "add")}><Badged Icon={Columns3} badge="plus" /></IconButton>
          <IconButton label="Remove this column" onClick={() => changeColumns(editor, "remove")}><Badged Icon={Columns2} badge="minus" /></IconButton>
          <IconButton label="Unwrap columns" onClick={() => changeColumns(editor, "unwrap")}><Ungroup className="size-4" /></IconButton>
        </>}
        {state.block === "callout" && callouts.map(({ variant, label, Icon }) => (
          <IconButton key={variant} label={label} pressed={state.variant === variant}
            onClick={() => editor.chain().focus().updateAttributes("callout", { variant }).run()}><Icon className="size-4" /></IconButton>
        ))}
      </div>
    </Floating>}
  </div>;
}
