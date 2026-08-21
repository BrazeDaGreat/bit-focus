/**
 * Sync Rail - Device ↔ Cloud Link Indicator
 *
 * The signature element of the sync UI. BIT Focus already expresses progress as
 * a dial, because a timer fills. Sync is not a filling thing — it is transit
 * between two fixed points — so it gets a rail instead: this device at one end,
 * the cloud at the other, and a marker whose direction of travel *is* the
 * operation. Rightward means uploading, leftward means downloading.
 *
 * Every state is legible without reading a word: a lit rail is a live link, a
 * dashed rail means changes are waiting, a dimmed rail means the link is down
 * but nothing is lost, and a rail broken in the middle means something failed.
 *
 * One state does fill, and only one: the first upload to a new account is the
 * single sync operation with a total known in advance, so the rail fills to
 * show real progress rather than implying it with motion.
 *
 * @fileoverview Directional link indicator for account sync.
 * @author BIT Focus Development Team
 * @since v0.19.0
 * @updated v0.21.0 - States rebuilt around per-record sync.
 */

"use client";

import type { JSX } from "react";
import { cn } from "@/lib/utils";
import type { SyncPhase, SyncStatus } from "@/hooks/useSync";
import { FaLaptop, FaCloud } from "react-icons/fa6";

/** Props describing everything the rail needs to draw itself. */
export interface SyncRailProps {
  /** Current engine status. */
  status: SyncStatus;
  /** Which way data is moving right now, if at all. */
  phase: SyncPhase;
  /** How many local changes are waiting to be sent. */
  pending: number;
  /** Determinate progress, present only during the first upload. */
  progress?: { done: number; total: number } | null;
  /** Extra classes for the outer row. */
  className?: string;
}

/**
 * Sync Rail
 *
 * @param props - See {@link SyncRailProps}.
 */
export default function SyncRail({
  status,
  phase,
  pending,
  progress,
  className,
}: SyncRailProps): JSX.Element {
  const busy = status === "syncing";
  const broken = status === "error";
  const asleep = status === "offline" || status === "off";
  const waiting = pending > 0 && !busy;
  const live = status === "idle" && pending === 0;

  const seeding = busy && phase === "seed" && Boolean(progress?.total);
  const fill = seeding && progress ? progress.done / progress.total : 0;

  const capClass = (active: boolean) =>
    cn(
      "grid place-items-center size-8 rounded-lg border shrink-0 transition-colors",
      broken
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : asleep
          ? "border-border/60 bg-muted/50 text-muted-foreground/60"
          : active
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-muted text-muted-foreground",
    );

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className={capClass(live || phase === "push" || phase === "seed")} aria-hidden>
        <FaLaptop className="size-3.5" />
      </span>

      <span className="relative flex-1 h-8 flex items-center" aria-hidden>
        {broken ? (
          /* A gap in the middle reads as a link that came apart. */
          <span className="flex-1 flex items-center gap-2">
            <span className="flex-1 h-px bg-destructive/40" />
            <span className="size-1 rounded-full bg-destructive/60" />
            <span className="flex-1 h-px bg-destructive/40" />
          </span>
        ) : (
          <span className="relative flex-1 h-px">
            <span
              className={cn(
                "absolute inset-0 transition-colors",
                live ? "bg-primary/40" : asleep ? "bg-border/50" : "bg-border",
              )}
              style={
                waiting || asleep
                  ? {
                      // Dashes for work in hand, a finer dotted line for a link
                      // that is simply down. Neither is an error.
                      backgroundImage: waiting
                        ? "repeating-linear-gradient(to right, var(--border) 0 4px, transparent 4px 8px)"
                        : "repeating-linear-gradient(to right, var(--border) 0 2px, transparent 2px 6px)",
                      backgroundColor: "transparent",
                    }
                  : undefined
              }
            />

            {/* The one determinate state: the first upload knows its total. */}
            {seeding && (
              <span
                className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${Math.round(fill * 100)}%` }}
              />
            )}
          </span>
        )}

        {/* Travelling marker, shown only while data is actually moving. */}
        {busy && !seeding && (phase === "push" || phase === "pull") && (
          <span
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-[3px] w-6 -ml-3 rounded-full bg-primary",
              phase === "push" ? "_sync_push" : "_sync_pull",
            )}
          />
        )}
      </span>

      <span className={capClass(live || phase === "pull")} aria-hidden>
        <FaCloud className="size-3.5" />
      </span>
    </div>
  );
}

/**
 * Format a sync timestamp the way a person would say it.
 *
 * @param iso - ISO timestamp of the last successful sync, or null.
 * @returns A short relative phrase, e.g. `3 min ago`.
 */
export function formatSyncTime(iso: string | null): string {
  if (!iso) return "never";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "never";

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(then).toLocaleDateString();
}

/**
 * One-line description of the engine state.
 *
 * Written to answer the only two questions a person actually has: is my work
 * safe, and is there anything I need to do? Offline says so plainly and says
 * nothing alarming, because with local-first storage it genuinely is not a
 * problem — the changes are on the device either way.
 *
 * @param snapshot - Current engine status fields.
 */
export function syncStatusLabel(snapshot: {
  status: SyncStatus;
  phase: SyncPhase;
  pending: number;
  syncedAt: string | null;
  progress?: { done: number; total: number } | null;
}): string {
  const { status, phase, pending, syncedAt, progress } = snapshot;

  switch (status) {
    case "off":
      return "Not connected";
    case "offline":
      return pending > 0
        ? `Offline · ${pending} ${pending === 1 ? "change" : "changes"} saved here`
        : "Offline · changes saved here";
    case "error":
      return "Sync failed · retrying";
    case "syncing":
      if (phase === "seed") {
        const pct =
          progress && progress.total > 0
            ? Math.round((progress.done / progress.total) * 100)
            : 0;
        return `First upload · ${pct}%`;
      }
      return phase === "pull" ? "Downloading…" : "Uploading…";
    default:
      return pending > 0
        ? `${pending} ${pending === 1 ? "change" : "changes"} waiting`
        : `Synced ${formatSyncTime(syncedAt)}`;
  }
}
