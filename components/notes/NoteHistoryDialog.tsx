/**
 * Notes - Page History
 *
 * Lists the earlier versions of a page kept on this device, grouped by day,
 * with a read-only preview of the selected one. Restoring keeps the current
 * body as a version first, so a restore can itself be undone.
 *
 * @fileoverview Page history dialog for Notes pages.
 * @since v0.25.2
 */

"use client";

import { useEffect, useMemo, useState, type JSX } from "react";
import dynamic from "next/dynamic";
import { format, isToday, isYesterday } from "date-fns";
import { ArrowLeft, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import db from "@/lib/db";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes } from "@/hooks/useNotes";
import { listVersions } from "@/lib/note-history";
import { noteSearchText } from "@/lib/note-search";
import { noteContentJSON } from "@/lib/note-share";
import { assetUidsIn, noteTitle, parseNoteContent, type Note, type NoteVersion } from "@/lib/notes";
import { cn } from "@/lib/utils";

const SharedNoteBody = dynamic(() => import("@/components/share/SharedNoteBody"), {
  ssr: false,
  loading: () => <PreviewSkeleton />,
});

const BUTTON =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50";
const QUIET = cn(BUTTON, "text-muted-foreground hover:bg-muted/60 hover:text-foreground");
const PRIMARY = cn(BUTTON, "bg-primary text-primary-foreground hover:bg-primary/90");

const REASON: Record<NoteVersion["reason"], string> = {
  edit: "Before your edits",
  sync: "Before another device's changes",
  restore: "Before a restore",
};

function words(content: string): number {
  const text = noteSearchText(content).trim();
  return text ? text.split(/\s+/).length : 0;
}

function dayLabel(at: Date): string {
  if (isToday(at)) return "Today";
  if (isYesterday(at)) return "Yesterday";
  return format(at, "EEE, MMM d");
}

/** How a version compares with the page as it is now, in words. */
function wordDelta(then: number, now: number): string {
  const diff = then - now;
  if (diff === 0) return `${then.toLocaleString()} words`;
  return `${then.toLocaleString()} words · ${Math.abs(diff).toLocaleString()} ${diff > 0 ? "more" : "fewer"} than now`;
}

function PreviewSkeleton() {
  return (
    <div aria-label="Loading version" className="space-y-3">
      <Skeleton className="h-5 w-3/4 rounded-lg" />
      <Skeleton className="h-5 w-full rounded-lg" />
      <Skeleton className="h-5 w-2/3 rounded-lg" />
    </div>
  );
}

function VersionPreview({ version }: { version: NoteVersion }): JSX.Element {
  const content = useMemo(() => noteContentJSON(version.content), [version.content]);
  const [assets, setAssets] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let active = true;
    const parsed = parseNoteContent(version.content);
    const uids = typeof parsed === "string" ? [] : [...assetUidsIn(parsed)];
    void db.noteAssets.where("uid").anyOf(uids).toArray().then((rows) => {
      if (active) setAssets(Object.fromEntries(rows.map((row) => [row.uid, row.dataUrl])));
    }, () => { if (active) setAssets({}); });
    return () => { active = false; };
  }, [version.content]);

  if (!assets) return <PreviewSkeleton />;
  return (
    <SharedNoteBody
      key={version.id}
      content={content}
      assets={assets}
      outline={false}
      missingImageLabel="This image is no longer on this device"
    />
  );
}

export function NoteHistoryDialog({
  note,
  flush,
  onClose,
}: {
  note: Note;
  /** Saves typing still waiting on autosave, so it is kept before a restore. */
  flush?: () => Promise<void>;
  onClose: () => void;
}): JSX.Element {
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Phones show the list or the preview, not both.
  const [showPreview, setShowPreview] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const uid = note.uid ?? "";

  useEffect(() => {
    let active = true;
    const load = async () => {
      await flush?.().catch(() => {});
      const rows = uid ? await listVersions(uid) : [];
      if (!active) return;
      setVersions(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    };
    void load().catch(() => { if (active) setVersions([]); });
    return () => { active = false; };
  }, [uid, flush]);

  const currentWords = useMemo(() => words(note.content ?? ""), [note.content]);
  const counted = useMemo(
    () => (versions ?? []).map((version) => ({ version, words: words(version.content) })),
    [versions],
  );
  const groups = useMemo(() => {
    const out: { label: string; rows: typeof counted }[] = [];
    for (const row of counted) {
      const label = dayLabel(row.version.at);
      if (out.at(-1)?.label === label) out.at(-1)!.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [counted]);
  const selected = versions?.find((version) => version.id === selectedId) ?? null;

  const restore = async (version: NoteVersion) => {
    if (note.id == null || restoring) return;
    setRestoring(true);
    try {
      await flush?.();
      const before = useNotes.getState().notes.find((row) => row.id === note.id)?.content ?? "";
      await useNotes.getState().restoreVersion(note.id, version);
      toast.success(`Restored the version from ${format(version.at, "h:mm a")}`, {
        action: {
          label: "Undo",
          onClick: () => void useNotes.getState().restoreVersion(note.id!, { content: before })
            .catch(() => toast.error("Could not undo the restore. The earlier body is in Page history.")),
        },
      });
      onClose();
    } catch {
      toast.error("Could not restore this version. The page was not changed.");
    } finally {
      setRestoring(false);
    }
  };

  const list = (
    <div className={cn("min-h-0 overflow-y-auto sm:w-64 sm:shrink-0 sm:border-r sm:pr-2", showPreview && "hidden sm:block")}>
      {groups.map((group) => (
        <section key={group.label} className="mb-3">
          <h3 className="px-2 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{group.label}</h3>
          <ul className="space-y-0.5">
            {group.rows.map(({ version, words: count }) => (
              <li key={version.id}>
                <button
                  type="button"
                  aria-current={version.id === selectedId ? "true" : undefined}
                  onClick={() => { setSelectedId(version.id ?? null); setShowPreview(true); }}
                  className={cn(
                    "w-full rounded-lg px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary",
                    version.id === selectedId ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium tabular-nums">{format(version.at, "h:mm a")}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{REASON[version.reason]}</span>
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{wordDelta(count, currentWords)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => { if (!open && !restoring) onClose(); }}
      title={`History of “${noteTitle(note)}”`}
      description="Earlier versions kept on this device. Restoring one keeps the current page here too."
      dialogContentClassName="sm:max-w-4xl"
    >
      {versions === null ? (
        <div className="h-64 rounded-xl bg-muted/40 motion-safe:animate-pulse" aria-label="Loading page history" />
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 px-4 py-10 text-center">
          <History className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No earlier versions yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            A version is kept each time you come back to edit this page, before a large delete, and before another device&apos;s changes replace it.
          </p>
        </div>
      ) : (
        <div className="flex h-[min(65vh,36rem)] gap-4">
          {list}
          <div className={cn("flex min-w-0 flex-1 flex-col", !showPreview && "hidden sm:flex")}>
            {selected && (
              <>
                <div className="flex shrink-0 items-center gap-1 pb-2">
                  <button type="button" onClick={() => setShowPreview(false)} className={cn(QUIET, "px-2 sm:hidden")} aria-label="All versions">
                    <ArrowLeft className="size-4" />
                  </button>
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {format(selected.at, "EEE, MMM d · h:mm a")}
                    {selected.title !== note.title && <> · titled “{noteTitle(selected)}”</>}
                  </p>
                  <button type="button" disabled={restoring || note.id == null} onClick={() => void restore(selected)} className={PRIMARY}>
                    <RotateCcw className="size-4" />
                    {restoring ? "Restoring…" : "Restore"}
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-muted/30 px-4 py-3 sm:px-6">
                  <VersionPreview key={selected.id} version={selected} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
