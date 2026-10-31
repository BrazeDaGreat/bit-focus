"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  PanelLeft,
  ZoomIn,
  ZoomOut,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL } from "./anchored-panel";
import {
  CONTROL,
  QUIET,
  periodLabel,
  type CalendarFilters,
  type CalendarView,
  type ZoomLevel,
} from "./calendar-shared";

const DEFAULT_FILTERS: CalendarFilters = {
  sessions: true,
  blocks: true,
  deadlines: true,
  hiddenTags: [],
};
const FILTER_KEY = "bit-focus-calendar-show";
export function useCalendarFilters() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(FILTER_KEY) || "null",
      );
      if (stored && typeof stored === "object") {
        const value = stored as Partial<CalendarFilters>;
        setFilters({
          sessions: typeof value.sessions === "boolean" ? value.sessions : true,
          blocks: typeof value.blocks === "boolean" ? value.blocks : true,
          deadlines:
            typeof value.deadlines === "boolean" ? value.deadlines : true,
          hiddenTags: Array.isArray(value.hiddenTags)
            ? value.hiddenTags.filter(
                (tag): tag is string => typeof tag === "string",
              )
            : [],
        });
      }
    } catch {
      /* Private browsing can disable storage. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {
      /* Filters still work for this visit. */
    }
  }, [filters, ready]);
  return [filters, setFilters] as const;
}

interface HeaderProps {
  date: Date;
  view: CalendarView;
  zoom: ZoomLevel;
  onDate: (direction: -1 | 0 | 1) => void;
  onView: (view: CalendarView) => void;
  onZoom: (zoom: ZoomLevel) => void;
  filters: CalendarFilters;
  onFilters: (filters: CalendarFilters) => void;
  tags: { tag: string; color: string }[];
  rail: ReactNode;
}
function Divider() {
  return <span className="mx-1 hidden h-6 w-px bg-border sm:block" />;
}

export function CalendarHeader({
  date,
  view,
  zoom,
  onDate,
  onView,
  onZoom,
  filters,
  onFilters,
  tags,
  rail,
}: HeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-3 md:px-5">
      <div className="md:hidden">
        <Popover.Root modal>
          <Popover.Trigger
            className={cn(QUIET, "w-9 px-0")}
            aria-label="Open plan and review"
          >
            <PanelLeft className="size-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              collisionPadding={12}
              aria-label="Plan and review"
              className={cn(PANEL, "w-80 max-h-[80dvh] p-5")}
            >
              {rail}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <button className={QUIET} onClick={() => onDate(0)}>
        Today
      </button>
      <div className="flex gap-1">
        <button
          className={cn(QUIET, "w-9 px-0")}
          aria-label="Previous period"
          onClick={() => onDate(-1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          className={cn(QUIET, "w-9 px-0")}
          aria-label="Next period"
          onClick={() => onDate(1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <h1 className="min-w-0 flex-1 font-mono text-sm font-semibold tracking-tight tabular-nums">
        {periodLabel(date, view)}
      </h1>
      <Popover.Root>
        <Popover.Trigger className={QUIET}>
          <SlidersHorizontal className="size-4" />
          Show
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            collisionPadding={12}
            className={cn(PANEL, "w-64")}
            aria-label="Calendar visibility"
          >
            <p className="mb-2 text-sm font-semibold">Layers</p>
            {(
              [
                ["sessions", "Focus sessions"],
                ["blocks", "Time blocks"],
                ["deadlines", "Task deadlines"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={cn(QUIET, "w-full justify-between")}
                aria-pressed={filters[key]}
                onClick={() => onFilters({ ...filters, [key]: !filters[key] })}
              >
                {label}
                <Check className={cn("size-4", !filters[key] && "opacity-0")} />
              </button>
            ))}
            {!!tags.length && (
              <>
                <p className="mb-2 mt-5 text-sm font-semibold">Tags</p>
                <div className="max-h-48 overflow-y-auto">
                  {tags.map(({ tag, color }) => {
                    const visible = !filters.hiddenTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        className={cn(QUIET, "w-full justify-start")}
                        aria-pressed={visible}
                        onClick={() =>
                          onFilters({
                            ...filters,
                            hiddenTags: visible
                              ? [...filters.hiddenTags, tag]
                              : filters.hiddenTags.filter(
                                  (item) => item !== tag,
                                ),
                          })
                        }
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="flex-1 truncate text-left">{tag}</span>
                        <Check
                          className={cn(
                            "size-4 shrink-0",
                            !visible && "opacity-0",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <p className="mt-4 rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-mono">D / W / M</span> switch views
              <br />
              <span className="font-mono">T</span> today ·{" "}
              <span className="font-mono">← / →</span> navigate
              <br />
              Drag empty time to plan a block.
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Divider />
      {view !== "month" && (
        <>
          <div className="flex rounded-xl bg-muted/60 p-1">
            {(
              [
                { key: "compact", label: "Compact rows", Icon: ZoomOut },
                { key: "normal", label: "Normal rows", Icon: Search },
                { key: "expanded", label: "Expanded rows", Icon: ZoomIn },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                title={label}
                aria-label={label}
                aria-pressed={zoom === key}
                onClick={() => onZoom(key)}
                className={cn(
                  QUIET,
                  "w-9 px-0",
                  zoom === key && "bg-background text-foreground shadow-xs",
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
          <Divider />
        </>
      )}
      <div className="flex rounded-xl bg-muted/60 p-1">
        {(["day", "week", "month"] as const).map((item) => (
          <button
            key={item}
            className={cn(
              CONTROL,
              "capitalize",
              view === item
                ? "bg-background shadow-xs"
                : "text-muted-foreground hover:bg-muted/60",
            )}
            onClick={() => onView(item)}
            aria-pressed={view === item}
          >
            {item}
          </button>
        ))}
      </div>
    </header>
  );
}
