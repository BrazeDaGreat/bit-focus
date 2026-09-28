/**
 * Offline Indicator
 *
 * A quiet chip beside the page title while the browser has no connection.
 * Being offline is a normal state for a local-first app, so this reads as
 * information rather than an error: everything stored on the device keeps
 * working, and only network features (sync, AI chat, webhooks) wait.
 *
 * Also registers the service worker that lets the installed app open
 * without a connection.
 *
 * @fileoverview Connection status chip and service worker registration
 * @author BIT Focus Development Team
 * @since v0.23.0-beta
 */

"use client";

import { useEffect, useSyncExternalStore, type JSX } from "react";
import { FaPlugCircleXmark } from "react-icons/fa6";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Browser connection state; assumes online during server render. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}

export default function OfflineIndicator(): JSX.Element | null {
  const online = useOnline();

  // Only production builds get a service worker: in development it would
  // cache hot-reloaded chunks and serve stale code.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }, []);

  if (online) return null;

  return (
    <span
      role="status"
      title="You're offline. Timer, sessions, notes and projects keep working and are saved on this device. Sync, AI chat and webhooks resume when you reconnect."
      className="flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 text-[11px] font-medium text-muted-foreground motion-safe:animate-in motion-safe:fade-in"
    >
      <FaPlugCircleXmark className="size-3" aria-hidden="true" />
      Offline
      <span className="hidden sm:inline">· saved on this device</span>
    </span>
  );
}
