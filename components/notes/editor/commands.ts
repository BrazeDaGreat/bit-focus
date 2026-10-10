/** Shared block actions keep slash commands and contextual controls consistent. */
import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

export function insertColumns(editor: Editor, count: number) {
  return editor.chain().focus().insertContent({ type: "columns", content: Array.from({ length: count }, () => ({ type: "column", content: [{ type: "paragraph" }] })) }).run();
}

export function insertBlock(editor: Editor, type: "callout" | "toggle") {
  const content: JSONContent[] = type === "toggle" ? [{ type: "toggleSummary", content: [{ type: "text", text: "Toggle" }] }, { type: "paragraph" }] : [{ type: "paragraph" }];
  return editor.chain().focus().insertContent({ type, content }).run();
}

export function columnContext(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "columns") return { node: $from.node(depth), pos: $from.before(depth), index: $from.index(depth) };
  }
  return null;
}

export function changeColumns(editor: Editor, action: "add" | "remove" | "unwrap") {
  const context = columnContext(editor);
  if (!context) return;
  const { node, pos, index } = context;
  const children = Array.from({ length: node.childCount }, (_, i) => node.child(i));
  const tr = editor.state.tr;
  if (action === "unwrap" || (action === "remove" && node.childCount === 2)) {
    const content = children.flatMap((column) => Array.from({ length: column.childCount }, (_, i) => column.child(i)));
    tr.replaceWith(pos, pos + node.nodeSize, Fragment.fromArray(content));
  } else {
    if (action === "add" && node.childCount < 4) children.splice(index + 1, 0, editor.schema.nodes.column.createAndFill()!);
    else if (action === "remove") {
      // Preserve text by moving the removed column into its nearest neighbour.
      const removed = children.splice(index, 1)[0];
      const target = Math.max(0, index - 1);
      children[target] = children[target].copy(children[target].content.append(removed.content));
    } else return;
    tr.replaceWith(pos, pos + node.nodeSize, node.copy(Fragment.fromArray(children)));
  }
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))));
  editor.view.dispatch(tr); editor.commands.focus();
}
