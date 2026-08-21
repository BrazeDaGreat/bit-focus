/**
 * Sync Bridge - Auth to Engine Wiring
 *
 * Headless component mounted once at the app root. It connects the account
 * store to the sync engine and routes "remote data landed" events to the stores
 * that need reloading.
 *
 * It used to also host a conflict dialog. There is no longer anything for one
 * to ask: merging happens per row, automatically, so two devices that changed
 * different things both keep their changes and nobody is asked to sacrifice a
 * version of their own data.
 *
 * @fileoverview Starts and stops sync, and refreshes views when data arrives.
 * @author BIT Focus Development Team
 * @since v0.19.0
 * @updated v0.21.0 - Refresh in place; conflict prompt retired.
 */

"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSync } from "@/hooks/useSync";
import { onRefresh } from "@/lib/sync/engine";
import { refreshStores } from "@/lib/sync/refresh";

/**
 * Sync Bridge
 *
 * Renders nothing. All of its work happens in effects.
 */
export default function SyncBridge(): null {
  const { user, ready, init } = useAuth();
  const { userId, attach, detach } = useSync();

  useEffect(() => {
    init();
  }, [init]);

  // Reload only the slices that changed. This is what replaced the full page
  // reload the previous engine performed after every pull.
  useEffect(() => {
    return onRefresh((report) => {
      void refreshStores(report);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (user && userId !== user.id) {
      void attach(user.id);
      return;
    }
    if (!user && userId) {
      detach();
    }
  }, [ready, user, userId, attach, detach]);

  return null;
}
