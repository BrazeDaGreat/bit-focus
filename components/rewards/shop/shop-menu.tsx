"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";

export { Menu };
export const MENU_SURFACE = "z-50 min-w-52 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xs outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";
export const MENU_ITEM = "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[state=open]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40";
export const CONTROL = "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-safe:transition-colors";
export const QUIET = `${CONTROL} text-muted-foreground hover:bg-muted/60`;
export const PRIMARY = `${CONTROL} bg-primary text-primary-foreground hover:bg-primary/90`;
export const FIELD = "h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function Submenu({ label, children }: { label: string; children: ReactNode }) {
  return <Menu.Sub>
    <Menu.SubTrigger className={MENU_ITEM}>{label}<ChevronRight aria-hidden className="ml-auto size-4" /></Menu.SubTrigger>
    <Menu.Portal><Menu.SubContent collisionPadding={12} sideOffset={4} className={MENU_SURFACE}>{children}</Menu.SubContent></Menu.Portal>
  </Menu.Sub>;
}

/** The calendar/task pointer-menu pattern, shared by mouse, keyboard and long press. */
export function ShopContextMenu({ label, className, menu, children }: {
  label: string;
  className?: string;
  menu: ReactNode;
  children: ReactNode | ((open: (event: MouseEvent<HTMLElement>) => void) => ReactNode);
}) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const clearPress = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function open(x: number, y: number, target: EventTarget | null) {
    clearPress();
    previousFocus.current = target instanceof HTMLElement ? target.closest("button") ?? root.current : root.current;
    setPoint({ x, y });
  }
  return <div ref={root} className={className} tabIndex={-1}
    onContextMenu={event => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) return;
      if ((event.target as HTMLElement).closest("input, textarea")) return;
      event.preventDefault(); event.stopPropagation(); open(event.clientX, event.clientY, event.target);
    }}
    onKeyDown={event => {
      if (point || !(event.target instanceof Node) || !root.current?.contains(event.target)) return;
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault(); event.stopPropagation();
        const rect = root.current.getBoundingClientRect(); open(rect.left + 16, rect.bottom, event.target);
      }
    }}
    onPointerDown={event => {
      if (event.pointerType !== "touch" || point || event.defaultPrevented) return;
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) return;
      if ((event.target as HTMLElement).closest("input, textarea")) return;
      event.stopPropagation(); suppressClick.current = false;
      pointer.current = { x: event.clientX, y: event.clientY };
      const { clientX, clientY, target } = event;
      clearPress(); timer.current = setTimeout(() => { suppressClick.current = true; open(clientX, clientY, target); }, 550);
    }}
    onPointerMove={event => { if (pointer.current && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 8) clearPress(); }}
    onPointerUp={clearPress} onPointerCancel={clearPress}
    onClickCapture={event => {
      if (suppressClick.current && root.current?.contains(event.target as Node)) {
        event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
      }
    }}>
    {typeof children === "function" ? children(event => {
      event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); open(rect.left, rect.bottom, event.currentTarget);
    }) : children}
    <Menu.Root open={!!point} modal={false} onOpenChange={value => { if (!value) setPoint(null); }}>
      <Menu.Trigger tabIndex={-1} aria-hidden className="pointer-events-none fixed size-px opacity-0" style={{ left: point?.x ?? 0, top: point?.y ?? 0 }} />
      <Menu.Portal><Menu.Content aria-label={label} align="start" sideOffset={2} collisionPadding={12} className={MENU_SURFACE}
        onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
        onCloseAutoFocus={event => { event.preventDefault(); previousFocus.current?.focus({ preventScroll: true }); }}>
        {menu}
      </Menu.Content></Menu.Portal>
    </Menu.Root>
  </div>;
}
