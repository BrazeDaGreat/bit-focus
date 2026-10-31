"use client";

import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import type { Point } from "./calendar-shared";
import { cn } from "@/lib/utils";

export const PANEL =
  "z-50 w-80 max-w-[calc(100vw-24px)] max-h-[min(85dvh,720px)] overflow-y-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xs outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";

export function AnchoredPanel({
  point,
  children,
  onClose,
  label,
  className,
}: {
  point: Point;
  children: ReactNode;
  onClose: () => void;
  label: string;
  className?: string;
}) {
  return (
    <Popover.Root
      open
      modal
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Popover.Anchor
        style={{
          position: "fixed",
          left: point.x,
          top: point.y,
          width: 1,
          height: 1,
        }}
      />
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(PANEL, className)}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
