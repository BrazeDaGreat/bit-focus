/**
 * App Shell - First-Run Gate and Application Frame
 *
 * Client wrapper that decides what the user sees on load: the onboarding flow
 * for first-time visitors, or the full application frame (sidebar + top bar +
 * page content) for returning users.
 *
 * First-run detection relies on the user configuration store. A fresh install
 * has no configuration record, so the store keeps its default name of "NULL".
 * Once onboarding writes a real name via `setConfig`, the store updates and this
 * component re-renders into the full app — no reload required.
 *
 * A restored profile takes the same path. When sync pulls an existing account
 * down onto this device it writes the configuration record and refreshes the
 * store, so onboarding disappears on its own without anyone filling it in.
 *
 * @fileoverview Gates the app behind onboarding until a profile exists.
 * @author BIT Focus Development Team
 * @since v0.18.2
 */

"use client";

import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { useConfig } from "@/hooks/useConfig";
import { useSync } from "@/hooks/useSync";
import { AppSidebar } from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import Onboarding from "@/components/onboarding/Onboarding";
import GlobalShortcuts from "@/components/GlobalShortcuts";
import SyncBridge from "@/components/auth/SyncBridge";

/**
 * Boot Splash
 *
 * Minimal centered mark shown while the configuration record is read from
 * IndexedDB. Kept intentionally quiet to avoid a jarring flash before the real
 * UI resolves.
 */
function BootSplash({ note }: { note?: string } = {}): JSX.Element {
  return (
    <div className="flex-1 min-h-screen flex flex-col gap-4 items-center justify-center bg-background">
      <span className="font-mono text-sm tracking-[0.3em] text-muted-foreground motion-safe:animate-pulse">
        BIT·FOCUS
      </span>
      {note && (
        <span className="text-xs text-muted-foreground">{note}</span>
      )}
    </div>
  );
}

/**
 * App Shell Component
 *
 * @param props.children - Page content rendered inside the app frame.
 * @returns Onboarding flow, a boot splash, or the full application frame.
 */
export default function AppShell({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { name, loadConfig } = useConfig();
  const { bootstrapping } = useSync();

  // Once the flow is on screen it stays on screen. Someone who signs in from
  // inside onboarding has already typed answers, and replacing the flow with a
  // splash would throw them away — the restore is guarded at the finish line
  // instead.
  const onboardingStarted = useRef(false);

  // One-time initial load. We track completion locally rather than gating on the
  // store's transient `loadingConfig`, because other components (e.g. the
  // sidebar) also call `loadConfig`, which would otherwise flip this back to the
  // splash and unmount/remount the app frame in a loop.
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let active = true;
    loadConfig().finally(() => {
      if (active) setBooted(true);
    });
    return () => {
      active = false;
    };
  }, [loadConfig]);

  const needsOnboarding =
    !name || name === "NULL" || name.trim() === "";

  if (!booted) {
    return <BootSplash />;
  }

  // Signing in on a new device starts a restore. Until it finishes we do not
  // know whether this person already has a name, tags and history waiting, so
  // onboarding waits rather than asking for details that are seconds away —
  // and rather than racing the restore and overwriting it with blank answers.
  if (needsOnboarding && bootstrapping && !onboardingStarted.current) {
    return (
      <>
        <SyncBridge />
        <BootSplash note="Checking your account for existing data…" />
      </>
    );
  }

  // Sync runs in both branches: someone can connect an account during
  // onboarding to restore an existing profile onto a fresh device.
  if (needsOnboarding) {
    onboardingStarted.current = true;
    return (
      <>
        <SyncBridge />
        <Onboarding />
      </>
    );
  }

  return (
    <>
      <SyncBridge />
      <AppSidebar />
      <GlobalShortcuts />
      <div className="flex min-w-0 max-h-screen flex-1 flex-col overflow-y-auto">
        <TopBar />
        {children}
      </div>
    </>
  );
}
