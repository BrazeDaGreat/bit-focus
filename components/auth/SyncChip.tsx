/**
 * Sync Chip - Top Bar Sync Indicator
 *
 * A single glanceable mark in the top bar, present only when an account is
 * connected. It answers "is my data safe" without being asked, and pressing it
 * syncs immediately. When there is nothing to report it stays quiet — muted and
 * unanimated — so it never competes with the timer beside it.
 *
 * @fileoverview Compact sync status and manual trigger for the top bar.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import type { JSX } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSync } from "@/hooks/useSync";
import { Button } from "@/components/ui/button";
import { syncStatusLabel } from "./SyncRail";
import { cn } from "@/lib/utils";
import {
  FaArrowsRotate,
  FaCloud,
  FaCloudArrowUp,
  FaCloudArrowDown,
  FaPlugCircleXmark,
  FaTriangleExclamation,
} from "react-icons/fa6";

/**
 * Sync Chip
 *
 * @returns The indicator, or nothing when running without an account.
 */
export default function SyncChip(): JSX.Element | null {
  const { user } = useAuth();
  const { status, phase, pending, syncedAt, progress, syncNow } = useSync();

  if (!user) return null;

  const { Icon, tone, spin } = (() => {
    switch (status) {
      case "syncing":
        return phase === "pull"
          ? { Icon: FaCloudArrowDown, tone: "text-primary", spin: false }
          : { Icon: FaArrowsRotate, tone: "text-primary", spin: true };
      case "error":
        return { Icon: FaTriangleExclamation, tone: "text-destructive", spin: false };
      // Offline is a normal condition for a local-first app, not a fault. It
      // gets a plain mark in the muted tone rather than an alarm colour.
      case "offline":
        return { Icon: FaPlugCircleXmark, tone: "text-muted-foreground", spin: false };
      default:
        return pending > 0
          ? { Icon: FaCloudArrowUp, tone: "text-muted-foreground", spin: false }
          : { Icon: FaCloud, tone: "text-muted-foreground", spin: false };
    }
  })();

  const label = syncStatusLabel({ status, phase, pending, syncedAt, progress });

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-8"
      title={`Sync — ${label}`}
      aria-label={`Sync status: ${label}. Press to sync now.`}
      disabled={status === "syncing"}
      onClick={() => syncNow()}
    >
      <Icon
        className={cn("size-3.5", tone, spin && "motion-safe:animate-spin")}
      />
    </Button>
  );
}
