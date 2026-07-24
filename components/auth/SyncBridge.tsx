/**
 * Sync Bridge - Auth to Engine Wiring
 *
 * Headless component that connects the account store to the sync engine and
 * hosts the conflict dialog. Keeping the wiring here means neither store has to
 * import the other, and mounting it once at the app root is the whole setup.
 *
 * @fileoverview Starts and stops sync as the account connects and disconnects.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import { useEffect, type JSX } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSync } from "@/hooks/useSync";
import SyncConflictDialog from "./SyncConflictDialog";

/**
 * Sync Bridge
 *
 * @returns The conflict dialog, which renders only when one is pending.
 */
export default function SyncBridge(): JSX.Element {
  const { user, ready, init } = useAuth();
  const { userId, attach, detach } = useSync();

  useEffect(() => {
    init();
  }, [init]);

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

  return <SyncConflictDialog />;
}
