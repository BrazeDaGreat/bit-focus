/** Browser-only import: existing Markdown renderer -> existing Notes schema. */
import { generateJSON } from "@tiptap/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { noteExtensions } from "@/lib/note-extensions";

export function markdownToNoteContent(markdown: string): string {
  const html = renderToStaticMarkup(createElement(ReactMarkdown, { skipHtml: true }, markdown));
  return JSON.stringify(generateJSON(html, noteExtensions({ editable: false, headless: true })));
}
