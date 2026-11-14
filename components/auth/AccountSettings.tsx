/**
 * Account Settings - Sync Control and Account Management
 *
 * The full view of a connected account in Settings: who is signed in, whether
 * this device and the cloud agree, and the few levers worth reaching for. The
 * device↔cloud rail is the one large element. The sync ledger folds away under
 * Sync details, and the rarely used, one-way actions (sign out, delete the
 * cloud copy, delete the account) live in the ⋯ menu on the identity row,
 * which a right-click on that row also opens.
 *
 * Signed out, the section collapses to a single offer rather than an empty state.
 *
 * @fileoverview Account connection, sync status, and data controls.
 * @author BIT Focus Development Team
 * @since v0.19.0
 * @updated v0.25.3 - Wells instead of nested cards; leaving actions in a menu.
 */

"use client";

import { useEffect, useState, type JSX, type ReactNode } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Group, Row, SettingsButton, Well } from "@/components/settings/parts";
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
  FaChevronDown,
  FaDownload,
  FaEllipsis,
  FaRightFromBracket,
} from "react-icons/fa6";

// ── Primitives ───────────────────────────────────────────────────────────────

/** One ledger row: a plain label against a monospace value. */
function LedgerRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-sm tabular-nums">
        {children}
      </span>
    </div>
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

// ── Account section ──────────────────────────────────────────────────────────

export default function AccountSettings(): JSX.Element {
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Keeps the "synced 3 min ago" line honest without a subscription.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Signed out ───────────────────────────────────────────────────────────

  if (!ready || !user) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-muted/40 p-4">
          <SyncRail status="off" phase={null} pending={0} className="px-1" />
          <p className="mt-4 text-sm font-medium">Not connected</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            BIT Focus works fine without an account. Connect one when you want
            the same sessions, projects, and rewards on more than one device.
          </p>
        </div>
        <ProviderButtons />
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────

  const busy = status === "syncing";
  const provider = PROVIDER_LABELS[user.provider] ?? user.provider ?? "—";

  const downloadBackup = async () => {
    const payload = await getBackup();
    if (!payload) {
      toast("No pre-sync backup was taken on this device.");
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
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ── Identity, with the rarely used actions behind ⋯ ─────────── */}
      <div
        className="flex items-center gap-3"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
      >
        <AccountAvatar seed={name} className="size-10 shrink-0 border" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">
            {user.name || "Your account"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user.email} · {provider}
          </p>
        </div>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Account actions"
              title="Account actions"
              className="size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/60"
            >
              <FaEllipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1">
            <DropdownMenuItem
              className="rounded-lg"
              onSelect={() => void downloadBackup()}
            >
              <FaDownload className="size-3.5" />
              Download pre-sync backup
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-lg"
              onSelect={() => {
                signOut();
                toast("Signed out. Your data stays on this device.");
              }}
            >
              <FaRightFromBracket className="size-3.5" />
              Sign out
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="rounded-lg"
              variant="destructive"
              onSelect={() => setConfirm("wipe")}
            >
              Delete the cloud copy…
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-lg"
              variant="destructive"
              onSelect={() => setConfirm("delete")}
            >
              Delete account…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── The link ─────────────────────────────────────────────────── */}
      <Group title="Sync">
        <div className="flex flex-col gap-4 rounded-xl bg-muted/40 p-4">
          <SyncRail
            status={status}
            phase={phase}
            pending={pending}
            progress={progress}
            className="px-1"
          />

          <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">{deviceLabel()}</span>
            <span
              className={cn(
                "text-center text-sm font-medium tracking-tight",
                status === "error" ? "text-destructive" : "text-foreground",
              )}
            >
              {syncStatusLabel({ status, phase, pending, syncedAt, progress })}
            </span>
            <span className="truncate">Cloud</span>
          </div>

          {error && (
            <p className="text-xs leading-relaxed text-destructive">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <SettingsButton primary disabled={busy} onClick={() => syncNow()}>
              <FaArrowsRotate
                className={cn("size-3", busy && "motion-safe:animate-spin")}
              />
              Sync now
            </SettingsButton>
            <SettingsButton disabled={busy} onClick={() => setConfirm("resync")}>
              Re-check everything
            </SettingsButton>
          </div>
        </div>
      </Group>

      {/* ── Rows the server would not take ───────────────────────────── */}
      {rejected.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-destructive/12 px-4 py-3.5">
          <p className="text-sm font-medium">
            {rejected.length}{" "}
            {rejected.length === 1 ? "item is" : "items are"} not syncing
          </p>
          <p className="text-xs text-muted-foreground">
            Too large to store in the cloud. They stay on this device and
            everything else syncs normally.
          </p>
          <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
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
      )}

      {/* ── Behaviour, with the ledger folded beneath ────────────────── */}
      <Well>
        <Row
          id="auto-sync"
          label="Sync in the background"
          hint="Sends changes as you make them and takes updates from your other devices. Paused changes go out when you resume."
        >
          <Switch
            id="auto-sync"
            checked={!paused}
            onCheckedChange={(on) => void setPaused(!on)}
          />
        </Row>
        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors duration-150 hover:bg-background/60 focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Sync details
            <FaChevronDown className="size-3 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pb-1">
            <LedgerRow label="Last sync">{formatSyncTime(syncedAt)}</LedgerRow>
            <LedgerRow label="Waiting to send">
              {pending > 0 ? `${pending} ${pending === 1 ? "change" : "changes"}` : "None"}
            </LedgerRow>
            <LedgerRow label="Last written by">{lastWriter ?? "—"}</LedgerRow>
            <LedgerRow label="Signed in with">{provider}</LedgerRow>
          </CollapsibleContent>
        </Collapsible>
      </Well>

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
          } catch {
            toast.error("Could not delete the account. Try again.");
          }
        }}
      />
    </div>
  );
}
