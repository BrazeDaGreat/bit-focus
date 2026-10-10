/** Structural blocks share a DOM schema with the editor and offline print export. */
import { Node, mergeAttributes } from "@tiptap/core";

export const Column = Node.create({
  name: "column", content: "block+", isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="column"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "column" }), 0],
});

export const Columns = Node.create({
  name: "columns", group: "block", content: "column{2,4}", isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
  renderHTML: ({ node, HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, {
    "data-type": "columns", style: `--note-columns: ${node.childCount}`,
  }), 0],
  addKeyboardShortcuts() {
    return { Backspace: () => {
      const { $from, empty } = this.editor.state.selection;
      if (!empty || $from.parentOffset !== 0 || $from.parent.content.size) return false;
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === "column") return $from.index(depth) === 0;
      }
      return false;
    } };
  },
});

export const Callout = Node.create({
  name: "callout", group: "block", content: "block+", defining: true,
  addAttributes: () => ({ variant: {
    default: "note", parseHTML: (el) => el.getAttribute("data-variant") || "note",
    renderHTML: (attrs) => ({ "data-variant": attrs.variant }),
  } }),
  parseHTML: () => [{ tag: 'aside[data-type="callout"]' }],
  renderHTML: ({ HTMLAttributes }) => ["aside", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0],
});

export const ToggleSummary = Node.create({
  name: "toggleSummary", content: "inline*", defining: true,
  parseHTML: () => [{ tag: 'div[data-type="toggle-summary"]' }, { tag: "summary" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "toggle-summary" }), 0],
});

export const Toggle = Node.create({
  name: "toggle", group: "block", content: "toggleSummary block+", defining: true, isolating: true,
  addAttributes: () => ({ open: {
    default: true, parseHTML: (el) => el.getAttribute("data-open") !== "false",
    renderHTML: (attrs) => ({ "data-open": String(attrs.open) }),
  } }),
  parseHTML: () => [{ tag: 'div[data-type="toggle"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "toggle" }), 0],
});
