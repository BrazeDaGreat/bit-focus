/**
 * Notes - Share Dialog
 *
 * Turns the open page into a read-only link. Signed in, the link is short and
 * carries images; it is stored on the account's server and keeps the same
 * address when updated or until sharing stops. Signed out (or on a server
 * without the share collection), the page is packed into the link itself.
 *
 * Nothing is published until "Create link" is pressed, and later edits stay
 * private until "Update link".
 *
 * @fileoverview Share dialog for Notes pages.
 * @since v0.25.2
 */

"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import type { JSONContent } from "@tiptap/core";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, ExternalLink, Link2Off, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { useAuth } from "@/hooks/useAuth";
import {
  buildSharedNote,
  deleteShare,
  embeddedShareUrl,
  findShare,
  publishShare,
  shortShareUrl,
  SharesUnavailableError,
  type ShareRecord,
} from "@/lib/note-share";
import { noteTitle, type Note } from "@/lib/notes";
import { cn } from "@/lib/utils";

const BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50";
const QUIET = cn(BUTTON, "text-muted-foreground hover:bg-muted/60 hover:text-foreground");
const PRIMARY = cn(BUTTON, "bg-primary text-primary-foreground hover:bg-primary/90");

type Lookup =
  | { state: "loading" }
  | { state: "none" }
  | { state: "shared"; record: ShareRecord }
  | { state: "embedded" }
  | { state: "error" };

export function NoteShareDialog({
  note,
  getContent,
  onClose,
}: {
  note: Note;
  getContent: () => JSONContent | Promise<JSONContent>;
  onClose: () => void;
}): JSX.Element {
  const user = useAuth((state) => state.user);
  const authReady = useAuth((state) => state.ready);
  const [lookup, setLookup] = useState<Lookup>({ state: "loading" });
  const [unavailable, setUnavailable] = useState(false);
  const [embedded, setEmbedded] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "update" | "stop" | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = note.uid ?? "";

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user || !uid) { setLookup({ state: "embedded" }); return; }
    let active = true;
    setLookup({ state: "loading" });
    findShare(uid)
      .then((record) => { if (active) setLookup(record ? { state: "shared", record } : { state: "none" }); })
      .catch((error) => {
        if (!active) return;
        if (error instanceof SharesUnavailableError) { setUnavailable(true); setLookup({ state: "embedded" }); }
        else setLookup({ state: "error" });
      });
    return () => { active = false; };
  }, [authReady, user, uid]);

  const url = lookup.state === "shared" ? shortShareUrl(lookup.record.id) : embedded;
  const outdated = lookup.state === "shared" && new Date(note.updatedAt).getTime() > new Date(lookup.record.updated).getTime() + 1000;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the link. Select it and copy it yourself.");
    }
  };

  const publish = async (kind: "create" | "update") => {
    setBusy(kind);
    try {
      if (lookup.state === "embedded") {
        const link = await embeddedShareUrl(await buildSharedNote(note, await getContent(), false));
        setEmbedded(link);
        await copy(link);
        toast.success("Link created and copied");
        return;
      }
      const existing = lookup.state === "shared" ? lookup.record.id : undefined;
      const { record, dropped } = await publishShare(uid, await buildSharedNote(note, await getContent(), true), existing);
      setLookup({ state: "shared", record });
      if (kind === "create") await copy(shortShareUrl(record.id));
      toast.success(kind === "create" ? "Link created and copied" : "Link updated");
      if (dropped) toast(`${dropped} ${dropped === 1 ? "image was" : "images were"} too large to include and ${dropped === 1 ? "was" : "were"} left out.`);
    } catch (error) {
      if (error instanceof SharesUnavailableError) {
        setUnavailable(true);
        setLookup({ state: "embedded" });
        toast("Short links aren't set up on this server yet. Create a link that holds the page instead.");
        return;
      }
      toast.error(error instanceof Error && error.message ? `Could not ${kind} the link: ${error.message}` : `Could not ${kind} the link`);
    } finally {
      setBusy(null);
    }
  };

  const stop = async () => {
    if (lookup.state !== "shared") return;
    setBusy("stop");
    try {
      await deleteShare(lookup.record.id);
      setLookup({ state: "none" });
      toast.success("Stopped sharing. The link no longer opens this page.");
    } catch {
      toast.error("Could not stop sharing. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => { if (!open && !busy) onClose(); }}
      title={`Share “${noteTitle(note)}”`}
      description="Anyone with the link can read this page. They can't edit it, and they don't need an account."
    >
      {lookup.state === "loading" ? (
        <div className="h-24 rounded-xl bg-muted/40 motion-safe:animate-pulse" aria-label="Checking for an existing link" />
      ) : lookup.state === "error" ? (
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-sm font-medium">Couldn&apos;t check whether this page is shared</p>
          <p className="mt-1 text-xs text-muted-foreground">Check your connection, then close this and press Share again.</p>
        </div>
      ) : url ? (
        <div className="space-y-3">
          <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
            <input
              readOnly
              value={url}
              aria-label="Share link"
              onFocus={(event) => event.currentTarget.select()}
              className="h-10 min-w-0 flex-1 bg-transparent px-2.5 font-mono text-xs text-foreground outline-none"
            />
            <button type="button" onClick={() => void copy(url)} className={cn(PRIMARY, "shrink-0")}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          {lookup.state === "shared" ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              {outdated ? "You've edited this page since. " : ""}
              Link shows the version from {formatDistanceToNow(new Date(lookup.record.updated), { addSuffix: true })}.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              This link holds the page itself ({url.length.toLocaleString()} characters), so it shows this version forever and leaves images out.
              {url.length > 2000 && " Some chat apps cut links this long short."}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <a href={url} target="_blank" rel="noopener noreferrer" className={QUIET}>
              <ExternalLink className="size-4" />
              Open
            </a>
            {lookup.state === "shared" && (
              <>
                <button type="button" disabled={!!busy} onClick={() => void publish("update")} className={cn(QUIET, outdated && "bg-primary/12 text-primary hover:bg-primary/20 hover:text-primary")}>
                  <RefreshCw className={cn("size-4", busy === "update" && "motion-safe:animate-spin")} />
                  {busy === "update" ? "Updating…" : "Update link"}
                </button>
                <button type="button" disabled={!!busy} onClick={() => void stop()} className={cn(QUIET, "ml-auto hover:bg-destructive/12 hover:text-destructive")}>
                  <Link2Off className="size-4" />
                  {busy === "stop" ? "Stopping…" : "Stop sharing"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 p-3">
            {lookup.state === "none" ? (
              <>
                <p className="text-sm font-medium">Short link with images</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A copy of this page goes to your account&apos;s server. Edits you make later stay private until you update the link, and you can stop sharing at any time.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Link that holds the page</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {unavailable
                    ? "Short links aren't set up on this server yet, so the page is packed into the link itself."
                    : "You're not signed in, so the page is packed into the link itself."}{" "}
                  Nothing is uploaded, but the link is long and leaves images out.
                  {!unavailable && " Connect an account in Settings for short links with images."}
                </p>
              </>
            )}
          </div>
          <div className="flex justify-end">
            <button type="button" disabled={!!busy || !uid} onClick={() => void publish("create")} className={PRIMARY}>
              {busy === "create" ? "Creating…" : "Create link"}
            </button>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
