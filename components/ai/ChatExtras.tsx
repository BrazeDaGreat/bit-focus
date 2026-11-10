"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useNotes } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { isTrashed, noteHref, noteTitle, parseNoteContent, plainText } from "@/lib/notes";
import { descriptionText } from "@/lib/tasks";
import type { ChatAttachment, ChatSource } from "@/lib/ai-conversations";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function SourceLinks({ sources }: { sources: ChatSource[] }) {
  if (!sources.length) return null;
  return <div className="mt-2 flex flex-wrap gap-1" aria-label="Sources">{sources.map((source, index) => <Link key={`${source.href}:${index}`} href={source.href} className="max-w-full truncate rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">{source.label}</Link>)}</div>;
}

export function ChatAttachments({ input, setInput, attachments, onChange, children }: {
  children: ReactNode;
  input: string; setInput: (input: string) => void; attachments: ChatAttachment[]; onChange: (attachments: ChatAttachment[]) => void;
}) {
  const notes = useNotes((state) => state.notes);
  const projects = useProjects((state) => state.projects);
  const tasks = useTasks((state) => state.tasks);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // A dismissal only applies until the composer changes, even if a later @
  // produces exactly the same text as the previous mention.
  useEffect(() => { setDismissed(null); }, [input]);
  const trigger = input.match(/(?:^|\s)@([^@\n]*)$/);
  const mentionQuery = trigger?.[1] ?? null;
  const visible = mentionQuery !== null && dismissed !== input;
  const term = (mentionQuery ?? "").toLowerCase();
  const anchor = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!visible) return;
    setError(false);
    void useNotes.getState().loadNotes().catch(() => setError(true));
  }, [visible]);
  const choices = useMemo<ChatAttachment[]>(() => [
    ...projects.filter((p) => p.id != null).map((p) => ({ key: `project:${p.id}`, label: `Project: ${p.title}`, href: `/projects?project=${p.id}`, content: JSON.stringify({ title: p.title, status: p.status, notes: p.notes, tasks: tasks.filter((t) => t.projectId === p.id && !t.deletedAt).map((t) => ({ title: t.title, description: descriptionText(t.description), due: t.dueDate, completed: !!t.completedAt, estimateMinutes: t.estimateMinutes })) }) })),
    ...tasks.filter((t) => !t.deletedAt && t.uid).map((t) => ({ key: `task:${t.uid}`, label: `Task: ${t.title}`, href: `/projects?task=${encodeURIComponent(t.uid!)}`, content: JSON.stringify({ title: t.title, description: descriptionText(t.description), due: t.dueDate, completed: !!t.completedAt, estimateMinutes: t.estimateMinutes, tags: t.tags }) })),
    ...notes.filter((n) => n.uid && !isTrashed(n) && !n.isTemplate).map((n) => {
      const parsed = parseNoteContent(n.content);
      return { key: `note:${n.uid}`, label: `Note: ${noteTitle(n)}`, href: noteHref(n), content: typeof parsed === "string" ? parsed.replace(/<[^>]*>/g, " ") : plainText(parsed, notes) };
    }),
  ].map((a) => ({ ...a, content: a.content.length > 12000 ? a.content.slice(0, 11970) + "\n[Content truncated]" : a.content })), [notes, projects, tasks]);
  const matches = choices.filter((a) => !attachments.some((selected) => selected.key === a.key) && a.label.toLowerCase().includes(term)).slice(0, 30);
  const choose = (choice: ChatAttachment) => {
    if (attachments.length >= 10) { toast.error("Attach up to 10 sources per message"); return; }
    onChange([...attachments, choice]);
    if (trigger) setInput(input.slice(0, input.lastIndexOf("@")));
    setDismissed(null);
    anchor.current?.querySelector("textarea")?.focus();
  };
  useEffect(() => { setActive(0); }, [term]);
  useEffect(() => {
    if (!visible) return;
    const handle = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLTextAreaElement) || !anchor.current?.contains(event.target) || event.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDismissed(input); return; }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        setActive((previous) => Math.max(0, Math.min(matches.length - 1, previous + (event.key === "ArrowDown" ? 1 : -1))));
      }
      if ((event.key === "Enter" && !event.shiftKey || event.key === "Tab") && matches[active]) {
        event.preventDefault(); event.stopPropagation(); choose(matches[active]);
      }
    };
    document.addEventListener("keydown", handle, true);
    return () => document.removeEventListener("keydown", handle, true);
  });
  useEffect(() => { menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);
  return (
    <Popover open={visible} onOpenChange={(next) => { if (!next) setDismissed(input); }}>
      <PopoverAnchor asChild>
        <div ref={anchor}>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-3" aria-label="Attached sources">
              {attachments.map((attachment) => (
                <button
                  key={attachment.key}
                  type="button"
                  title={`Click to remove ${attachment.label}`}
                  aria-label={`Remove ${attachment.label}`}
                  onClick={() => onChange(attachments.filter((item) => item.key !== attachment.key))}
                  className="inline-flex max-w-full cursor-pointer items-center rounded-lg bg-primary/10 px-2 py-1 text-xs transition-colors hover:bg-destructive/15 hover:text-destructive hover:line-through focus-visible:bg-destructive/15 focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate">{attachment.label}</span>
                </button>
              ))}
            </div>
          )}
          {children}
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] rounded-xl p-1.5 shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (event.target instanceof Node && anchor.current?.contains(event.target)) event.preventDefault();
        }}
        aria-label="Attach a source"
      >
        <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">Attach a project, task, or note</p>
        <div ref={menu} className="max-h-52 overflow-y-auto overscroll-contain">
          {error && <p role="alert" className="px-2.5 py-2 text-xs text-destructive">Couldn&apos;t load Notes. Type @ again to retry.</p>}
          {!matches.length && <p className="px-2.5 py-3 text-xs text-muted-foreground">No matching sources.</p>}
          {matches.map((choice, index) => (
            <button
              type="button"
              key={choice.key}
              data-index={index}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(choice)}
              className={`block w-full truncate rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === index ? "bg-muted" : ""}`}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="px-2.5 pb-1 pt-2 text-[11px] text-muted-foreground">Selected content is shared with your AI provider. Up to 12,000 characters per source.</p>
      </PopoverContent>
    </Popover>
  );
}

export function SaveAnswerDialog({ text, title, onClose }: { text: string | null; title: string; onClose: () => void }) {
  const notes = useNotes((state) => state.notes);
  const [target, setTarget] = useState("");
  const [noteName, setNoteName] = useState(title);
  const [busy, setBusy] = useState(false);
  const createdUid = useRef<string | null>(null);
  useEffect(() => {
    if (text === null) return;
    setTarget(""); setNoteName(title); createdUid.current = null;
    void useNotes.getState().loadNotes().catch(() => toast.error("Couldn't load Notes"));
  }, [text, title]);
  const save = async () => {
    if (!text || busy) return;
    setBusy(true);
    try {
      const { markdownToNoteContent } = await import("@/lib/note-markdown");
      const content = markdownToNoteContent(text);
      await useNotes.getState().loadNotes();
      const store = useNotes.getState();
      let note = target ? store.notes.find((n) => n.uid === target && !isTrashed(n)) : createdUid.current ? store.getByUid(createdUid.current) : undefined;
      if (target && !note) throw new Error("The selected page is no longer available");
      if (!note) { note = await store.createNote({ title: noteName.trim() || "AI Chat answer", icon: "Sparkles" }); createdUid.current = note.uid!; }
      if (note.id == null) throw new Error("Page could not be saved");
      if (target) {
        // Use the current body, preserving rich content and embedded assets.
        const { generateJSON } = await import("@tiptap/core");
        const { noteExtensions } = await import("@/lib/note-extensions");
        const current = parseNoteContent(note.content);
        const previous = typeof current === "string" ? generateJSON(current, noteExtensions({ editable: false, headless: true })) : current;
        const addition = JSON.parse(content);
        await store.saveContent(note.id, JSON.stringify({ type: "doc", content: [...(previous.content ?? []), { type: "horizontalRule" }, ...addition.content] }));
      } else await store.saveContent(note.id, content);
      toast.success("Answer saved to Notes", { action: { label: "Open", onClick: () => { window.location.href = noteHref(note); } } });
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save answer. Try again."); }
    finally { setBusy(false); }
  };
  return <Dialog open={text !== null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Save answer to Notes</DialogTitle><DialogDescription>Create a page or append this answer to an existing page.</DialogDescription></DialogHeader>
    <label className="text-sm">Destination<select value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)} className="mt-2 block w-full rounded-md border bg-background p-2 text-sm"><option value="">New page</option>{notes.filter((n) => n.uid && !isTrashed(n) && !n.isTemplate).map((n) => <option key={n.uid} value={n.uid}>{noteTitle(n)}</option>)}</select></label>
    {!target && <label className="text-sm">Page title<Input value={noteName} disabled={busy} onChange={(e) => setNoteName(e.target.value)} className="mt-2" /></label>}
    <Button disabled={busy} onClick={save}>{busy ? "Saving…" : target ? "Append answer" : "Create page"}</Button>
  </DialogContent></Dialog>;
}
