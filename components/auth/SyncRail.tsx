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
 * dashed rail means changes are waiting, a rail broken in the middle means the
 * two ends disagree.
 *
 * @fileoverview Directional link indicator for account sync.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import type { JSX } from "react";
import { cn } from "@/lib/utils";
import type { SyncDirection, SyncStatus } from "@/hooks/useSync";
import { FaLaptop, FaCloud } from "react-icons/fa6";

/**
 * Sync Rail
 *
 * @param props.status - Current engine status.
 * @param props.direction - Which way data is moving right now, if at all.
 * @param props.dirty - Whether local changes are waiting to be sent.
 * @param props.className - Extra classes for the outer row.
 */
export default function SyncRail({
  status,
  direction,
  dirty,
  className,
}: {
  status: SyncStatus;
  direction: SyncDirection;
  dirty: boolean;
  className?: string;
}): JSX.Element {
  const busy = status === "busy";
  const broken = status === "conflict" || status === "error";
  const live = status === "idle" && !dirty;

  const capClass = (active: boolean) =>
    cn(
      "grid place-items-center size-8 rounded-lg border shrink-0 transition-colors",
      active
        ? "border-primary/40 bg-primary/10 text-primary"
        : broken
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-muted text-muted-foreground",
    );

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className={capClass(live || direction === "push")} aria-hidden>
        <FaLaptop className="size-3.5" />
      </span>

      <span className="relative flex-1 h-8 flex items-center" aria-hidden>
        {/* The rail itself. A break in the middle reads as a broken link. */}
        {broken ? (
          <span className="flex-1 flex items-center gap-2">
            <span className="flex-1 h-px bg-destructive/40" />
            <span className="size-1 rounded-full bg-destructive/60" />
            <span className="flex-1 h-px bg-destructive/40" />
          </span>
        ) : (
          <span
            className={cn(
              "flex-1 h-px transition-colors",
              live ? "bg-primary/40" : "bg-border",
            )}
            style={
              dirty && !busy
                ? {
                    backgroundImage:
                      "repeating-linear-gradient(to right, var(--border) 0 4px, transparent 4px 8px)",
                    backgroundColor: "transparent",
                  }
                : undefined
            }
          />
        )}

        {/* Travelling marker, shown only while data is actually moving. */}
        {busy && direction && (
          <span
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-[3px] w-6 -ml-3 rounded-full bg-primary",
              direction === "push" ? "_sync_push" : "_sync_pull",
            )}
          />
        )}
      </span>

      <span className={capClass(live || direction === "pull")} aria-hidden>
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

/** One-line description of the engine state, for status text next to the rail. */
export function syncStatusLabel(
  status: SyncStatus,
  direction: SyncDirection,
  dirty: boolean,
  syncedAt: string | null,
): string {
  switch (status) {
    case "off":
      return "Not connected";
    case "busy":
      return direction === "pull" ? "Downloading…" : "Uploading…";
    case "error":
      return "Sync failed";
    case "conflict":
      return "Needs a decision";
    default:
      return dirty ? "Changes waiting" : `Synced ${formatSyncTime(syncedAt)}`;
  }
}
