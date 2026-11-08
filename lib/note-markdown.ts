/** Browser-only import: existing Markdown renderer -> existing Notes schema. */
import { generateJSON } from "@tiptap/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { noteExtensions } from "@/lib/note-extensions";
import type { JSONContent } from "@tiptap/core";
import { noteLinkTitle, parseNoteContent, type Note } from "@/lib/notes";

export function markdownToNoteContent(markdown: string): string {
  const html = renderToStaticMarkup(createElement(ReactMarkdown, { skipHtml: true }, markdown));
  return JSON.stringify(generateJSON(html, noteExtensions({ editable: false, headless: true })));
}

/** Portable text export keeps page references readable as [[Title]]. */
export function noteContentToMarkdown(content: string | undefined, notes: readonly Note[] = []): string {
  const parsed = parseNoteContent(content);
  if (typeof parsed === "string") return parsed;
  const render = (node: JSONContent): string => {
    const children = (node.content ?? []).map(render).join("");
    switch (node.type) {
      case "noteLink": return `[[${noteLinkTitle(node.attrs, notes)}]]`;
      case "text": return (node.marks ?? []).reduce((text, mark) => {
        if (mark.type === "bold") return `**${text}**`;
        if (mark.type === "italic") return `*${text}*`;
        if (mark.type === "strike") return `~~${text}~~`;
        if (mark.type === "code") return `\`${text}\``;
        if (mark.type === "link") return `[${text}](${mark.attrs?.href ?? ""})`;
        return text;
      }, node.text ?? "");
      case "hardBreak": return "  \n";
      case "heading": return `${"#".repeat(Math.max(1, Math.min(6, Number(node.attrs?.level) || 2)))} ${children}\n\n`;
      case "paragraph": return `${children}\n\n`;
      case "horizontalRule": return "---\n\n";
      case "codeBlock": return `\`\`\`${node.attrs?.language || ""}\n${children}\n\`\`\`\n\n`;
      case "blockquote": return `${children.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
      case "bulletList": case "orderedList": case "taskList": return `${(node.content ?? []).map((item, index) => {
        const prefix = node.type === "orderedList" ? `${Number(node.attrs?.start ?? 1) + index}. ` : node.type === "taskList" ? `- [${item.attrs?.checked ? "x" : " "}] ` : "- ";
        return prefix + render(item).trim().replace(/\n/g, "\n" + " ".repeat(prefix.length));
      }).join("\n")}\n\n`;
      case "noteImage": return `![${node.attrs?.alt || "Image"}](note-asset:${node.attrs?.asset || ""})\n\n`;
      case "mathInline": return `$${node.attrs?.latex || ""}$`;
      case "mathBlock": return `$$\n${node.attrs?.latex || ""}\n$$\n\n`;
      default: return children;
    }
  };
  return render(parsed).trim();
}
