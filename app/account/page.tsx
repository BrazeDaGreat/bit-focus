/**
 * Account Page - Sync Control and Account Management
 *
 * The full view of a connected account: what is linked, whether the two ends
 * agree, and every lever for forcing the issue. Sync is bookkeeping, so the
 * page is built as a ledger — monospace, tabular, one fact per row — with the
 * device↔cloud rail as the only large element, because that is the one thing
 * worth seeing from across the room.
 *
 * Signed out, the page collapses to a single offer rather than an empty state.
 *
 * @fileoverview Account connection, sync status, and data controls.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import { useEffect, useState, type JSX, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSync } from "@/hooks/useSync";
import { useConfig } from "@/hooks/useConfig";
import { PROVIDER_LABELS } from "@/lib/pocketbase";
import { deviceLabel } from "@/lib/sync/engine";
import AccountAvatar from "@/components/auth/AccountAvatar";
import SyncRail, {
  formatSyncTime,
  syncStatusLabel,
} from "@/components/auth/SyncRail";
import ProviderButtons from "@/components/auth/ProviderButtons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FaArrowsRotate,
  FaDownload,
  FaRightFromBracket,
  FaTriangleExclamation,
} from "react-icons/fa6";

// ── Primitives ───────────────────────────────────────────────────────────────

/** One ledger row: an uppercase label against a monospace value. */
function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-right truncate">
        {children}
      </span>
    </div>
  );
}

/** Section heading in the app's eyebrow register. */
function SectionTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

/**
 * Confirmation dialog for an action that replaces data.
 *
 * Forced pushes and pulls are one-way doors, so each states plainly what is
 * about to be overwritten before it happens.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}): JSX.Element {
  const [working, setWorking] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !working && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={working}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={working}
            onClick={async () => {
              setWorking(true);
              await onConfirm();
              setWorking(false);
              onOpenChange(false);
            }}
          >
            {working ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AccountPage(): JSX.Element {
  const router = useRouter();
  const { user, ready, signOut, deleteAccount } = useAuth();
  const {
    status,
    phase,
    pending,
    progress,
    rejected,
    syncedAt,
    lastWriter,
    paused,
    error,
    syncNow,
    setPaused,
    resyncEverything,
    deleteCloudCopy,
    getBackup,
  } = useSync();
  const { name } = useConfig();

  const [confirm, setConfirm] = useState<"resync" | "wipe" | "delete" | null>(
    null,
  );

  // Keeps the "synced 3 min ago" line honest without a subscription.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Signed out ───────────────────────────────────────────────────────────

  if (!ready || !user) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="max-w-lg mx-auto w-full px-6 py-16 flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Account
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              One account, every device.
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              BIT Focus works fine without this. Connect an account only when
              you want the same sessions, projects, and rewards on more than one
              device.
            </p>
          </div>

          <SyncRail status="off" phase={null} pending={0} />

          <ProviderButtons />
        </div>
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────

  const busy = status === "syncing";
  const provider = PROVIDER_LABELS[user.provider] ?? user.provider ?? "—";

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-screen-md mx-auto w-full px-6 py-6 flex flex-col gap-6">
        {/* ── Identity ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <AccountAvatar seed={name} className="size-14 border shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Account
            </p>
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {user.name || "Your account"}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>

        {/* ── The link ─────────────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5 flex flex-col gap-4">
          <SyncRail
            status={status}
            phase={phase}
            pending={pending}
            progress={progress}
            className="px-1"
          />

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground truncate">
              {deviceLabel()}
            </span>
            <span
              className={cn(
                "text-sm font-medium tracking-tight text-center",
                status === "error" ? "text-destructive" : "text-foreground",
              )}
            >
              {syncStatusLabel({ status, phase, pending, syncedAt, progress })}
            </span>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground truncate">
              Cloud
            </span>
          </div>

          {error && (
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => syncNow()}
              className="gap-2"
            >
              <FaArrowsRotate
                className={cn("size-3", busy && "motion-safe:animate-spin")}
              />
              Sync now
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm("resync")}
              className="gap-2"
            >
              <FaArrowsRotate className="size-3" />
              Re-check everything
            </Button>
          </div>
        </section>

        {/* ── Rows the server would not take ───────────────────────────── */}
        {rejected.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Not syncing</SectionTitle>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 flex flex-col gap-2">
              <p className="text-sm">
                {rejected.length}{" "}
                {rejected.length === 1 ? "item is" : "items are"} too large to
                store in the cloud. They stay on this device and everything else
                syncs normally.
              </p>
              <ul className="text-xs text-muted-foreground font-mono flex flex-col gap-0.5">
                {rejected.slice(0, 5).map((item) => (
                  <li key={`${item.col}-${item.uid}`}>
                    {item.col} ·{" "}
                    {item.kind === "oversized"
                      ? `${(item.bytes / 1_000_000).toFixed(1)} MB`
                      : "rejected"}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── Ledger ───────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <SectionTitle>Sync record</SectionTitle>
          <div className="rounded-xl border bg-card divide-y">
            <Row label="Last sync">{formatSyncTime(syncedAt)}</Row>
            <Row label="Waiting to send">
              {pending > 0 ? `${pending} ${pending === 1 ? "change" : "changes"}` : "None"}
            </Row>
            <Row label="Last written by">{lastWriter ?? "—"}</Row>
            <Row label="This device">{deviceLabel()}</Row>
            <Row label="Signed in with">{provider}</Row>
          </div>
        </section>

        {/* ── Preferences ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <SectionTitle>Behaviour</SectionTitle>
          <div className="rounded-xl border bg-card px-4 py-3.5 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="auto-sync" className="text-sm cursor-pointer">
                Sync in the background
              </Label>
              <span className="text-xs text-muted-foreground">
                Send changes as you make them and take updates from your other
                devices. Pausing keeps tracking them — they go out when you
                resume.
              </span>
            </div>
            <Switch
              id="auto-sync"
              checked={!paused}
              onCheckedChange={(on) => void setPaused(!on)}
            />
          </div>
        </section>

        {/* ── Safety copy ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <SectionTitle>Safety copy</SectionTitle>
          <div className="rounded-xl border bg-card px-4 py-3.5 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-sm font-medium">
                Download the pre-sync backup
              </p>
              <p className="text-xs text-muted-foreground">
                A copy of everything on this device, taken once before sync was
                rebuilt.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 shrink-0"
              onClick={async () => {
                const payload = await getBackup();
                if (!payload) {
                  toast("No backup was taken on this device.");
                  return;
                }
                const url = URL.createObjectURL(
                  new Blob([payload], { type: "application/json" }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = `bitfocus-presync-${new Date().toISOString()}.bitf.json`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <FaDownload className="size-3" />
              Download
            </Button>
          </div>
        </section>

        {/* ── Leaving ──────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <SectionTitle>Leaving</SectionTitle>
          <div className="rounded-xl border bg-card divide-y">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-medium">Sign out</p>
                <p className="text-xs text-muted-foreground">
                  Disconnects this device. Your data stays here.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 shrink-0"
                onClick={() => {
                  signOut();
                  toast("Signed out. Your data stays on this device.");
                  router.push("/");
                }}
              >
                <FaRightFromBracket className="size-3" />
                Sign out
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-medium">Delete the cloud copy</p>
                <p className="text-xs text-muted-foreground">
                  Clears what is stored on the server. This device keeps
                  everything.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => setConfirm("wipe")}
              >
                Delete copy
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  Delete account
                </p>
                <p className="text-xs text-muted-foreground">
                  Removes the account and its cloud copy for good. This device
                  keeps everything.
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="gap-2 shrink-0"
                onClick={() => setConfirm("delete")}
              >
                <FaTriangleExclamation className="size-3" />
                Delete
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* ── Confirmations ──────────────────────────────────────────────── */}

      <ConfirmDialog
        open={confirm === "resync"}
        onOpenChange={(o) => setConfirm(o ? "resync" : null)}
        title="Re-check everything?"
        description="Every item on this device and in the cloud is compared again, and the newer version of each one is kept. Nothing is deleted on either side. This can take a moment if you have a lot of data."
        confirmLabel="Re-check"
        onConfirm={async () => {
          await resyncEverything();
          toast.success("Everything re-checked.");
        }}
      />

      <ConfirmDialog
        open={confirm === "wipe"}
        onOpenChange={(o) => setConfirm(o ? "wipe" : null)}
        title="Delete the cloud copy?"
        description="The server copy is removed and this device stops syncing. Everything here stays exactly as it is."
        confirmLabel="Delete copy"
        destructive
        onConfirm={async () => {
          await deleteCloudCopy();
          toast("Cloud copy deleted.");
        }}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => setConfirm(o ? "delete" : null)}
        title="Delete your account?"
        description="Your account and its cloud copy are permanently removed, and every signed-in device is disconnected. The data on this device is untouched."
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          try {
            await deleteAccount();
            toast("Account deleted. Your data stays on this device.");
            router.push("/");
          } catch {
            toast.error("Could not delete the account. Try again.");
          }
        }}
      />
    </div>
  );
}
