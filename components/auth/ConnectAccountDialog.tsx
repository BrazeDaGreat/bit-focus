/**
 * Connect Account Dialog - Opt-In Sync Entry Point
 *
 * Shown wherever someone can turn on sync outside of onboarding. It states
 * plainly what connecting does and what it does not do, then gets out of the
 * way: three buttons, no forms, no password to invent.
 *
 * @fileoverview Dialog wrapper around the provider sign-in buttons.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import { useState, type JSX, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ProviderButtons from "./ProviderButtons";
import { FaArrowsRotate, FaLock } from "react-icons/fa6";

/**
 * Connect Account Dialog
 *
 * @param props.children - Optional trigger element.
 * @param props.open - Controlled open state.
 * @param props.onOpenChange - Controlled open state setter.
 * @param props.onConnected - Called after a successful sign-in.
 */
export default function ConnectAccountDialog({
  children,
  open,
  onOpenChange,
  onConnected,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConnected?: () => void;
}): JSX.Element {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary mb-1">
            <FaArrowsRotate className="size-4" />
          </span>
          <DialogTitle className="text-xl tracking-tight">
            Take your focus with you
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            Connect an account and BIT Focus keeps your sessions, projects,
            tags, and rewards the same on every device you sign in on.
          </DialogDescription>
        </DialogHeader>

        <ProviderButtons
          className="pt-1"
          onConnected={() => {
            setOpen(false);
            onConnected?.();
          }}
        />

        <div className="flex items-start gap-3 rounded-xl border bg-card/50 p-3.5">
          <span className="grid place-items-center size-8 rounded-lg bg-muted text-muted-foreground shrink-0">
            <FaLock className="size-3.5" />
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">
              Your data stays yours.
            </span>{" "}
            Only your own account can read it. Sign out and everything keeps
            working on this device exactly as before.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
