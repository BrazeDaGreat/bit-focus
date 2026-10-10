/** Images persist asset UIDs; external images must use HTTPS. */
import { Node, mergeAttributes } from "@tiptap/core";

export const NoteImage = Node.create({
  name: "noteImage", group: "block", atom: true, draggable: true,
  addAttributes() {
    return {
      asset: { default: null, parseHTML: (el) => el.getAttribute("data-asset"), renderHTML: (attrs) => attrs.asset ? { "data-asset": attrs.asset } : {} },
      src: { default: null, parseHTML: (el) => /^https:\/\//i.test(el.getAttribute("src") || "") ? el.getAttribute("src") : null,
        renderHTML: (attrs) => !attrs.asset && /^https:\/\//i.test(attrs.src || "") ? { src: attrs.src } : {} },
      alt: { default: "", parseHTML: (el) => el.getAttribute("alt") || "" },
      width: { default: 100, parseHTML: (el) => Math.max(10, Math.min(100, Number(el.getAttribute("data-width")) || 100)),
        renderHTML: (attrs) => ({ "data-width": attrs.width, style: `width: ${Math.max(10, Math.min(100, Number(attrs.width) || 100))}%` }) },
      align: { default: "center", parseHTML: (el) => el.getAttribute("data-align") || "center", renderHTML: (attrs) => ({ "data-align": attrs.align }) },
    };
  },
  parseHTML: () => [{ tag: "img[data-asset]" }, { tag: "img[src]", getAttrs: (el) => /^https:\/\//i.test((el as HTMLElement).getAttribute("src") || "") ? null : false }],
  renderHTML: ({ HTMLAttributes }) => ["img", mergeAttributes(HTMLAttributes, { "data-type": "note-image" })],
});
