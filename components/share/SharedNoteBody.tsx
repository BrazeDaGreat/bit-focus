/**
 * Shared Page - Read-Only Body
 *
 * The same schema and node views as the Notes editor, set to read-only, with
 * two swaps: images come from the snapshot instead of this device's database,
 * and page links are plain labels because the viewer has no pages to open.
 *
 * @fileoverview Read-only Tiptap renderer for shared Notes pages.
 * @since v0.25.2
 */

"use client";

import { useEffect, useMemo, useState, type JSX } from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type Editor, type NodeViewProps } from "@tiptap/react";
import Image from "next/image";
import { FileText } from "lucide-react";
import { noteExtensions } from "@/lib/note-extensions";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeBlockView, ToggleView } from "@/components/notes/editor/NodeViews";
import { MathBlockView, MathInlineView } from "@/components/notes/editor/MathBlockView";
import { NoteOutline } from "@/components/notes/NoteOutline";
import "@/components/notes/note-editor.css";

function imageView(assets: Record<string, string>) {
  return function SharedImageView({ node }: NodeViewProps) {
    const [broken, setBroken] = useState(false);
    const asset = node.attrs.asset as string | null;
    const src = asset ? assets[asset] : /^https:\/\//i.test(node.attrs.src || "") ? (node.attrs.src as string) : undefined;
    return (
      <NodeViewWrapper className="note-image-wrap" data-align={node.attrs.align}>
        <div className="note-image-frame" style={{ width: `${node.attrs.width}%` }}>
          {src && !broken ? (
            <Image src={src} alt={node.attrs.alt || "Image"} width={1600} height={900} unoptimized draggable={false} onError={() => setBroken(true)} />
          ) : (
            <div className="rounded-xl bg-muted/60 p-6 text-sm text-muted-foreground">
              {broken ? "Could not load image" : "Image not included in this link"}
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  };
}

function SharedLinkView({ node }: NodeViewProps) {
  const title = (node.attrs.title as string) || "Linked page";
  return (
    <NodeViewWrapper as="span" className="note-page-link-wrap">
      <span className="note-page-link" data-static title={`“${title}” is another page in the author's notes`}>
        <FileText className="size-3.5 shrink-0" aria-hidden />
        <span>{title}</span>
      </span>
    </NodeViewWrapper>
  );
}

export default function SharedNoteBody({
  content,
  assets,
  onReady,
}: {
  content: JSONContent;
  assets: Record<string, string>;
  onReady?: (editor: Editor) => void;
}): JSX.Element {
  const extensions = useMemo(() => {
    const ImageView = imageView(assets);
    return noteExtensions({ editable: false }).map((extension) => {
      if (extension.name === "noteImage") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(ImageView) });
      if (extension.name === "noteLink") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(SharedLinkView, { as: "span" }) });
      if (extension.name === "codeBlock") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(CodeBlockView, { contentDOMElementTag: "span" }) });
      if (extension.name === "toggle") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(ToggleView) });
      if (extension.name === "mathBlock") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(MathBlockView) });
      if (extension.name === "mathInline") return extension.extend({ addNodeView: () => ReactNodeViewRenderer(MathInlineView, { as: "span" }) });
      return extension;
    });
  }, [assets]);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: false,
    extensions,
    content,
    editorProps: { attributes: { class: "note-body outline-none", "aria-label": "Page content" } },
  }, [extensions, content]);

  useEffect(() => { if (editor) onReady?.(editor); }, [editor, onReady]);

  return (
    <div className="note-prose relative w-full">
      {!editor ? (
        <div aria-label="Loading page" className="space-y-3">
          <Skeleton className="h-5 w-3/4 rounded-lg" />
          <Skeleton className="h-5 w-full rounded-lg" />
          <Skeleton className="h-5 w-2/3 rounded-lg" />
        </div>
      ) : (
        <>
          <EditorContent editor={editor} />
          <NoteOutline editor={editor} />
        </>
      )}
    </div>
  );
}
