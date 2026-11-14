"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { Group, Row, SettingsButton, Well } from "@/components/settings/parts";
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
  const hasUsage = usage !== null && usage !== undefined;
  const protection = !health ? "Checking protection…" : health.persisted === true
    ? "Protected from automatic cleanup."
    : health.persisted === false ? "May be cleared when space runs low."
      : "Protection status unavailable.";
  return (
    <Group title="Storage">
      <Well>
        <Row role="group" aria-label="Browser storage" label="Browser storage" hint={protection}>
          {health?.canPersist && health.persisted !== true && (
            <SettingsButton disabled={requesting} onClick={() => void keepStorage()}>{requesting ? "Requesting…" : "Keep browser storage"}</SettingsButton>
          )}
          <div className="flex basis-full flex-col gap-1.5">
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {!health ? "Checking storage…" : hasUsage
                ? `${formatStorageBytes(usage)} used${quota !== null && quota !== undefined ? ` of ${formatStorageBytes(quota)}` : " · capacity unavailable"}`
                : "Storage estimate unavailable"}
            </p>
            {hasUsage && quota != null && quota > 0 && (
              <div role="meter" aria-label="Estimated browser storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(usage / quota * 100))} className="h-1.5 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, usage / quota * 100)}%` }} />
              </div>
            )}
          </div>
        </Row>
        <Row role="group" aria-label="Last complete backup" label="Last complete backup"
          hint={lastBackup && source === "discord" ? "Includes files. Keep a copy outside Discord too." : "Includes files. Keep the download somewhere other than this browser."}>
          <span className="text-xs tabular-nums text-muted-foreground">
            {lastBackup ? `${source === "discord" ? "Uploaded to Discord" : "Download started"} ${dayjs(lastBackup).format("MMM D, h:mm A")}` : "No complete backup recorded on this device"}
          </span>
        </Row>
      </Well>
    </Group>
  );
}
