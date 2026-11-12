/** Device-local download bookkeeping. A download cannot confirm a file was saved to disk. */
export const LAST_COMPLETE_BACKUP_KEY = "bitfocus.lastCompleteBackup";
export const LAST_COMPLETE_BACKUP_SOURCE_KEY = "bitfocus.lastCompleteBackupSource";
export const BACKUP_HEALTH_EVENT = "bitfocus:backup-health";

export function lastCompleteBackupAt(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_COMPLETE_BACKUP_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch { return null; }
}

export function lastCompleteBackupSource(): "download" | "discord" {
  try { return localStorage.getItem(LAST_COMPLETE_BACKUP_SOURCE_KEY) === "discord" ? "discord" : "download"; }
  catch { return "download"; }
}

export function recordCompleteBackupDownload(source: "download" | "discord" = "download"): void {
  let previousSource: string | null = null;
  try {
    previousSource = localStorage.getItem(LAST_COMPLETE_BACKUP_SOURCE_KEY);
    localStorage.setItem(LAST_COMPLETE_BACKUP_SOURCE_KEY, source);
    localStorage.setItem(LAST_COMPLETE_BACKUP_KEY, String(Date.now()));
  } catch {
    try {
      if (previousSource === null) localStorage.removeItem(LAST_COMPLETE_BACKUP_SOURCE_KEY);
      else localStorage.setItem(LAST_COMPLETE_BACKUP_SOURCE_KEY, previousSource);
    } catch { /* A backup must not fail because bookkeeping is blocked. */ }
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function")
    window.dispatchEvent(new Event(BACKUP_HEALTH_EVENT));
}

export interface StorageHealth {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
  canPersist: boolean;
}

const unavailable: StorageHealth = { usage: null, quota: null, persisted: null, canPersist: false };

/** Probe each capability independently: browsers may expose only part of this API. */
export async function readStorageHealth(storage?: StorageManager): Promise<StorageHealth> {
  try {
    storage ??= typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (!storage) return { ...unavailable };
    const manager = storage;
    const [estimate, persisted] = await Promise.allSettled([
      Promise.resolve().then(() => typeof manager.estimate === "function" ? manager.estimate() : null),
      Promise.resolve().then(() => typeof manager.persisted === "function" ? manager.persisted() : null),
    ]);
    const numbers = estimate.status === "fulfilled" ? estimate.value : null;
    const valid = (n: number | undefined) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
    return { usage: valid(numbers?.usage), quota: valid(numbers?.quota),
      persisted: persisted.status === "fulfilled" ? persisted.value : null,
      canPersist: typeof storage.persist === "function" };
  } catch { return { ...unavailable }; }
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1);
  return `${(bytes / 1024 ** (index + 1)).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[index]}`;
}
