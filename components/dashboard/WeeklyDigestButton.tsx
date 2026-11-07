"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/components/OfflineIndicator";
import { useAIChat } from "@/hooks/useAIChat";
import { useConfig } from "@/hooks/useConfig";
import { useFocus } from "@/hooks/useFocus";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { useTimeblocks } from "@/hooks/useTimeblocks";
import { DEFAULT_BASE_URL, DEFAULT_MODEL_ID, isLocalEndpoint } from "@/lib/ai-models";
import { buildWeeklyDigest } from "@/lib/ai-digest";
import { isTrashed, noteHref } from "@/lib/notes";

interface DigestDraft {
  title: string;
  markdown: string;
  noteUid?: string;
}

const DRAFT_KEY = "bitfocus.ai.weeklyReviewDraft";
const RECOVERY_TOAST_ID = "weekly-review-save-error";
// Survives component unmounts even when browser storage is unavailable.
let memoryDraft: DigestDraft | null | undefined;

function readDraft(): DigestDraft | null {
  if (memoryDraft !== undefined) return memoryDraft;
  memoryDraft = null;
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Partial<DigestDraft> | null;
    if (value && typeof value.title === "string" && typeof value.markdown === "string" && value.markdown.trim()) {
      memoryDraft = { title: value.title, markdown: value.markdown, ...(typeof value.noteUid === "string" && { noteUid: value.noteUid }) };
    }
  } catch { /* Storage can be unavailable; keep the in-memory copy. */ }
  return memoryDraft;
}

function retainDraft(draft: DigestDraft | null) {
  memoryDraft = draft;
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* The copy/download actions still hold the full generated text. */ }
}

function downloadDraft(draft: DigestDraft) {
  const url = URL.createObjectURL(new Blob([`# ${draft.title}\n\n${draft.markdown}`], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${draft.title.replace(/[^a-z\d -]/gi, "").trim()}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function offerRecovery(draft: DigestDraft) {
  toast.error("Your review is ready, but couldn't be saved to Notes.", {
    id: RECOVERY_TOAST_ID,
    description: "Copy or download it now, or use Save review to retry. Your generated text is kept on this device.",
    duration: Infinity,
    action: {
      label: "Copy",
      onClick: (event) => {
        event.preventDefault();
        void Promise.resolve().then(() => navigator.clipboard.writeText(`# ${draft.title}\n\n${draft.markdown}`)).then(() => {
          toast.dismiss(RECOVERY_TOAST_ID);
          toast.success("Review copied. You can still retry saving it.");
        }).catch(() => toast.error("Couldn't copy. Use Download to keep your review."));
      },
    },
    cancel: { label: "Download", onClick: (event) => { event.preventDefault(); downloadDraft(draft); } },
  });
}

/** Compact panel-header action; owns its data loading and recovery. */
export default function WeeklyDigestButton() {
  const router = useRouter();
  const enabled = useConfig((state) => state.featureToggles.aiChat);
  const aiConfig = useAIChat((state) => state.aiConfig);
  const online = useOnline();
  const [phase, setPhase] = useState<"generating" | "saving" | null>(null);
  const [draft, setDraft] = useState<DigestDraft | null>(null);
  const busy = useRef(false);

  useEffect(() => { setDraft(readDraft()); }, []);
  useEffect(() => {
    if (enabled && !aiConfig) {
      void useAIChat.getState().loadAIConfig().catch(() => {
        toast.error("Couldn't load AI settings. Open AI Chat to check your provider.");
      });
    }
  }, [enabled, aiConfig]);

  // Same endpoint/key fallbacks and keyless-local configuration as AI Chat.
  const baseUrl = aiConfig?.baseUrl || DEFAULT_BASE_URL;
  const apiKey = aiConfig?.apiKey || aiConfig?.groqApiKey || aiConfig?.googleApiKey || "";
  const modelId = aiConfig?.defaultModelId || DEFAULT_MODEL_ID;
  const configured = Boolean(aiConfig && modelId.trim() && baseUrl.trim() && (apiKey.trim() || isLocalEndpoint(baseUrl)));
  const offline = !online && typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);

  async function saveReview(pending: DigestDraft) {
    setPhase("saving");
    // Load the Markdown/schema converter only when there is a review to save.
    const { markdownToNoteContent } = await import("@/lib/note-markdown");
    const content = markdownToNoteContent(pending.markdown);
    await useNotes.getState().loadNotes();
    let note = pending.noteUid ? useNotes.getState().getByUid(pending.noteUid) : undefined;
    if (!note || isTrashed(note)) {
      note = await useNotes.getState().createNote({ title: pending.title, icon: "Sparkles" });
      // Retry a failed content write on the same page, without making duplicates.
      pending = { ...pending, noteUid: note.uid };
      retainDraft(pending);
      setDraft(pending);
    }
    if (note.id == null) throw new Error("Note was not created");
    await useNotes.getState().saveContent(note.id, content);
    retainDraft(null);
    setDraft(null);
    toast.dismiss(RECOVERY_TOAST_ID);
    const href = noteHref(note);
    toast.success("Weekly review saved to Notes", {
      action: { label: "Open", onClick: () => router.push(href) },
      duration: 10_000,
    });
  }

  async function summariseWeek() {
    if (busy.current) return;
    // A retained review can be saved without another network request, even offline.
    let pending = readDraft();
    if (!pending && offline) {
      toast("You're offline. Reconnect to summarise your week.");
      return;
    }
    busy.current = true;
    setPhase(pending ? "saving" : "generating");
    try {
      if (!pending) {
        await Promise.all([
          useFocus.getState().loadFocusSessions(),
          useTasks.getState().loadTasks(),
          useNotes.getState().loadNotes(),
          useTimeblocks.getState().loadTimeblocks(),
        ]);
        if (useTasks.getState().error) throw new Error("Couldn't read tasks");
        const summary = buildWeeklyDigest({
          now: new Date(), name: useConfig.getState().name,
          focusSessions: useFocus.getState().focusSessions,
          tasks: useTasks.getState().tasks,
          notes: useNotes.getState().notes,
          timeblocks: useTimeblocks.getState().timeblocks,
        });
        const response = await fetch("/api/digest", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl, apiKey, modelId, context: summary.context }),
        });
        const data: unknown = await response.json();
        if (!response.ok || !data || typeof data !== "object" || !("markdown" in data) ||
            typeof data.markdown !== "string" || !data.markdown.trim()) {
          throw new Error("Couldn't generate review");
        }
        pending = { title: summary.title, markdown: data.markdown };
        // Journal before conversion or note creation: neither failure loses the result.
        retainDraft(pending);
        setDraft(pending);
      }
      await saveReview(pending);
    } catch {
      const retained = readDraft() ?? pending;
      if (retained) offerRecovery(retained);
      else toast.error("Couldn't summarise your week. Check your connection and AI settings, then try again.");
    } finally {
      busy.current = false;
      setPhase(null);
    }
  }

  if (!enabled || !configured) return null;

  const label = phase === "generating" ? "Summarising…" : phase === "saving" ? "Saving…" : draft ? "Save review" : "Summarise week";
  return (
    <Button
      type="button" variant="ghost" size="sm"
      className="size-8 rounded-lg px-0 text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground sm:w-auto sm:px-2.5"
      onClick={() => void summariseWeek()}
      disabled={phase !== null || (offline && !draft)}
      aria-label={label} aria-busy={phase !== null}
      title={offline && !draft ? "Reconnect to summarise your week" : draft ? "Save your generated review to Notes" : "Create an AI weekly review in Notes"}
    >
      {phase ? <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
