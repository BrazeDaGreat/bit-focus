"use client";

import { useCurrentBlock } from "@/hooks/useCurrentBlock";
import { cn } from "@/lib/utils";

/** Shares the main app's hooks, including when rendered through the PiP portal. */
export function BlockTimerLine({ className }: { className?: string }) {
  const { current, minutesLeft, titleOf, loading } = useCurrentBlock(15_000);
  if (loading || !current) return null;

  const title = titleOf(current);
  return (
    <p data-block-timer-line className={cn("flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground", className)} title={`${title} · ${minutesLeft}m left`}>
      <span className="truncate">{title}</span>
      <span aria-hidden="true">·</span>
      <span className="shrink-0 font-mono tabular-nums">{minutesLeft}m left</span>
    </p>
  );
}
