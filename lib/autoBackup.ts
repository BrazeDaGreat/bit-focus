/**
 * Automatic Backup
 *
 * When the "Automatic backup" preference is on, the app downloads a regular
 * `.bitf.json` backup (the same file as Export) whenever it is open and the
 * last automatic backup is at least 24 hours old.
 *
 * The timestamp lives in a device-local localStorage key: each browser keeps
 * its own schedule, and a restored backup never carries one over.
 *
 * @fileoverview Once-a-day backup download
 * @author BIT Focus Development Team
 * @since v0.23.0-beta
 */

import SaveManager from "@/lib/SaveManager";

const LAST_BACKUP_KEY = "bitfocus.lastAutoBackup";

/** How often an automatic backup is due */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** When the last automatic backup ran on this device, if ever. */
export function lastAutoBackupAt(): number | null {
  if (typeof window === "undefined") return null;
  const value = Number(localStorage.getItem(LAST_BACKUP_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** True when no automatic backup has run in the last 24 hours. */
export function isAutoBackupDue(now: number = Date.now()): boolean {
  const last = lastAutoBackupAt();
  return last === null || now - last >= AUTO_BACKUP_INTERVAL_MS;
}

/**
 * Download a backup if one is due.
 *
 * The timestamp is claimed before exporting so two tabs opened together do
 * not both download a file.
 *
 * @returns True when a backup was downloaded.
 */
export async function runAutoBackupIfDue(): Promise<boolean> {
  if (!isAutoBackupDue()) return false;
  const previous = localStorage.getItem(LAST_BACKUP_KEY);
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  try {
    await SaveManager.exportData();
    return true;
  } catch (error) {
    // Put the old timestamp back so the next check tries again.
    if (previous) localStorage.setItem(LAST_BACKUP_KEY, previous);
    else localStorage.removeItem(LAST_BACKUP_KEY);
    throw error;
  }
}
