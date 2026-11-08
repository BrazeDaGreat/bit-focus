"use client";

/**
 * Rewards Surface Primitives
 *
 * Control classes and the right-click menu shared by the balance panel, the
 * balance dialog and the review zone. The menu is the dropdown-at-pointer
 * pattern from `calendar-menu`: a hidden trigger is placed where the pointer
 * was, so the same menu opens from a right-click or from a quiet button.
 *
 * @since v0.25.0-beta
 */

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const CONTROL =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";
export const QUIET = `${CONTROL} text-muted-foreground hover:bg-muted/60 hover:text-foreground`;
export const PRIMARY = `${CONTROL} bg-primary text-primary-foreground hover:bg-primary/90`;
export const ICON_BUTTON = `${QUIET} w-10 px-0`;
export const FIELD =
  "h-10 w-full min-w-0 rounded-lg bg-muted/60 px-3 text-sm outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";
export const EYEBROW = "text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground";

export const MENU_SURFACE =
  "z-50 min-w-56 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xs outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";
export const MENU_ITEM =
  "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40";

export interface MenuPoint {
  x: number;
  y: number;
}

/**
 * Where a pointer menu is open, plus handlers that open it.
 *
 * `onContextMenu` goes on the surface; `openFrom` on the quiet button that
 * offers the same menu to touch and keyboard.
 */
export function usePointMenu<T = true>() {
  const [menu, setMenu] = useState<{ point: MenuPoint; target: T } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  function openAt(point: MenuPoint, target: T, from?: EventTarget | null) {
    returnFocus.current = from instanceof HTMLElement ? (from.closest("button,[tabindex]") as HTMLElement | null) : null;
    setMenu({ point, target });
  }

  return {
    menu,
    close: () => setMenu(null),
    returnFocus,
    /** Right-click handler; stops the event so an outer surface keeps its own menu shut. */
    onContextMenu: (target: T) => (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      openAt({ x: event.clientX, y: event.clientY }, target, event.target);
    },
    /** Click handler for a button that opens the menu under itself. */
    openFrom: (target: T) => (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      openAt({ x: rect.left, y: rect.bottom }, target, event.currentTarget);
    },
  };
}

/** A menu that opens at a point. Renders nothing until `point` is set. */
export function PointMenu({
  point,
  onClose,
  label,
  returnFocus,
  children,
}: {
  point: MenuPoint | null;
  onClose: () => void;
  label: string;
  returnFocus?: { current: HTMLElement | null };
  children: ReactNode;
}) {
  return (
    <Menu.Root open={!!point} modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Menu.Trigger
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none fixed size-px opacity-0"
        style={{ left: point?.x ?? 0, top: point?.y ?? 0 }}
      />
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={2}
          collisionPadding={12}
          className={MENU_SURFACE}
          aria-label={label}
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // A dialog opened from the menu takes focus itself.
            if (document.querySelector("[role=dialog]")) return;
            returnFocus?.current?.focus({ preventScroll: true });
          }}
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function MenuItem({
  children,
  onSelect,
  disabled = false,
  destructive = false,
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Menu.Item className={cn(MENU_ITEM, destructive && "text-destructive")} disabled={disabled} onSelect={onSelect}>
      {children}
    </Menu.Item>
  );
}

/** A toggle that keeps the menu open, for switching several in a row. */
export function MenuCheck({
  children,
  checked,
  onChange,
}: {
  children: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Menu.CheckboxItem
      className={MENU_ITEM}
      checked={checked}
      onSelect={(event) => event.preventDefault()}
      onCheckedChange={onChange}
    >
      <span className="flex size-4 items-center">
        <Menu.ItemIndicator>
          <Check className="size-4" />
        </Menu.ItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

export function MenuSub({ label, children, disabled = false }: { label: ReactNode; children: ReactNode; disabled?: boolean }) {
  return (
    <Menu.Sub>
      <Menu.SubTrigger disabled={disabled} className={MENU_ITEM}>
        {label}
        <ChevronRight className="ml-auto size-3.5 shrink-0" />
      </Menu.SubTrigger>
      <Menu.Portal>
        <Menu.SubContent className={MENU_SURFACE} sideOffset={4} collisionPadding={12}>
          {children}
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  );
}

export function MenuSeparator() {
  return <Menu.Separator className="my-1.5 h-px bg-border" />;
}

export function MenuNote({ children }: { children: ReactNode }) {
  return <Menu.Label className="max-w-64 px-3 pb-2 pt-1 text-xs font-normal text-muted-foreground">{children}</Menu.Label>;
}

/** A thin progress track, 0–1. */
export function Track({ value, className, fillClassName }: { value: number; className?: string; fillClassName?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out", fillClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}
