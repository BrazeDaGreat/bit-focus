"use client";

import { CalendarDays, Clock3, Flag, Hash, Folder, Hourglass, X } from "lucide-react";
import type { ParseToken, ParseTokenKind } from "@/lib/task-parse";

const icons = { date: CalendarDays, time: Clock3, priority: Flag, tag: Hash, project: Folder, estimate: Hourglass } satisfies Record<ParseTokenKind, typeof CalendarDays>;

export function ParsePreview({ tokens, onIgnore }: { tokens: ParseToken[]; onIgnore: (key: string) => void }) {
  if (!tokens.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {tokens.map(token => {
        const Icon = icons[token.kind];
        return (
          <span key={`${token.key}:${token.start}`} className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-primary/12 px-2 text-xs text-primary">
            <Icon className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate font-mono tabular-nums">{token.label}</span>
            <button type="button" onClick={() => onIgnore(token.key)} aria-label={`Keep "${token.text}" as text`} title={`Keep "${token.text}" as text`} className="grid size-4 shrink-0 place-items-center rounded-md transition-colors duration-150 hover:bg-primary/12 focus-visible:outline-2 focus-visible:outline-ring">
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
