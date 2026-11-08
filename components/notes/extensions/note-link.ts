/** Inline page references persist stable uids; titles are readable fallback snapshots. */
import { Node, mergeAttributes } from "@tiptap/core";

export const NoteLink = Node.create({
  name: "noteLink",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      uid: { default: null, parseHTML: (element) => element.getAttribute("data-uid"), renderHTML: ({ uid }) => ({ "data-uid": uid }) },
      title: { default: "", parseHTML: (element) => element.getAttribute("data-title") || element.textContent || "", renderHTML: ({ title }) => ({ "data-title": title }) },
    };
  },
  parseHTML() { return [{ tag: 'span[data-type="note-link"][data-uid]' }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "note-link" }), `[[${node.attrs.title || "Deleted page"}]]`];
  },
  renderText({ node }) { return node.attrs.title || "Deleted page"; },
});
