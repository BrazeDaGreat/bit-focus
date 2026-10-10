/** Interactive chrome is local to node views, keeping document transactions cheap. */
"use client";

import { useEffect, useRef, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { liveQuery } from "dexie";
import { AlignLeft, AlignCenter, AlignRight, Check, ChevronRight, Copy, GripVertical } from "lucide-react";
import { toast } from "sonner";
import db from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { NoteSelect } from "./NoteSelect";

const control = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";
const languageLabels: Record<string, string> = { plaintext: "Plain text", javascript: "JavaScript", typescript: "TypeScript", json: "JSON", html: "HTML", css: "CSS", bash: "Bash", python: "Python", sql: "SQL", java: "Java", c: "C", cpp: "C++", csharp: "C#", go: "Go", rust: "Rust", php: "PHP", ruby: "Ruby", swift: "Swift", kotlin: "Kotlin", yaml: "YAML", markdown: "Markdown", xml: "XML" };
const languages = ["plaintext", "javascript", "typescript", "json", "html", "css", "bash", "python", "sql", "java", "c", "cpp", "csharp", "go", "rust", "php", "ruby", "swift", "kotlin", "yaml", "markdown", "xml"];

export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  return <NodeViewWrapper className="note-code-block">
    <div contentEditable={false} className="note-code-controls flex items-center justify-between gap-2">
      <NoteSelect label="Code language" searchable disabled={!editor.isEditable} value={node.attrs.language || "plaintext"}
        options={[...(!languages.includes(node.attrs.language || "plaintext") ? [{ value: node.attrs.language as string, label: node.attrs.language as string }] : []),
          ...languages.map((language) => ({ value: language, label: languageLabels[language] ?? language }))]}
        onChange={(language) => updateAttributes({ language })} />
      <button type="button" className={control} aria-label="Copy code" title="Copy code" onClick={async () => {
        try { await navigator.clipboard.writeText(node.textContent); setCopied(true); copyTimer.current = setTimeout(() => setCopied(false), 1800); }
        catch { toast.error("Could not copy code"); }
      }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
    </div>
    <pre className="font-mono"><NodeViewContent as="code" /></pre>
  </NodeViewWrapper>;
}

export function NoteImageView({ node, selected, updateAttributes, editor }: NodeViewProps) {
  const [assetUrl, setAssetUrl] = useState<string | null | undefined>(undefined);
  const [broken, setBroken] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const dragCleanup = useRef<(() => void) | null>(null);
  const asset = node.attrs.asset as string | null;
  useEffect(() => {
    setAssetUrl(undefined); setBroken(false);
    if (!asset) return;
    const subscription = liveQuery(() => db.noteAssets.where("uid").equals(asset).first()).subscribe({
      next: (row) => { setAssetUrl(row?.dataUrl ?? null); setBroken(false); }, error: () => setAssetUrl(null),
    });
    return () => subscription.unsubscribe();
  }, [asset]);
  useEffect(() => () => dragCleanup.current?.(), []);
  const src = asset ? assetUrl : /^https:\/\//i.test(node.attrs.src || "") ? node.attrs.src as string : null;
  return <NodeViewWrapper className="note-image-wrap" data-align={node.attrs.align}>
    <div ref={frame} className={cn("note-image-frame", selected && "note-image-selected")} style={{ width: `${node.attrs.width}%` }}>
      {asset && assetUrl === undefined ? <Skeleton className="h-48 w-full rounded-xl" />
        : src && !broken ? <Image src={src} alt={node.attrs.alt || "Note image"} width={1600} height={900} unoptimized draggable={false} onError={() => setBroken(true)} />
          : <div className="rounded-xl bg-muted/60 p-6 text-sm text-muted-foreground">{broken ? "Could not load image" : "Image not on this device yet"}</div>}
      {selected && editor.isEditable && <>
        <div className="note-image-controls flex gap-1 rounded-xl border bg-popover p-1 shadow-xs" contentEditable={false}>
          <button type="button" className={cn(control, "cursor-grab")} data-drag-handle draggable aria-label="Move image" title="Drag to move image"><GripVertical className="size-4" /></button>
          {([{ value: "left", Icon: AlignLeft }, { value: "center", Icon: AlignCenter }, { value: "right", Icon: AlignRight }] as const).map(({ value, Icon }) =>
            <button key={value} type="button" className={cn(control, node.attrs.align === value && "bg-muted text-foreground")} aria-label={`Align image ${value}`} title={`Align image ${value}`} aria-pressed={node.attrs.align === value} onClick={() => updateAttributes({ align: value })}><Icon className="size-4" /></button>)}
        </div>
        <button type="button" contentEditable={false} className="note-image-resize" aria-label="Resize image" title="Drag to resize; arrow keys adjust width"
          onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); updateAttributes({ width: Math.max(10, Math.min(100, node.attrs.width + (event.key === "ArrowRight" ? 5 : -5))) }); } }}
          onPointerDown={(event) => {
            event.preventDefault(); dragCleanup.current?.();
            const element = frame.current;
            if (!element) return;
            const containerWidth = element.parentElement?.getBoundingClientRect().width || 1;
            const startX = event.clientX, startWidth = element.getBoundingClientRect().width;
            let width = Number(node.attrs.width) || 100;
            const move = (pointer: PointerEvent) => {
              const factor = node.attrs.align === "center" ? 2 : node.attrs.align === "right" ? -1 : 1;
              width = Math.max(10, Math.min(100, Math.round((startWidth + (pointer.clientX - startX) * factor) / containerWidth * 100)));
              element.style.width = `${width}%`;
            };
            const cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish); dragCleanup.current = null; };
            const finish = () => { cleanup(); if (!editor.isDestroyed) updateAttributes({ width }); };
            dragCleanup.current = cleanup;
            window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", finish);
          }} />
      </>}
    </div>
  </NodeViewWrapper>;
}

export function ToggleView({ node, updateAttributes, editor }: NodeViewProps) {
  const [readOnlyOpen, setReadOnlyOpen] = useState<boolean | null>(null);
  const open = editor.isEditable ? !!node.attrs.open : readOnlyOpen ?? !!node.attrs.open;
  return <NodeViewWrapper data-type="toggle" data-open={String(open)} className="note-toggle">
    <button type="button" contentEditable={false} className="note-toggle-chevron" aria-label={open ? "Collapse block" : "Expand block"}
      aria-expanded={open} onClick={() => { if (editor.isEditable) updateAttributes({ open: !open }); else setReadOnlyOpen(!open); }}>
      <ChevronRight className={cn("size-4", open && "rotate-90")} /></button>
    <NodeViewContent />
  </NodeViewWrapper>;
}
