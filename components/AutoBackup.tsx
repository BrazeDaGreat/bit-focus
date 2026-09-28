/**
 * Auto Backup Runner
 *
 * Invisible component that downloads the daily backup while the
 * "Automatic backup" preference is on. It checks when the app opens, when the
 * preference is switched on, when the tab comes back into view, and hourly
 * for tabs left open.
 *
 * @fileoverview Schedules {@link runAutoBackupIfDue}
 * @author BIT Focus Development Team
 * @since v0.23.0-beta
 */

"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { FaFloppyDisk } from "react-icons/fa6";
import { usePreferences } from "@/hooks/usePreferences";
import { runAutoBackupIfDue } from "@/lib/autoBackup";

const CHECK_EVERY_MS = 60 * 60 * 1000;

export default function AutoBackup(): null {
  const autoBackup = usePreferences((s) => s.autoBackup);

  useEffect(() => {
    if (!autoBackup) return;

    const check = () => {
      runAutoBackupIfDue()
        .then((ran) => {
          if (ran) {
            toast("Backup downloaded. The next one is due in 24 hours.", {
              icon: <FaFloppyDisk />,
            });
          }
        })
        .catch((error) => {
          console.error("Automatic backup failed:", error);
          toast.error("Automatic backup failed. Export a backup from the data menu instead.");
        });
    };

    check();
    const intervalId = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [autoBackup]);

  return null;
}
