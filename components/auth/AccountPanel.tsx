/**
 * Account Panel - Sync Status Inside the Profile Popover
 *
 * The compact face of account sync, shown at the top of the profile popover.
 * Disconnected, it makes one offer. Connected, it answers the only two
 * questions that matter in passing: which account is this, and is my data
 * current — with a way to force the issue and a way out to the full page.
 *
 * @fileoverview Compact account and sync summary for the profile dropdown.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSync } from "@/hooks/useSync";
import { useConfig } from "@/hooks/useConfig";
import { Button } from "@/components/ui/button";
import AccountAvatar from "./AccountAvatar";
import ConnectAccountDialog from "./ConnectAccountDialog";
import SyncRail, { syncStatusLabel } from "./SyncRail";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FaArrowsRotate,
  FaCloudArrowUp,
  FaRightFromBracket,
  FaSliders,
} from "react-icons/fa6";

/**
 * Account Panel
 *
 * @param props.onNavigate - Called before routing away, so the host popover can
 *   close itself.
 */
export default function AccountPanel({
  onNavigate,
}: {
  onNavigate?: () => void;
}): JSX.Element {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { status, direction, dirty, syncedAt, syncNow } = useSync();
  const { name } = useConfig();
  const [connectOpen, setConnectOpen] = useState(false);

  // ── Disconnected ─────────────────────────────────────────────────────────

  if (!user) {
    return (
      <>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center size-8 rounded-lg bg-primary/10 text-primary shrink-0">
              <FaCloudArrowUp className="size-3.5" />
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-sm font-medium leading-none">
                Sync across devices
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your data lives only in this browser. Connect an account to pick
                up where you left off anywhere.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => setConnectOpen(true)}
          >
            Connect an account
          </Button>
        </div>

        <ConnectAccountDialog
          open={connectOpen}
          onOpenChange={setConnectOpen}
          onConnected={() => toast.success("Account connected. Syncing now.")}
        />
      </>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────

  const busy = status === "busy";

  return (
    <div className="rounded-xl border bg-card p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <AccountAvatar seed={name} className="size-9 shrink-0 border" />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">
            {user.name || "Connected"}
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            {user.email}
          </span>
        </div>
      </div>

      <SyncRail status={status} direction={direction} dirty={dirty} />

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[11px] uppercase tracking-widest",
            status === "error" || status === "conflict"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {syncStatusLabel(status, direction, dirty, syncedAt)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1.5"
          disabled={busy}
          onClick={() => syncNow()}
        >
          <FaArrowsRotate
            className={cn("size-3", busy && "motion-safe:animate-spin")}
          />
          Sync now
        </Button>
      </div>

      <div className="flex gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs gap-1.5"
          onClick={() => {
            onNavigate?.();
            router.push("/account");
          }}
        >
          <FaSliders className="size-3" />
          Manage
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs gap-1.5"
          onClick={() => {
            signOut();
            toast("Signed out. Your data stays on this device.");
          }}
        >
          <FaRightFromBracket className="size-3" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
