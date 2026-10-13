/**
 * Mobile Dock - Bottom Navigation for Phones
 *
 * Replaces the slide-in sidebar on small screens with a native-style tab bar
 * pinned to the bottom edge. The everyday destinations get a tab each; the
 * last tab opens the "More" sheet (the sidebar rendered as a bottom drawer)
 * for everything else: profile, other pages, ambience and theme.
 *
 * The Focus tab doubles as the mobile timer readout: while a session is
 * running or paused it shows the live clock, so the top bar does not need to
 * carry the mini timer on phones.
 *
 * @fileoverview Bottom tab bar shown below the `md` breakpoint.
 * @since v0.23.4-beta
 */

"use client";

import type { JSX } from "react";
import Link from "next/link";
import { FaTableCellsLarge } from "react-icons/fa6";
import { useNavItems } from "@/components/AppSidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { displaySeconds, usePomo } from "@/hooks/PomoContext";
import { cn, formatClock } from "@/lib/utils";

/** Height of the tab row; content reserves this plus the safe area. */
export const DOCK_SPACER_CLASS =
  "h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 md:hidden";

export default function MobileDock(): JSX.Element {
  const { dock, overflow, isActive } = useNavItems();
  const { openMobile, setOpenMobile } = useSidebar();
  const { state } = usePomo();

  const timerActive = state.isRunning || state.elapsedSeconds > 0;
  const moreActive = openMobile || overflow.some((item) => isActive(item.url));

  const tabClass =
    "group flex h-full touch-manipulation flex-col items-center justify-center gap-1 outline-none";

  const indicatorClass = (active: boolean) =>
    cn(
      "relative grid h-8 w-14 place-items-center rounded-full transition-[background-color,color,transform] duration-200 group-active:scale-95 motion-reduce:transition-none [&>svg]:size-[1.125rem]",
      "group-focus-visible:ring-2 group-focus-visible:ring-ring",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground group-hover:bg-muted"
    );

  const labelClass = (active: boolean) =>
    cn(
      "max-w-full truncate px-1 text-[11px] leading-none",
      active ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      <ul
        className="mx-auto grid h-16 max-w-lg px-1"
        style={{ gridTemplateColumns: `repeat(${dock.length + 1}, minmax(0, 1fr))` }}
      >
        {dock.map((item) => {
          const active = isActive(item.url);
          const live = item.url === "/focus" && timerActive;
          return (
            <li key={item.url} className="min-w-0">
              <Link
                href={item.url}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpenMobile(false)}
                className={tabClass}
              >
                <span className={indicatorClass(active)}>
                  {item.icon}
                  {live && (
                    <span
                      className={cn(
                        "absolute right-2.5 top-1 size-2 rounded-full ring-2 ring-background",
                        state.isRunning
                          ? "bg-emerald-500 motion-safe:animate-pulse"
                          : "bg-amber-400"
                      )}
                    />
                  )}
                </span>
                <span
                  role={live ? "timer" : undefined}
                  className={cn(
                    labelClass(active),
                    live && "font-mono font-semibold tabular-nums tracking-tight text-foreground"
                  )}
                >
                  {live ? formatClock(displaySeconds(state)) : item.title}
                </span>
              </Link>
            </li>
          );
        })}

        <li className="min-w-0">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={openMobile}
            onClick={() => setOpenMobile(!openMobile)}
            className={cn(tabClass, "w-full")}
          >
            <span className={indicatorClass(moreActive)}>
              <FaTableCellsLarge />
            </span>
            <span className={labelClass(moreActive)}>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
