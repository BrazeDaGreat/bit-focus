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

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useConfig } from "@/hooks/useConfig";
import { useSync } from "@/hooks/useSync";
import { AppSidebar } from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import GlobalShortcuts from "@/components/GlobalShortcuts";
import SyncBridge from "@/components/auth/SyncBridge";
import AutoBackup from "@/components/AutoBackup";
import PipHost from "@/components/PipHost";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { writeProfileHint } from "@/lib/profileHint";

/**
 * Onboarding is a large, one-time flow. Returning users never need it, so it is
 * fetched only when the profile check says it is required.
 */
const Onboarding = dynamic(() => import("@/components/onboarding/Onboarding"), {
  ssr: false,
  loading: () => <BootSplash />,
});

const noopSubscribe = () => () => {};

/** True while rendering on the server and while hydrating; false afterwards. */
function useIsServerRender(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true
  );
}

/**
 * Boot Splash
 *
 * Minimal centered mark shown while the configuration record is read from
 * IndexedDB. Kept intentionally quiet to avoid a jarring flash before the real
 * UI resolves.
 *
 * As an `overlay` it sits on top of the server-rendered app frame and is only
 * displayed when no profile hint is stored (see `lib/profileHint.ts`), so
 * returning users never see it.
 */
function BootSplash({
  note,
  overlay = false,
}: { note?: string; overlay?: boolean } = {}): JSX.Element {
  return (
    <div
      {...(overlay ? { "data-boot-overlay": "" } : {})}
      className={cn(
        "flex-col gap-4 items-center justify-center bg-background",
        overlay ? "" : "flex flex-1 min-h-screen"
      )}
    >
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
  const pathname = usePathname();

  // Only the home page is prepared for server rendering (its data-dependent
  // parts sit behind fixed-size placeholders). Every other page keeps reading
  // browser-only state such as dates and local storage while it renders, so it
  // is mounted right after hydration instead of being part of the server HTML.
  const serverRender = useIsServerRender();
  const showPage = pathname === "/" || !serverRender;

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

  // One toaster for the whole app, whichever branch is on screen.
  const toaster = <Toaster />;

  // Keeps the profile hint honest for the next load's pre-paint check.
  useEffect(() => {
    if (booted) writeProfileHint(!needsOnboarding);
  }, [booted, needsOnboarding]);

  // Until the database answers, the frame is still rendered (and server-
  // rendered): returning users get their page straight away, everyone else
  // sits behind the boot overlay. See `lib/profileHint.ts`.
  const awaitingProfile = !booted;

  // Signing in on a new device starts a restore. Until it finishes we do not
  // know whether this person already has a name, tags and history waiting, so
  // onboarding waits rather than asking for details that are seconds away —
  // and rather than racing the restore and overwriting it with blank answers.
  if (!awaitingProfile && needsOnboarding && bootstrapping && !onboardingStarted.current) {
    return (
      <>
        <SyncBridge />
        <BootSplash note="Checking your account for existing data…" />
        {toaster}
      </>
    );
  }

  // Sync runs in both branches: someone can connect an account during
  // onboarding to restore an existing profile onto a fresh device.
  if (!awaitingProfile && needsOnboarding) {
    onboardingStarted.current = true;
    return (
      <>
        <SyncBridge />
        <Onboarding />
        {toaster}
      </>
    );
  }

  return (
    <>
      <SyncBridge />
      <AutoBackup />
      <PipHost />
      <AppSidebar />
      <GlobalShortcuts />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          pathname === "/settings"
            ? "min-h-svh"
            : "h-dvh min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain"
        )}
      >
        <TopBar />
        {showPage ? children : null}
      </div>
      {toaster}
      {awaitingProfile && <BootSplash overlay />}
    </>
  );
}
