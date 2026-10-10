/** A UID-scoped editor serializes saves so late writes cannot erase newer keystrokes. */
"use client";

import { useCallback, useEffect, useMemo, useRef, type JSX, type MutableRefObject } from "react";
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { toast } from "sonner";
import { useNotes } from "@/hooks/useNotes";
import { addNoteAssets } from "@/lib/note-assets";
import { noteExtensions, validNoteLink } from "@/lib/note-extensions";
import { parseNoteContent, type Note } from "@/lib/notes";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeBlockView, NoteImageView, ToggleView } from "./editor/NodeViews";
import { MathBlockView, MathInlineView } from "./editor/MathBlockView";
import { EditorMenus } from "./editor/EditorMenus";
import { SlashMenu } from "./editor/SlashMenu";
import "./note-editor.css";

export interface NoteEditorProps {
  note: Note;
  readOnly?: boolean;
  editorRef?: MutableRefObject<Editor | null>;
  onStatusChange?: (status: "saved" | "saving" | "error") => void;
  onStats?: (stats: { words: number; characters: number }) => void;
}

export default function NoteEditor({ note, readOnly = false, editorRef, onStatusChange, onStats }: NoteEditorProps): JSX.Element {
  const callbacks = useRef({ onStatusChange, onStats });
  callbacks.current = { onStatusChange, onStats };
  const currentNote = useRef(note); currentNote.current = note;
  const input = useRef<HTMLInputElement>(null);
  // IndexedDB cannot finish reliably during unload; replay a tiny UID-scoped journal.
  const draftKey = `bitfocus.notes.bodyDraft.${note.uid}`;
  const recovered = useRef<string | null>((() => { try { return readOnly ? null : localStorage.getItem(draftKey); } catch { return null; } })());
  const pending = useRef<string | null>(recovered.current);
  const saved = useRef(note.content || "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const status = useRef<"saved" | "saving" | "error" | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const slashKey = useRef<((event: KeyboardEvent) => boolean) | null>(null);
  const openLink = useRef<(() => void) | null>(null);
  const attachRef = useRef<(files: File[], position?: number) => Promise<void>>(async () => {});
  const initialContent = useRef(parseNoteContent(recovered.current ?? note.content));
  const extensions = useMemo(() => noteExtensions({ editable: true }).map((extension) => {
    if (extension.name === "noteImage") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(NoteImageView) });
    if (extension.name === "codeBlock") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(CodeBlockView, { contentDOMElementTag: "span" }) });
    if (extension.name === "toggle") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(ToggleView) });
    if (extension.name === "mathBlock") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(MathBlockView) });
    if (extension.name === "mathInline") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(MathInlineView, { as: "span" }) });
    return extension;
  }), []);
  const reportStatus = useCallback((next: "saved" | "saving" | "error") => {
    if (status.current === next) return;
    status.current = next; callbacks.current.onStatusChange?.(next);
  }, []);
  const reportStats = useCallback((e: Editor) => {
    callbacks.current.onStats?.({ words: e.storage.characterCount.words(), characters: e.storage.characterCount.characters() });
  }, []);

  const flush = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) return inFlight.current;
    if (pending.current === null) return Promise.resolve();
    const save = async () => {
      while (pending.current !== null) {
        const content = pending.current;
        pending.current = null;
        if (content === saved.current) {
          try { if (localStorage.getItem(draftKey) === content) localStorage.removeItem(draftKey); } catch { /* Private mode. */ }
          continue;
        }
        reportStatus("saving");
        try {
          if (currentNote.current.id == null) throw new Error("Page is not stored yet");
          await useNotes.getState().saveContent(currentNote.current.id, content);
          saved.current = content;
          try { if (localStorage.getItem(draftKey) === content) localStorage.removeItem(draftKey); } catch { /* Private mode can reject storage. */ }
        } catch {
          pending.current ??= content;
          reportStatus("error");
          toast.error("Could not save this page. Your changes are still in the editor.");
          return;
        }
      }
      reportStatus("saved");
    };
    inFlight.current = save().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [draftKey, reportStatus]);

  const editor = useEditor({
    immediatelyRender: false, shouldRerenderOnTransaction: false, editable: !readOnly,
    extensions, content: initialContent.current,
    editorProps: {
      attributes: { class: "note-body min-h-80 outline-none", role: "textbox", "aria-label": "Page content", "aria-multiline": "true" },
      handleKeyDown: (_view, event) => {
        if (slashKey.current?.(event)) { event.preventDefault(); return true; }
        if ((event.ctrlKey || event.metaKey) && !event.altKey) {
          if (event.key.toLowerCase() === "s") { event.preventDefault(); void flush(); return true; }
          if (event.key.toLowerCase() === "k") { event.preventDefault(); openLink.current?.(); return true; }
        }
        return false;
      },
      handleClick: (_view, _pos, event) => {
        const link = (event.target as Element)?.closest("a");
        if (!link || !(event.metaKey || event.ctrlKey)) return false;
        const href = link.getAttribute("href");
        if (href && validNoteLink(href)) { event.preventDefault(); window.open(href, "_blank", "noopener,noreferrer"); return true; }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
        if (!files.length || readOnly) return false;
        event.preventDefault(); void attachRef.current(files); return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
        if (!files.length || readOnly) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void attachRef.current(files, position); return true;
      },
    },
    onCreate: ({ editor: e }) => { reportStatus("saved"); reportStats(e); },
    onUpdate: ({ editor: e }) => {
      pending.current = JSON.stringify(e.getJSON()); reportStatus("saving");
      try { localStorage.setItem(draftKey, pending.current); } catch { /* Autosave still works when storage is full. */ }
      if (!statsTimer.current) statsTimer.current = setTimeout(() => {
        statsTimer.current = null; if (!e.isDestroyed) reportStats(e);
      }, 150);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void flush(); }, 600);
    },
    onBlur: () => { void flush(); },
  });

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
    return () => { if (editorRef) editorRef.current = null; };
  }, [editor, editorRef]);
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);
  useEffect(() => { if (editor && recovered.current !== null) { recovered.current = null; void flush(); } }, [editor, flush]);
  useEffect(() => {
    if (!editor || note.content === saved.current || pending.current !== null || inFlight.current) return;
    if (editor.isFocused) {
      pending.current = JSON.stringify(editor.getJSON());
      reportStatus("saving");
      return;
    }
    saved.current = note.content || "";
    editor.commands.setContent(parseNoteContent(note.content), false);
    reportStats(editor);
  }, [editor, note.content, reportStats, reportStatus]);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === "hidden") void flush(); };
    const pagehide = () => { void flush(); };
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", pagehide);
    return () => {
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", pagehide);
      if (statsTimer.current) clearTimeout(statsTimer.current);
      statsTimer.current = null; void flush();
    };
  }, [flush]);

  attachRef.current = async (files, position) => {
    if (!editor || readOnly || !note.uid) return;
    let bookmark = editor.state.selection.getBookmark();
    let dropPosition = position;
    const mapInsertion = ({ transaction }: { transaction: Transaction }) => {
      bookmark = bookmark.map(transaction.mapping);
      if (dropPosition != null) dropPosition = transaction.mapping.map(dropPosition);
    };
    editor.on("transaction", mapInsertion);
    try {
      const assets = await addNoteAssets(note.uid, files);
      if (editor.isDestroyed || !editor.isEditable || !assets.length) return;
      editor.off("transaction", mapInsertion);
      const nodes = assets.map((asset) => ({ type: "noteImage", attrs: { asset: asset.uid, alt: asset.name } }));
      if (dropPosition != null) editor.chain().focus().insertContentAt(Math.min(dropPosition, editor.state.doc.content.size), nodes).run();
      else {
        try { editor.view.dispatch(editor.state.tr.setSelection(bookmark.resolve(editor.state.doc))); } catch { /* Keep the current selection if the insertion point was removed. */ }
        editor.chain().focus().insertContent(nodes).run();
      }
      void flush();
    } catch { toast.error("Could not add images"); }
    finally { editor.off("transaction", mapInsertion); }
  };
  return <div className="note-prose relative mx-auto w-full max-w-5xl pb-24">
    {!editor ? <div aria-label="Loading editor" className="space-y-3"><Skeleton className="h-5 w-3/4 rounded-lg" /><Skeleton className="h-5 w-full rounded-lg" /><Skeleton className="h-5 w-2/3 rounded-lg" /></div> : <>
      {!readOnly && <EditorMenus editor={editor} openLinkRef={openLink} />}
      <EditorContent editor={editor} />
      {!readOnly && <SlashMenu editor={editor} keyHandler={slashKey} onImage={() => input.current?.click()} />}
    </>}
    <input ref={input} className="hidden" type="file" accept="image/*" multiple aria-label="Choose images for this page" disabled={readOnly} onChange={(event) => {
      void attachRef.current(Array.from(event.target.files || [])); event.target.value = "";
    }} />
  </div>;
}
