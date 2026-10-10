/** Pure schema: React node views are attached only by NoteEditor, never by export. */
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import Table, { TableView } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import { Callout, Column, Columns, Toggle, ToggleSummary } from "@/components/notes/extensions/blocks";
import { NoteImage } from "@/components/notes/extensions/note-image";
import { MathBlock, MathInline } from "@/components/notes/extensions/math";

const lowlight = createLowlight(common);
function printCode(text: string, language: string): DOMOutputSpec[] {
  if (!language || language === "plaintext" || !lowlight.registered(language)) return [text];
  const tree = lowlight.highlight(language, text);
  const convert = (child: (typeof tree.children)[number]): DOMOutputSpec => {
    if (child.type === "text") return child.value;
    if (child.type === "element") return [child.tagName, { class: Array.isArray(child.properties.className) ? child.properties.className.join(" ") : "" }, ...child.children.map(convert)];
    return "";
  };
  return tree.children.map(convert);
}
export function validNoteLink(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url.trim());
}

export function noteExtensions(options: { editable: boolean; placeholder?: string; headless?: boolean }) {
  return [
    StarterKit.configure({ codeBlock: false, dropcursor: { color: "var(--primary)" } }),
    Underline, Highlight.configure({ multicolor: false }),
    Link.configure({ autolink: true, openOnClick: false, protocols: ["http", "https", "mailto"],
      validate: validNoteLink, isAllowedUri: validNoteLink }),
    TextAlign.configure({ types: ["heading", "paragraph"] }), Subscript, Superscript,
    // Smart quotes and dashes stay; rules that rewrite characters LaTeX relies on
    // (x^2 to x², 1/2 to ½, 2x3 to 2×3, != to ≠) would corrupt typed equations.
    Typography.configure({ superscriptTwo: false, superscriptThree: false, oneHalf: false, oneQuarter: false,
      threeQuarters: false, multiplication: false, notEqual: false }),
    ...(!options.headless ? [Placeholder.configure({
      placeholder: ({ editor, node }) => editor.isEmpty ? (options.placeholder || "Start writing, or type '/' for commands")
        : node.type.name === "paragraph" ? "Type '/' for commands" : "",
      showOnlyCurrent: true, includeChildren: true, showOnlyWhenEditable: true,
    })] : []),
    TaskList, TaskItem.configure({ nested: true }), CharacterCount,
    Table.extend({
      addNodeView() { return ({ node }) => new TableView(node, this.options.cellMinWidth); },
    }).configure({ resizable: options.editable && !options.headless, lastColumnResizable: true, cellMinWidth: 90 }), TableRow, TableHeader, TableCell,
    CodeBlockLowlight.extend({
      addKeyboardShortcuts() {
        return { ...this.parent?.(), Tab: () => this.editor.isActive("codeBlock") ? this.editor.commands.insertContent("  ") : false };
      },
      renderHTML({ node, HTMLAttributes }) {
        const language = node.attrs.language || "plaintext";
        if (options.headless) return ["pre", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ["code", { class: `language-${language}` }, ...printCode(node.textContent, language)]];
        return ["pre", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ["code", { class: `language-${language}` }, 0]];
      },
    }).configure({ lowlight, defaultLanguage: "plaintext" }),
    NoteImage, Columns, Column, Callout, Toggle, ToggleSummary, MathBlock, MathInline,
  ];
}
