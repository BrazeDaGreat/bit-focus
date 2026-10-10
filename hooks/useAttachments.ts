"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import db, { type TaskAttachment } from "@/lib/db";

export async function getAttachmentBlob(uid: string): Promise<Blob | undefined> {
  return (await db.taskAttachments.where("uid").equals(uid).first())?.blob;
}

export function useTaskAttachments(taskUid?: string) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const urls = useRef(new Map<string, string>());
  const revokeUrls = useCallback(() => {
    for (const url of urls.current.values()) URL.revokeObjectURL(url);
    urls.current.clear();
  }, []);

  useEffect(() => {
    setAttachments([]);
    if (!taskUid) return;
    const subscription = liveQuery(() => db.taskAttachments.where("taskUid").equals(taskUid).sortBy("createdAt"))
      .subscribe({ next: setAttachments, error: () => toast.error("Could not load attachments") });
    return () => { subscription.unsubscribe(); revokeUrls(); };
  }, [taskUid, revokeUrls]);

  useEffect(() => {
    const live = new Set(attachments.map((attachment) => attachment.uid));
    for (const [uid, url] of urls.current) {
      if (!live.has(uid)) { URL.revokeObjectURL(url); urls.current.delete(uid); }
    }
  }, [attachments]);

  const add = useCallback(async (files: File[]): Promise<TaskAttachment[]> => {
    if (!taskUid) return [];
    const rows: TaskAttachment[] = [];
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) { toast.error(`${file.name} is over 25 MB`); continue; }
      rows.push({ uid: crypto.randomUUID(), taskUid, name: file.name, type: file.type,
        size: file.size, blob: file, createdAt: new Date() });
    }
    if (rows.length) await db.taskAttachments.bulkAdd(rows);
    return rows;
  }, [taskUid]);

  const remove = useCallback(async (uid: string) => {
    if (!taskUid) return;
    await db.taskAttachments.where("uid").equals(uid).and((row) => row.taskUid === taskUid).delete();
    const url = urls.current.get(uid);
    if (url) { URL.revokeObjectURL(url); urls.current.delete(uid); }
  }, [taskUid]);

  const urlFor = useCallback((uid: string) => {
    const attachment = attachments.find((row) => row.uid === uid && row.taskUid === taskUid);
    if (!attachment) return undefined;
    if (!urls.current.has(uid)) urls.current.set(uid, URL.createObjectURL(attachment.blob));
    return urls.current.get(uid);
  }, [attachments, taskUid]);

  return { attachments, add, remove, urlFor };
}

export type TaskAttachmentsState = ReturnType<typeof useTaskAttachments>;
