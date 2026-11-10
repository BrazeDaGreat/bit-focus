/**
 * Shared Page - Viewer
 *
 * What someone sees when they open a share link: a calm reading page with the
 * page's own icon and title, a few reader actions (copy the link, save as PDF
 * or Markdown, pick a theme), and a colophon at the end saying where it was
 * written and by whom the app is made. No account, profile or local data is
 * needed or touched.
 *
 * Short links (`/share/<id>`) are fetched from the server; embedded links
 * (`/share#<data>`) are decoded in the browser and never leave it.
 *
 * @fileoverview Read-only viewer for shared Notes pages.
 * @since v0.25.2
 */

"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { useTheme } from "next-themes";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, Check, FileDown, Link2, MoreHorizontal, Palette, FileText as FileTextIcon } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { THEMES } from "@/lib/ThemeManager";
import { decodeEmbeddedShare, fetchShare, type SharedNote } from "@/lib/note-share";
import { NOTE_ICON } from "@/lib/notes";
import { cn } from "@/lib/utils";

const SharedNoteBody = dynamic(() => import("./SharedNoteBody"), {
  ssr: false,
  loading: () => (
    <div className="space-y-3">
      <Skeleton className="h-5 w-3/4 rounded-lg" />
      <Skeleton className="h-5 w-full rounded-lg" />
    </div>
  ),
});

const AUTHOR_URL = "http://github.com/BrazeDaGreat/";
const WORDS_PER_MINUTE = 220;

const BUTTON =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50";
const QUIET = cn(BUTTON, "w-9 px-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:w-auto sm:px-2.5");

type Load = { state: "loading" } | { state: "ready"; note: SharedNote } | { state: "missing" } | { state: "error" };

/** The app's mark: the same letterspaced mono wordmark as the boot screen. */
function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-mono font-medium tracking-[0.3em]", className)}>
      BIT<span className="text-primary">·</span>FOCUS
    </span>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Change theme" title="Change theme" className={QUIET}>
        <Palette className="size-4" />
        <span className="hidden sm:inline">Theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(70dvh,28rem)] min-w-44 overflow-y-auto rounded-xl shadow-xs">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={setTheme}>
          {THEMES.map(({ value, label, icon: Icon, iconClass }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className={cn("size-3.5", iconClass)} aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: name });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileName(title: string) {
  return (title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled").slice(0, 80);
}

export default function SharedNoteView({ id }: { id?: string }): JSX.Element {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [words, setWords] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    const read = async () => {
      setLoad({ state: "loading" });
      try {
        const note = id ? await fetchShare(id) : await decodeEmbeddedShare(window.location.hash);
        if (active) setLoad(note ? { state: "ready", note } : { state: "missing" });
      } catch {
        if (active) setLoad({ state: "error" });
      }
    };
    void read();
    // Pasting a different embedded link into the same tab only changes the hash.
    const onHash = () => { if (!id) void read(); };
    window.addEventListener("hashchange", onHash);
    return () => { active = false; window.removeEventListener("hashchange", onHash); };
  }, [id]);

  const note = load.state === "ready" ? load.note : null;
  const title = note?.title || "Untitled";

  useEffect(() => {
    document.title = note ? `${title} · BIT Focus` : "Shared page · BIT Focus";
  }, [note, title]);

  const onReady = useCallback((editor: Editor) => setWords(editor.storage.characterCount.words()), []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the link. Copy it from the address bar instead.");
    }
  };

  const exportPdf = async () => {
    if (!note || exporting) return;
    setExporting(true);
    try {
      const { exportNoteToPdf } = await import("@/lib/note-export");
      await exportNoteToPdf(
        { title: note.title, icon: note.icon, type: "document", content: JSON.stringify(note.content), createdAt: new Date(note.editedAt), updatedAt: new Date(note.editedAt) },
        { assets: note.assets },
      );
    } catch (error) {
      toast.error(error instanceof Error && error.message ? `Could not export PDF: ${error.message}` : "Could not export PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportMarkdown = async () => {
    if (!note) return;
    const { noteContentToMarkdown } = await import("@/lib/note-markdown");
    download(`${fileName(title)}.md`, `# ${title}\n\n${noteContentToMarkdown(JSON.stringify(note.content))}`);
  };

  return (
    <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1 px-3 sm:px-6">
          <Link href="/" className="-ml-1.5 flex h-9 items-center rounded-lg px-1.5 focus-visible:outline-2 focus-visible:outline-primary" aria-label="BIT Focus home">
            <Wordmark className="text-xs" />
          </Link>
          <span aria-hidden className="mx-2 hidden h-5 w-px bg-border sm:block" />
          <span className="hidden text-xs text-muted-foreground sm:inline">Shared page · read only</span>
          <div className="ml-auto flex items-center gap-1">
            {note && (
              <>
                <button type="button" onClick={() => void copyLink()} aria-label="Copy link" title="Copy link" className={QUIET}>
                  {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
                  <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
                </button>
                <button type="button" onClick={() => void exportPdf()} disabled={exporting} aria-label="Export as PDF" title="Export as PDF" className={QUIET}>
                  <FileDown className="size-4" />
                  <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export PDF"}</span>
                </button>
              </>
            )}
            <ThemeMenu />
            {note && (
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="More actions" title="More actions" className={cn(QUIET, "sm:w-9 sm:px-0")}>
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48 rounded-xl shadow-xs">
                  <DropdownMenuItem onSelect={() => void exportMarkdown()}>
                    <FileTextIcon className="size-4" />
                    Download as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/">
                      <ArrowUpRight className="size-4" />
                      Open BIT Focus
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-14">
        {load.state === "loading" ? (
          <div aria-label="Loading shared page">
            <Skeleton className="size-14 rounded-2xl" />
            <Skeleton className="mt-5 h-10 w-2/3 rounded-lg" />
            <Skeleton className="mt-4 h-4 w-48 rounded-lg" />
            <div className="mt-10 space-y-3">
              <Skeleton className="h-5 w-full rounded-lg" />
              <Skeleton className="h-5 w-5/6 rounded-lg" />
              <Skeleton className="h-5 w-2/3 rounded-lg" />
            </div>
          </div>
        ) : !note ? (
          <div className="rounded-xl bg-muted/40 p-5">
            <p className="text-sm font-medium">
              {load.state === "error" ? "Couldn't load this page" : "This link doesn't open a page"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {load.state === "error"
                ? "Check your connection and reload. If it keeps failing, ask the person who shared it for a new link."
                : "The person who shared it may have stopped sharing, or only part of the link was copied. Ask them for the link again."}
            </p>
          </div>
        ) : (
          <article>
            <header className="pb-6">
              <span className="grid size-14 place-items-center rounded-2xl bg-muted text-foreground/80">
                <ProjectIcon name={note.icon || NOTE_ICON} className="size-7" />
              </span>
              <h1 className={cn("mt-5 break-words font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl", !note.title && "text-muted-foreground")}>
                {title}
              </h1>
              <p className="mt-3 flex flex-wrap gap-x-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                <span>Edited {new Date(note.editedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                <span aria-hidden>·</span>
                <span>Shared {formatDistanceToNow(new Date(note.sharedAt), { addSuffix: true })}</span>
                {words != null && words > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read</span>
                  </>
                )}
              </p>
            </header>
            <SharedNoteBody content={note.content} assets={note.assets} onReady={onReady} />
          </article>
        )}

        <footer className="mt-24">
          <div aria-hidden className="flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="size-1.5 rotate-45 bg-primary" />
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-10 rounded-2xl border bg-card p-6 shadow-xs sm:p-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Written in</p>
            <Wordmark className="mt-2 block text-2xl sm:text-3xl" />
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              A quiet workspace for focus sessions, tasks and notes. Works offline, no account needed.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary">
                Try BIT Focus
                <ArrowUpRight className="size-4" />
              </Link>
              <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                <FaGithub className="size-4" aria-hidden />
                Made by Uzair
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
