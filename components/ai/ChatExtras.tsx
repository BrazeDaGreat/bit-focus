"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useNotes } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { isTrashed, noteHref, noteTitle, parseNoteContent, plainText } from "@/lib/notes";
import { descriptionText } from "@/lib/tasks";
import type { ChatAttachment, ChatSource } from "@/lib/ai-conversations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function SourceLinks({ sources }: { sources: ChatSource[] }) {
  if (!sources.length) return null;
  return <div className="mt-2 flex flex-wrap gap-1" aria-label="Sources">{sources.map((source, index) => <Link key={`${source.href}:${index}`} href={source.href} className="max-w-full truncate rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">{source.label}</Link>)}</div>;
}

export function ChatAttachments({ input, setInput, attachments, onChange }: {
  input: string; setInput: (input: string) => void; attachments: ChatAttachment[]; onChange: (attachments: ChatAttachment[]) => void;
}) {
  const notes = useNotes((state) => state.notes);
  const projects = useProjects((state) => state.projects);
  const tasks = useTasks((state) => state.tasks);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const trigger = input.match(/(?:^|\s)@([^@\n]*)$/);
  const mentionQuery = trigger?.[1] ?? null;
  const visible = open || (mentionQuery !== null && dismissed !== input);
  const term = (open ? query : mentionQuery ?? "").toLowerCase();
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
    if (!open && trigger) setInput(input.slice(0, input.lastIndexOf("@")));
    setOpen(false); setQuery(""); setDismissed(input);
  };
  useEffect(() => { setActive(0); }, [term]);
  useEffect(() => {
    if (!visible) return;
    const handle = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLTextAreaElement) || event.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); setDismissed(input); }
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
  return <div className="px-3 pt-2">
    <div className="flex flex-wrap gap-1">
      <button type="button" onClick={() => { setOpen(!open); setQuery(""); }} aria-expanded={visible} className="rounded-md border px-2 py-1 text-xs text-muted-foreground">@ Attach</button>
      {attachments.map((a) => <button key={a.key} title={`Remove ${a.label}`} aria-label={`Remove ${a.label}`} onClick={() => onChange(attachments.filter((item) => item.key !== a.key))} className="max-w-full truncate rounded-md bg-primary/10 px-2 py-1 text-xs">{a.label} ×</button>)}
    </div>
    {visible && <div ref={menu} className="mt-2 max-h-52 overflow-auto rounded-xl border p-2" aria-label="Attach a source">
      {open && <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a project, task, or note" aria-label="Find a source" className="mb-2 h-8" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />}
      <p className="px-2 py-1 text-[11px] text-muted-foreground">Selected content is sent to your AI provider with this message. Long sources are limited to 12,000 characters.</p>
      {error && <p role="alert" className="px-2 text-xs text-destructive">Couldn&apos;t load Notes. Close and reopen to retry.</p>}
      {!matches.length && <p className="p-2 text-xs text-muted-foreground">No matching sources.</p>}
      {matches.map((choice, index) => <button type="button" key={choice.key} data-index={index} onClick={() => choose(choice)} className={`block w-full truncate rounded-lg px-2 py-2 text-left text-xs hover:bg-muted ${active === index ? "bg-muted" : ""}`}>{choice.label}</button>)}
    </div>}
  </div>;
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
