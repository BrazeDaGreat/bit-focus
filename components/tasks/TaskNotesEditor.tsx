"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { liveQuery } from "dexie";
import { Bold, Italic, List, ListTodo, Link as LinkIcon, Paperclip, Check, X } from "lucide-react";
import { toast } from "sonner";
import db from "@/lib/db";
import type { Task } from "@/lib/tasks";
import type { TaskAttachmentsState } from "@/hooks/useAttachments";
import { cn } from "@/lib/utils";
import { createTaskNotesDraft } from "@/lib/task-notes-drafts";
import { TaskAttachments } from "./TaskAttachments";

/** Persistent HTML contains the UID only. Object URLs exist solely in the node view. */
const AttachmentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      attachment: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attachment"),
        renderHTML: (attributes) => attributes.attachment ? { "data-attachment": attributes.attachment } : {},
      },
      src: {
        default: null,
        parseHTML: (element) => {
          const src = element.getAttribute("src");
          return src && /^https?:\/\//i.test(src) ? src : null;
        },
        renderHTML: (attributes) => !attributes.attachment && /^https?:\/\//i.test(attributes.src ?? "") ? { src: attributes.src } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "img[data-attachment]" }, { tag: "img[src]", getAttrs: (element) => /^https?:\/\//i.test((element as HTMLElement).getAttribute("src") ?? "") ? null : false }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.className = "block my-2";
      const image = document.createElement("img");
      image.className = "max-w-full rounded-lg";
      image.alt = node.attrs.alt || "Task image";
      dom.append(image);
      let url: string | undefined;
      const revoke = () => { if (url) URL.revokeObjectURL(url); url = undefined; };
      const attachment = node.attrs.attachment as string | null;
      const subscription = attachment ? liveQuery(() => db.taskAttachments.where("uid").equals(attachment).first()).subscribe({
        next: (row) => {
          revoke();
          if (row) {
            url = URL.createObjectURL(row.blob);
            image.src = url;
            image.hidden = false;
            dom.title = row.name;
            dom.querySelector("small")?.remove();
          } else {
            image.removeAttribute("src");
            image.hidden = true;
            if (!dom.querySelector("small")) {
              const missing = document.createElement("small");
              missing.className = "text-muted-foreground";
              missing.textContent = "Image unavailable on this device";
              dom.append(missing);
            }
          }
        },
        error: () => { image.hidden = true; dom.title = "Could not load image"; },
      }) : undefined;
      if (!attachment && /^https?:\/\//i.test(node.attrs.src ?? "")) image.src = node.attrs.src;
      return { dom, destroy: () => { subscription?.unsubscribe(); revoke(); } };
    };
  },
});

/** Legacy descriptions are literal text, including angle brackets and newlines. */
export function taskNotesHTML(description: string) {
  if (description.trimStart().startsWith("<")) return description;
  const escaped = description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.split(/\r?\n/).map((line) => `<p>${line}</p>`).join("");
}

interface TaskNotesEditorProps {
  task: Task;
  files: TaskAttachmentsState;
  onSave: (description: string) => Promise<void>;
  readOnly?: boolean;
}

export function TaskNotesEditor(props: TaskNotesEditorProps) {
  // Enforce identity even for callers that do not key TaskDetails themselves.
  return <TaskNotesSession key={props.task.uid ? `uid:${props.task.uid}` : `id:${props.task.id}`} {...props} />;
}

function TaskNotesSession({ task, files, onSave, readOnly = false }: TaskNotesEditorProps) {
  const disabled = readOnly || !!task.deletedAt;
  const readOnlyRef = useRef(disabled);
  readOnlyRef.current = disabled;
  const mounted = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const [draft] = useState(() => createTaskNotesDraft({
    identity: task.uid ? `uid:${task.uid}` : `id:${task.id}`,
    uid: task.uid, content: task.description, readOnly: disabled,
    save: async (content) => {
      // The guard and update must share a transaction: restore/delete can reuse
      // local IDs while an old editor's save is still waiting in the queue.
      await db.transaction("rw", db.tasks, async () => {
        const current = task.id == null ? undefined : await db.tasks.get(task.id);
        if (!current || current.uid !== task.uid || current.deletedAt || readOnlyRef.current)
          throw new Error("Task is no longer editable");
        await saveRef.current(content);
      });
    },
    canSave: () => !readOnlyRef.current,
  }));
  const snapshot = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getServerSnapshot);
  const attachRef = useRef<(selected: File[]) => Promise<void>>(async () => {});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [dragging, setDragging] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Anything worth remembering" }), TaskList,
      TaskItem.configure({ nested: false }), Link.configure({ openOnClick: false }), AttachmentImage],
    content: taskNotesHTML(draft.getSnapshot().content),
    editorProps: {
      attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Task notes", class: "min-h-28 px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg [&_p]:my-1 [&_h1]:text-lg [&_h2]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-2 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:items-start [&_li[data-type=taskItem]]:gap-2 [&_li[data-type=taskItem]>label]:mt-1.5 [&_li[data-type=taskItem]>div]:min-w-0 [&_li[data-type=taskItem]>div]:flex-1 [&_input]:accent-primary [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]" },
      handlePaste: (_view, event) => {
        const selected = Array.from(event.clipboardData?.files ?? []);
        if (!selected.length || readOnlyRef.current) return false;
        event.preventDefault();
        void attachRef.current(selected);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
          event.preventDefault(); void draft.flush(); return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      draft.edit(editor.getHTML());
    },
    onBlur: () => { void draft.flush(); },
  });

  useEffect(() => {
    mounted.current = true;
    const hidden = () => { if (document.visibilityState === "hidden") void draft.flush(); };
    const pagehide = () => { void draft.flush(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", pagehide);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", pagehide);
      void draft.flush();
    };
  }, [draft]);
  useEffect(() => {
    editor?.setEditable(!disabled, false);
    draft.setReadOnly(disabled);
  }, [draft, editor, disabled]);
  useEffect(() => { if (editor) void draft.flush(); }, [draft, editor]);
  useEffect(() => {
    if (editor && !editor.isFocused) draft.refresh(task.description);
  }, [draft, editor, task.description]);
  useEffect(() => {
    if (editor && editor.getHTML() !== snapshot.content)
      editor.commands.setContent(taskNotesHTML(snapshot.content), false);
  }, [editor, snapshot.content]);

  const attach = async (selected: File[]) => {
    if (readOnlyRef.current || !mounted.current) return;
    try {
      const attachments = await files.add(selected);
      if (editor && !editor.isDestroyed && editor.isEditable && !readOnlyRef.current && mounted.current) {
        for (const attachment of attachments.filter((row) => row.type.startsWith("image/")))
          editor.chain().focus().insertContent({ type: "image", attrs: { attachment: attachment.uid, alt: attachment.name } }).run();
      }
    } catch { toast.error("Could not attach files"); }
  };
  attachRef.current = attach;
  const commands: { label: string; Icon: typeof Bold; active: boolean; run: (editor: Editor) => void }[] = [
    { label: "Bold", Icon: Bold, active: !!editor?.isActive("bold"), run: (editor) => { editor.chain().focus().toggleBold().run(); } },
    { label: "Italic", Icon: Italic, active: !!editor?.isActive("italic"), run: (editor) => { editor.chain().focus().toggleItalic().run(); } },
    { label: "Bullet list", Icon: List, active: !!editor?.isActive("bulletList"), run: (editor) => { editor.chain().focus().toggleBulletList().run(); } },
    { label: "Checklist", Icon: ListTodo, active: !!editor?.isActive("taskList"), run: (editor) => { editor.chain().focus().toggleTaskList().run(); } },
  ];
  const control = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <section aria-label="Task notes and attachments" className="space-y-2"
      onDragOver={(event) => { if (!disabled && event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDropCapture={(event) => {
        setDragging(false);
        if (disabled || !event.dataTransfer.files.length) return;
        event.preventDefault(); event.stopPropagation(); void attach(Array.from(event.dataTransfer.files));
      }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Notes</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span role="status" aria-live="polite" className={cn(snapshot.status === "error" && "text-destructive")}>
            {snapshot.status === "saved" ? (disabled ? "Read only" : "Saved")
              : disabled ? (snapshot.draftStored ? "Unsaved draft kept on this device" : "Unsaved changes in this editor")
                : snapshot.status === "error" ? (snapshot.draftStored ? "Could not save. Draft kept on this device." : "Could not save. Keep this editor open.")
                  : snapshot.status === "saving" ? "Saving…" : "Unsaved changes"}
          </span>
          {snapshot.status === "error" && !disabled && <button type="button" onClick={() => { void draft.flush(); }}
            className="rounded-lg px-2 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Retry save</button>}
        </div>
      </div>
      <div className={cn("rounded-xl bg-muted/40 p-1", dragging && "ring-2 ring-primary")}> 
        {!disabled && <div className="flex flex-wrap items-center gap-0.5">
          {commands.map(({ label, Icon, active, run }) => <button key={label} type="button" aria-label={label} aria-pressed={active} disabled={!editor}
            className={cn(control, active && "bg-background text-foreground shadow-xs")} onClick={() => editor && run(editor)}><Icon className="size-4" /></button>)}
          <button type="button" aria-label="Add or edit link" aria-pressed={!!editor?.isActive("link")} disabled={!editor} className={control}
            onClick={() => { setLinkUrl(editor?.getAttributes("link").href || ""); setLinkOpen(!linkOpen); }}><LinkIcon className="size-4" /></button>
          <button type="button" aria-label="Attach files" className={control} onClick={() => input.current?.click()}><Paperclip className="size-4" /></button>
        </div>}
        {linkOpen && !disabled && <form className="flex items-center gap-1 p-1" onSubmit={(event) => {
          event.preventDefault();
          if (linkUrl.trim() && !/^(https?:\/\/|mailto:)/i.test(linkUrl.trim())) { toast.error("Use an https, http or email link"); return; }
          const chain = editor?.chain().focus().extendMarkRange("link");
          if (linkUrl.trim()) chain?.setLink({ href: linkUrl.trim() }).run(); else chain?.unsetLink().run();
          setLinkOpen(false);
        }}>
          <input autoFocus aria-label="Link URL" placeholder="https://" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="submit" aria-label="Save link" className={control}><Check className="size-4" /></button>
          <button type="button" aria-label="Cancel link" onClick={() => setLinkOpen(false)} className={control}><X className="size-4" /></button>
        </form>}
        <EditorContent editor={editor} />
      </div>
      <input ref={input} type="file" multiple className="hidden" aria-label="Choose files for notes" disabled={disabled}
        onChange={(event) => { void attach(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <TaskAttachments files={files} disabled={disabled} onAttach={attach} />
    </section>
  );
}
