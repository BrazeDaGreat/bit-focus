/**
 * Sync Conflict Dialog - Choosing Between Two Versions
 *
 * Sync never merges silently. When this device and the cloud both changed since
 * they last agreed, the engine stops and this dialog asks which version to
 * keep — showing what each one actually holds, because "keep local or remote"
 * is an impossible question without that.
 *
 * The two versions are laid out as facing ledgers in the same monospace,
 * tabular register the rest of the app uses for counts, so differences line up
 * row by row and are read rather than guessed at.
 *
 * @fileoverview Informed conflict resolution between local and cloud snapshots.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import { useState, type JSX } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSync } from "@/hooks/useSync";
import SyncManager, { type SnapshotSummary } from "@/lib/SyncManager";
import { cn } from "@/lib/utils";
import { FaLaptop, FaCloud, FaCodeBranch } from "react-icons/fa6";

/** Rows compared side by side. Order runs from most to least telling. */
const ROWS: { key: keyof SnapshotSummary; label: string }[] = [
  { key: "focusSessions", label: "Sessions" },
  { key: "projects", label: "Projects" },
  { key: "notes", label: "Notes" },
  { key: "timeblocks", label: "Timeblocks" },
  { key: "drawings", label: "Drawings" },
  { key: "chats", label: "Chats" },
];

/** Format a byte count at the coarsest useful precision. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Version Card
 *
 * One side of the comparison, selectable as the version to keep.
 */
function VersionCard({
  title,
  subtitle,
  icon,
  summary,
  other,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  icon: JSX.Element;
  summary: SnapshotSummary;
  other: SnapshotSummary;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const newer =
    !!summary.lastActivity &&
    (!other.lastActivity || summary.lastActivity > other.lastActivity);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid place-items-center size-8 rounded-lg shrink-0",
            selected
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex flex-col divide-y border-t">
        {ROWS.map((row) => {
          const value = summary[row.key] as number;
          const compared = other[row.key] as number;
          return (
            <div
              key={row.key}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {row.label}
              </span>
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  value > compared && "text-primary font-semibold",
                )}
              >
                {value}
              </span>
            </div>
          );
        })}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Size
          </span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {formatBytes(summary.bytes)}
          </span>
        </div>
        {/* The deciding fact when both sides hold real data: which one was
            actually being used most recently. */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Last activity
          </span>
          <span
            className={cn(
              "font-mono text-sm tabular-nums",
              newer ? "text-primary font-semibold" : "text-muted-foreground",
            )}
          >
            {summary.lastActivity
              ? summary.lastActivity.toLocaleDateString()
              : "—"}
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Sync Conflict Dialog
 *
 * Rendered globally; opens only when the engine raises a conflict.
 */
export default function SyncConflictDialog(): JSX.Element | null {
  const { conflict, resolveConflict, dismissConflict } = useSync();
  const [keep, setKeep] = useState<"local" | "cloud">("local");
  const [working, setWorking] = useState(false);

  if (!conflict) return null;

  const remoteUpdated = conflict.remoteUpdated
    ? new Date(conflict.remoteUpdated).toLocaleString()
    : "unknown";

  const apply = async () => {
    setWorking(true);
    await resolveConflict(keep);
    setWorking(false);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !working) dismissConflict();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary mb-1">
            <FaCodeBranch className="size-4" />
          </span>
          <DialogTitle className="text-xl tracking-tight">
            {conflict.firstSync
              ? "This device already has data"
              : "Two versions of your data"}
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {conflict.firstSync
              ? "Your account already holds a copy from another device, and this one has its own. Nothing is merged — pick the version to keep, and the other is replaced."
              : "This device and the cloud both changed since they last agreed. Pick the version to keep — the other one is replaced."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <VersionCard
            title="This device"
            subtitle={SyncManager.deviceLabel()}
            icon={<FaLaptop className="size-3.5" />}
            summary={conflict.local}
            other={conflict.remote}
            selected={keep === "local"}
            onSelect={() => setKeep("local")}
          />
          <VersionCard
            title="The cloud"
            subtitle={`${conflict.remoteDeviceLabel} · ${remoteUpdated}`}
            icon={<FaCloud className="size-3.5" />}
            summary={conflict.remote}
            other={conflict.local}
            selected={keep === "cloud"}
            onSelect={() => setKeep("cloud")}
          />
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {keep === "local"
            ? "Your cloud copy is replaced with what is on this device. Other devices will match it on their next sync."
            : "This device is replaced with the cloud copy, and the app reloads. Anything changed here since the last sync is lost."}
        </p>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={dismissConflict}
            disabled={working}
          >
            Decide later
          </Button>
          <Button onClick={apply} disabled={working}>
            {working
              ? "Working…"
              : keep === "local"
                ? "Keep this device"
                : "Use the cloud copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
