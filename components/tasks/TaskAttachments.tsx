"use client";

import { useRef } from "react";
import { FileText, File, Paperclip, X, Music, Video, Archive } from "lucide-react";
import { toast } from "sonner";
import type { TaskAttachmentsState } from "@/hooks/useAttachments";

function fileSize(size: number) {
  if (size < 1024) return `${size} B`;
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;
}

export function TaskAttachments({ files, disabled = false, onAttach }: {
  files: TaskAttachmentsState;
  disabled?: boolean;
  onAttach?: (files: File[]) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const attach = async (selected: File[]) => {
    try { if (onAttach) await onAttach(selected); else await files.add(selected); }
    catch { toast.error("Could not attach files"); }
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {files.attachments.map((attachment) => {
          const url = files.urlFor(attachment.uid);
          const image = attachment.type.startsWith("image/");
          const Icon = attachment.type.startsWith("audio/") ? Music : attachment.type.startsWith("video/") ? Video :
            /zip|compressed|archive/.test(attachment.type) ? Archive : /text|pdf|document/.test(attachment.type) ? FileText : File;
          return (
            <div key={attachment.uid} className="relative min-w-0 rounded-lg bg-muted/40 p-2">
              <a href={url} target="_blank" rel="noopener noreferrer" download={image ? undefined : attachment.name}
                aria-label={image ? `Open ${attachment.name} full size` : `Download ${attachment.name}`}
                className="block rounded-lg pr-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {image ? (
                  // Local object URLs are deliberately not passed to Next's image optimizer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={attachment.name} className="mb-1.5 h-24 w-full rounded-lg object-cover" />
                ) : <Icon className="mb-1.5 size-4 text-muted-foreground" />}
                <p className="truncate text-xs" title={attachment.name}>{attachment.name}</p>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{fileSize(attachment.size)}</p>
              </a>
              {!disabled && <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => void files.remove(attachment.uid).catch(() => toast.error("Could not remove attachment"))}
                className="absolute right-1 top-1 grid size-7 place-items-center rounded-lg bg-muted/80 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-3.5" />
              </button>}
            </div>
          );
        })}
      </div>
      {!disabled && <button type="button" onClick={() => input.current?.click()}
        className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Paperclip className="size-3.5" />Attach files
      </button>}
      <input ref={input} type="file" multiple className="hidden" aria-label="Choose task attachments" disabled={disabled}
        onChange={(event) => { void attach(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    </div>
  );
}
