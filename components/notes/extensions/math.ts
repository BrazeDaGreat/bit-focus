/**
 * Display maths. The LaTeX source is the only thing stored; rendering happens
 * in the node view (KaTeX, bundled, so it works offline) and in PDF export.
 */
import { InputRule, Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathBlock: { insertMathBlock: (latex?: string) => ReturnType };
    mathInline: { insertMathInline: (latex?: string) => ReturnType };
  }
}

/**
 * Set when an equation is inserted by the person, so the next empty equation
 * view to mount opens its source. Empty equations loaded from storage stay shut.
 */
export const mathOpenRequest = { pending: false };

export const MathBlock = Node.create({
  name: "mathBlock", group: "block", atom: true, draggable: true, selectable: true,
  addAttributes: () => ({ latex: {
    default: "", parseHTML: (el) => el.getAttribute("data-latex") || el.textContent || "",
    renderHTML: (attrs) => ({ "data-latex": attrs.latex }),
  } }),
  parseHTML: () => [{ tag: 'div[data-type="math-block"]' }],
  renderHTML: ({ node, HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "math-block" }), node.attrs.latex || ""],
  addCommands() {
    return { insertMathBlock: (latex = "") => ({ commands }) => {
      mathOpenRequest.pending = !latex;
      return commands.insertContent({ type: this.name, attrs: { latex } });
    } };
  },
  // "$$ " at the start of a line opens an empty equation.
  addInputRules() {
    return [new InputRule({ find: /^\$\$\s$/, handler: ({ range, chain }) => {
      chain().deleteRange(range).insertMathBlock().run();
    } })];
  },
});

/**
 * Inline maths that flows with the sentence. `$x^2$` typed in text becomes one;
 * so does a selection turned into an equation with Ctrl/⌘ Shift M.
 */
export const MathInline = Node.create({
  name: "mathInline", group: "inline", inline: true, atom: true, selectable: true,
  addAttributes: () => ({ latex: {
    default: "", parseHTML: (el) => el.getAttribute("data-latex") || el.textContent || "",
    renderHTML: (attrs) => ({ "data-latex": attrs.latex }),
  } }),
  parseHTML: () => [{ tag: 'span[data-type="math-inline"]' }],
  renderHTML: ({ node, HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { "data-type": "math-inline" }), node.attrs.latex || ""],
  renderText: ({ node }) => `$${node.attrs.latex}$`,
  addCommands() {
    return { insertMathInline: (latex) => ({ state, commands }) => {
      // With no source given, selected text becomes the equation's source.
      const { from, to, empty } = state.selection;
      const source = latex ?? (empty ? "" : state.doc.textBetween(from, to, " "));
      mathOpenRequest.pending = !source;
      return commands.insertContent({ type: this.name, attrs: { latex: source } });
    } };
  },
  addKeyboardShortcuts() {
    return { "Mod-Shift-m": () => this.editor.commands.insertMathInline() };
  },
  // `$…$` closes into an equation. `$$` stays display maths, and a space after
  // the opening `$` keeps prices like "$5 and $10" as plain text.
  addInputRules() {
    return [new InputRule({ find: /(?:^|[^$\\])(\$([^\s$](?:[^$]*[^\s$])?)\$)$/, handler: ({ state, range, match }) => {
      const whole = match[1], latex = match[2];
      if (!whole || !latex) return null;
      const start = range.from + match[0].length - whole.length;
      state.tr.replaceWith(start, range.to, this.type.create({ latex }));
    } })];
  },
});
