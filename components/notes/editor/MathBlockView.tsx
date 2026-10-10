/**
 * Equation node view: rendered maths at rest, source plus live preview while
 * editing. Edits go straight into the node's `latex` attribute so autosave and
 * undo treat them like any other change.
 */
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { mathOpenRequest } from "../extensions/math";

/** Render LaTeX into an element, returning the parse error message if any. */
function renderInto(element: HTMLElement | null, latex: string): string | null {
  if (!element) return null;
  try {
    katex.render(latex, element, { displayMode: true, throwOnError: true, strict: "ignore", trust: false });
    return null;
  } catch (error) {
    element.textContent = "";
    return error instanceof Error ? error.message.replace(/^KaTeX parse error:\s*/, "") : "Invalid LaTeX";
  }
}

export function MathBlockView({ node, updateAttributes, editor, selected, getPos }: NodeViewProps) {
  const latex: string = node.attrs.latex || "";
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const output = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLTextAreaElement>(null);
  const editable = editor.isEditable;

  // A freshly inserted, empty equation opens straight into its source.
  useEffect(() => {
    if (!mathOpenRequest.pending || !editable || latex) return;
    mathOpenRequest.pending = false; setEditing(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-time only
  }, []);
  useLayoutEffect(() => { setError(latex.trim() ? renderInto(output.current, latex) : null); }, [latex, editing]);
  useLayoutEffect(() => {
    const area = source.current;
    if (!editing || !area) return;
    area.style.height = "0px"; area.style.height = `${area.scrollHeight}px`;
  }, [editing, latex]);
  useEffect(() => { if (editing) source.current?.focus(); }, [editing]);

  /** Leave the source and put the caret after the equation. */
  const finish = (direction: "after" | "select" = "after") => {
    setEditing(false);
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos == null) return;
    const { state, view } = editor;
    const tr = state.tr;
    if (direction === "select") tr.setSelection(NodeSelection.create(tr.doc, pos));
    else {
      // Typing after an equation needs a line to type into; a last-block
      // equation would otherwise stay selected and the next key replace it.
      const after = pos + node.nodeSize;
      if (!tr.doc.resolve(after).nodeAfter?.isTextblock) tr.insert(after, state.schema.nodes.paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, after + 1));
    }
    view.dispatch(tr.scrollIntoView()); view.focus();
  };

  return <NodeViewWrapper className={cn("note-math", selected && "note-math-selected", editing && "note-math-editing")} data-type="math-block">
    <div contentEditable={false}>
      {editing && <textarea ref={source} value={latex} spellCheck={false} aria-label="LaTeX source"
        placeholder={"\\int_0^1 x^2 \\, dx = \\frac{1}{3}"}
        onChange={(event) => updateAttributes({ latex: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Escape" || ((event.ctrlKey || event.metaKey) && event.key === "Enter")) { event.preventDefault(); finish(event.key === "Escape" ? "select" : "after"); }
          event.stopPropagation();
        }}
        onBlur={() => setEditing(false)}
        className="note-math-source" />}
      <div role={editing ? undefined : "button"} tabIndex={editing || !editable ? -1 : 0}
        aria-label={editing ? "Equation preview" : "Edit equation"}
        onClick={() => { if (editable) setEditing(true); }}
        onKeyDown={(event) => { if (editable && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setEditing(true); } }}
        className="note-math-output">
        <div ref={output} hidden={!latex.trim() || !!error} />
        {!latex.trim() && <span className="note-math-empty">{editing ? "Preview appears here" : "Empty equation — click to write LaTeX"}</span>}
        {error && latex.trim() && <span className="note-math-error">{error}</span>}
      </div>
      {editing && <p className="note-math-hint">Ctrl/⌘ Enter to finish · Esc to select</p>}
    </div>
  </NodeViewWrapper>;
}

/**
 * Inline equation: rendered in the line, edited in a small popover with a live
 * preview. The popover is portalled so table cells and columns cannot clip it.
 */
export function MathInlineView({ node, updateAttributes, editor, selected, getPos }: NodeViewProps) {
  const latex: string = node.attrs.latex || "";
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const output = useRef<HTMLSpanElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLInputElement>(null);
  const editable = editor.isEditable;

  useEffect(() => {
    if (!mathOpenRequest.pending || !editable || latex) return;
    mathOpenRequest.pending = false; setEditing(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-time only
  }, []);
  useLayoutEffect(() => {
    if (!output.current) return;
    if (!latex.trim()) { output.current.textContent = ""; setError(null); return; }
    try { katex.render(latex, output.current, { displayMode: false, throwOnError: true, strict: "ignore", trust: false }); setError(null); }
    catch (caught) { output.current.textContent = latex; setError(caught instanceof Error ? caught.message.replace(/^KaTeX parse error:\s*/, "") : "Invalid LaTeX"); }
  }, [latex]);
  useLayoutEffect(() => {
    if (!editing || !preview.current) return;
    if (!latex.trim() || error) { preview.current.textContent = ""; return; }
    katex.render(latex, preview.current, { displayMode: true, throwOnError: false, strict: "ignore", trust: false });
  }, [editing, latex, error]);
  useLayoutEffect(() => {
    if (!editing) { setPlace(null); return; }
    const measure = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(352, window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom > 180;
      setPlace({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - 150) });
    };
    measure();
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [editing, latex]);
  // Focus once placed: the popover starts offscreen (hidden inputs cannot take focus).
  const placed = place !== null;
  useEffect(() => {
    if (!placed) return;
    const timer = setTimeout(() => source.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(timer);
  }, [placed]);

  /** Close the popover and put the caret just after the equation, or select it. */
  const finish = (select = false) => {
    setEditing(false);
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos == null) return;
    const { state, view } = editor;
    // An equation left empty is removed rather than kept as an invisible atom.
    if (!latex.trim()) { view.dispatch(state.tr.delete(pos, pos + node.nodeSize)); view.focus(); return; }
    const selection = select ? NodeSelection.create(state.doc, pos) : TextSelection.create(state.doc, pos + node.nodeSize);
    view.dispatch(state.tr.setSelection(selection)); view.focus();
  };

  return <NodeViewWrapper as="span" data-type="math-inline"
    className={cn("note-math-inline", selected && "note-math-inline-selected", error && "note-math-inline-error", !latex.trim() && "note-math-inline-empty")}>
    <span ref={anchor} contentEditable={false} title={error ?? undefined}
      onClick={() => { if (editable) setEditing(true); }}
      onKeyDown={(event) => { if (editable && event.key === "Enter") setEditing(true); }}>
      <span ref={output} />
      {!latex.trim() && <span aria-hidden>ƒ(x)</span>}
    </span>
    {editing && createPortal(<div role="dialog" aria-label="Edit inline equation"
      style={place ? { left: place.left, top: place.top } : { left: -10000, top: 0 }}
      className="fixed z-[10000] w-[min(22rem,calc(100vw-1rem))] rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xs">
      <input ref={source} value={latex} spellCheck={false} aria-label="LaTeX source" placeholder="x^2 + y^2 = r^2"
        onChange={(event) => updateAttributes({ latex: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); finish(event.key === "Escape"); }
          event.stopPropagation();
        }}
        onBlur={() => { if (!latex.trim()) finish(); else setEditing(false); }}
        className="h-8 w-full rounded-lg bg-muted/60 px-2 font-mono text-[13px] outline-none" />
      <div className="mt-1.5 min-h-10 overflow-x-auto rounded-lg px-2 py-1">
        <div ref={preview} hidden={!latex.trim() || !!error} />
        {!latex.trim() && <p className="py-1.5 text-center text-xs text-muted-foreground">Preview appears here</p>}
        {error && latex.trim() && <p className="py-1.5 text-center font-mono text-xs text-destructive">{error}</p>}
      </div>
      <p className="px-1 pt-1 text-[11px] text-muted-foreground">Enter to finish · Esc to select</p>
    </div>, document.body)}
  </NodeViewWrapper>;
}
