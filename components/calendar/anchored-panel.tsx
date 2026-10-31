"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import type { AnchorRect, Point } from "./calendar-shared";
import { cn } from "@/lib/utils";

export const PANEL =
  "z-50 w-80 max-w-[calc(100vw-24px)] max-h-[min(calc(100dvh-24px),var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xs outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";

export function AnchoredPanel({
  point,
  rect,
  children,
  onClose,
  label,
  className,
}: {
  point?: Point;
  rect?: AnchorRect;
  children: ReactNode;
  onClose: () => void;
  label: string;
  className?: string;
}) {
  const [viewportWidth, setViewportWidth] = useState(0);
  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);
  // Radix flips right to left when needed. If neither side can hold the editor
  // (a wide day column or a phone), place it below/above the range instead.
  const fitsBeside =
    !rect ||
    !viewportWidth ||
    Math.max(rect.left - 20, viewportWidth - rect.right - 20) >=
      Math.min(380, viewportWidth - 24);
  return (
    <Popover.Root
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Popover.Anchor
        style={{
          position: "fixed",
          left: rect?.left ?? point?.x ?? 12,
          top: rect?.top ?? point?.y ?? 12,
          width: rect ? Math.max(1, rect.right - rect.left) : 1,
          height: rect ? Math.max(1, rect.bottom - rect.top) : 1,
          pointerEvents: "none",
        }}
      />
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          side={rect && fitsBeside ? "right" : "bottom"}
          align={rect && !fitsBeside ? "end" : "start"}
          sideOffset={8}
          avoidCollisions
          collisionPadding={12}
          sticky="always"
          onPointerDownOutside={(event) => {
            // Prevent Radix's second dismissal, not the underlying pointer event.
            // The page consumes this pointer's slot selection after onClose.
            event.preventDefault();
            onClose();
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(PANEL, className)}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
