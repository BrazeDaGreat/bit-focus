"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import SaveManager, { type ExportedData } from "@/lib/SaveManager";
import { backupPreview } from "@/lib/backup-validation";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

const countLabels = {
  tasks: "Tasks", notes: "Notes (including Trash)", projects: "Projects", milestones: "Milestones",
  issues: "Legacy issues", focusSessions: "Focus sessions", timeblocks: "Calendar blocks", timeblockTemplates: "Day templates",
  rewards: "Rewards", discounts: "Discounts", chats: "AI chats", savedFilters: "Saved task filters",
};

/** One file-restore flow for Settings and the data menu. Reading never mutates data. */
export function useBackupRestore() {
  const [pending, setPending] = useState<{ data: ExportedData; preview: ReturnType<typeof backupPreview> } | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const prepareRestore = async (file: File) => {
    if (locked.current) return;
    toast.dismiss("backup-export");
    locked.current = true;
    setBusy(true);
    setPending(null);
    try {
      const data = await SaveManager.readBackup(file);
      setPending({ data, preview: backupPreview(data) });
    } catch {
      toast.error("That file couldn't be read as a BIT Focus backup. Your data has not changed.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!pending || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await SaveManager.importJSON(pending.data);
      setPending(null);
      toast.success("Backup restored. Reloading to apply it…");
      // Stay locked until reload, so a second restore cannot race this one.
      window.location.reload();
    } catch {
      locked.current = false;
      setBusy(false);
      toast.error("Restore failed. Try again or choose another backup.");
    }
  };

  const preview = pending?.preview;
  const restoreDialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && !locked.current) setPending(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl shadow-xs">
        <DialogHeader>
          <DialogTitle>Restore this backup?</DialogTitle>
          <DialogDescription>
            This replaces your saved data and settings on this device. Your sign-in and device recovery drafts stay on this device.
          </DialogDescription>
        </DialogHeader>
        {preview && <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {Object.entries(preview.counts).map(([key, count]) => (
              <div key={key} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{countLabels[key as keyof typeof countLabels]}</dt>
                <dd className="font-mono font-medium tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
            <p className="font-medium">{preview.files === "included" ? "File collections included" : preview.files === "omitted" ? "Files omitted from this backup" : "Some file collections are omitted"}</p>
            <p>Note images: {preview.noteImages.included ? `${preview.noteImages.count} included. Replaces local note images.` : "omitted. Local note images are kept."}</p>
            <p>Task attachments: {preview.taskAttachments.included ? `${preview.taskAttachments.count} included. Replaces local task attachments.` : "omitted. Only local files belonging to restored tasks are kept."}</p>
            {preview.missingNoteImages > 0 && <p>{preview.missingNoteImages} referenced note image(s) are missing from this file. Images may be unavailable after restoring.</p>}
            {preview.files !== "included" && <p>Use a manual export from the original device for a backup with files.</p>}
          </div>
          <p className="text-xs text-muted-foreground">Settings and saved credentials in the backup will also be restored. Their values are hidden here.</p>
        </>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void restore()}>{busy ? "Restoring…" : "Replace data and restore"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { prepareRestore, restoreDialog, busy };
}
