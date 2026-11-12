"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BACKUP_HEALTH_EVENT, LAST_COMPLETE_BACKUP_KEY, LAST_COMPLETE_BACKUP_SOURCE_KEY, formatStorageBytes, lastCompleteBackupAt, lastCompleteBackupSource, readStorageHealth, type StorageHealth as Health } from "@/lib/storage-health";

export default function StorageHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [source, setSource] = useState<"download" | "discord">("download");
  const [requesting, setRequesting] = useState(false);
  const requestLock = useRef(false);
  const refresh = useCallback(async () => {
    setLastBackup(lastCompleteBackupAt());
    setSource(lastCompleteBackupSource());
    setHealth(await readStorageHealth());
  }, []);

  useEffect(() => {
    let active = true;
    const update = async () => {
      const next = await readStorageHealth();
      if (active) { setHealth(next); setLastBackup(lastCompleteBackupAt()); setSource(lastCompleteBackupSource()); }
    };
    const visible = () => { if (document.visibilityState === "visible") void update(); };
    const storageChanged = (event: StorageEvent) => { if (event.key === LAST_COMPLETE_BACKUP_KEY || event.key === LAST_COMPLETE_BACKUP_SOURCE_KEY || event.key === null) void update(); };
    void update();
    window.addEventListener("focus", update);
    window.addEventListener(BACKUP_HEALTH_EVENT, update);
    window.addEventListener("storage", storageChanged);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("focus", update);
      window.removeEventListener(BACKUP_HEALTH_EVENT, update);
      window.removeEventListener("storage", storageChanged);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const keepStorage = async () => {
    if (requestLock.current) return;
    requestLock.current = true;
    setRequesting(true);
    try {
      const granted = await navigator.storage.persist();
      toast[granted ? "success" : "info"](granted ? "Browser storage protection enabled." : "Your browser did not enable storage protection. Keep a backup file too.");
    } catch { toast.error("Storage protection is unavailable. Keep a backup file too."); }
    finally { await refresh(); requestLock.current = false; setRequesting(false); }
  };

  const usage = health?.usage;
  const quota = health?.quota;
  return (
    <div className="mb-4 space-y-4 border-b pb-4">
      <div role="group" aria-label="Browser storage" className="space-y-1">
        <p className="text-sm font-medium">Browser storage</p>
        <p className="text-sm tabular-nums">
          {!health ? "Checking storage…" : usage !== null && usage !== undefined
            ? `${formatStorageBytes(usage)} used${quota !== null && quota !== undefined ? ` of ${formatStorageBytes(quota)}` : " · capacity unavailable"}`
            : "Storage estimate unavailable"}
        </p>
        {usage !== null && usage !== undefined && quota != null && quota > 0 && (
          <div role="meter" aria-label="Estimated browser storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(usage / quota * 100))} className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, usage / quota * 100)}%` }} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">Estimates cover this site in this browser; available space can change.</p>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">{!health ? "Checking storage protection…" : health.persisted === true
            ? "Protected from automatic browser cleanup. Clearing site data still removes it."
            : health.persisted === false ? "Browser storage may be cleared automatically when space is low."
              : "Storage protection status unavailable in this browser."}</p>
          {health?.canPersist && health.persisted !== true && <Button variant="outline" size="sm" disabled={requesting} onClick={() => void keepStorage()}>{requesting ? "Requesting…" : "Keep browser storage"}</Button>}
        </div>
      </div>
      <div role="group" aria-label="Last complete backup" className="space-y-1">
        <p className="text-sm font-medium">Last complete backup</p>
        <p className="text-sm">{lastBackup ? `${source === "discord" ? "Uploaded to Discord" : "Download started"} ${dayjs(lastBackup).format("MMM D, YYYY, h:mm A")}` : "No complete backup recorded on this device"}</p>
        <p className="text-xs text-muted-foreground">Includes note images and task attachments. {lastBackup && source === "discord" ? "Check the attachment in Discord and keep a separate copy too." : "Check your downloads and keep a copy elsewhere. BIT Focus cannot confirm the file was saved."} Automatic backups without files do not count.</p>
      </div>
    </div>
  );
}
