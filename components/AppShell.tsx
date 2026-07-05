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
 * @fileoverview Gates the app behind onboarding until a profile exists.
 * @author BIT Focus Development Team
 * @since v0.18.2
 */

"use client";

import { useEffect, useState, type JSX, type ReactNode } from "react";
import { useConfig } from "@/hooks/useConfig";
import { AppSidebar } from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import Onboarding from "@/components/onboarding/Onboarding";
import GlobalShortcuts from "@/components/GlobalShortcuts";

/**
 * Boot Splash
 *
 * Minimal centered mark shown while the configuration record is read from
 * IndexedDB. Kept intentionally quiet to avoid a jarring flash before the real
 * UI resolves.
 */
function BootSplash(): JSX.Element {
  return (
    <div className="flex-1 min-h-screen flex items-center justify-center bg-background">
      <span className="font-mono text-sm tracking-[0.3em] text-muted-foreground motion-safe:animate-pulse">
        BIT·FOCUS
      </span>
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

  if (needsOnboarding) {
    return <Onboarding />;
  }

  return (
    <>
      <AppSidebar />
      <GlobalShortcuts />
      <div className="flex-1 flex flex-col max-h-screen overflow-y-auto">
        <TopBar />
        {children}
      </div>
    </>
  );
}
