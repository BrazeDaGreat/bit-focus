/**
 * Focus Table Filter Bar
 *
 * Pill-styled filter controls for the Focus Table page: free-text search,
 * tag multi-select, start-date range, and duration bounds. Mirrors the
 * rounded-pill control vernacular of the Focus page.
 *
 * @fileoverview Filter controls for the Focus Table
 * @author BIT Focus Development Team
 * @since v0.18.11
 */

"use client";

import { useMemo, type JSX } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import TagBadge from "@/components/TagBadge";
import { useTag } from "@/hooks/useTag";
import type { FocusSession } from "@/hooks/useFocus";
import { cn } from "@/lib/utils";
import { FaChevronDown, FaMagnifyingGlass, FaXmark } from "react-icons/fa6";
import dayjs from "dayjs";
import {
  isFilterActive,
  type FocusTableFiltersState,
} from "./useFocusTable";

interface FocusTableFiltersProps {
  sessions: FocusSession[];
  filters: FocusTableFiltersState;
  setFilters: (update: Partial<FocusTableFiltersState>) => void;
  clearFilters: () => void;
}

function FilterPill({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <PopoverTrigger asChild>
      <button
        className={cn(
          "flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors",
          active
            ? "bg-accent text-foreground border-border font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border-border/60"
        )}
      >
        {children}
        <FaChevronDown className="size-2.5 opacity-60" />
      </button>
    </PopoverTrigger>
  );
}

export default function FocusTableFilters({
  sessions,
  filters,
  setFilters,
  clearFilters,
}: FocusTableFiltersProps): JSX.Element {
  const { savedTags } = useTag();

  // Union of saved tags and every tag actually present in the data
  const allTags = useMemo(() => {
    const names = new Set<string>(savedTags.map((t) => t.t));
    for (const s of sessions) if (s.tag) names.add(s.tag);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [savedTags, sessions]);

  const toggleTag = (tag: string) => {
    setFilters({
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    });
  };

  const dateLabel = filters.dateRange?.from
    ? filters.dateRange.to &&
      !dayjs(filters.dateRange.to).isSame(filters.dateRange.from, "day")
      ? `${dayjs(filters.dateRange.from).format("MMM D")} – ${dayjs(
          filters.dateRange.to
        ).format("MMM D")}`
      : dayjs(filters.dateRange.from).format("MMM D, YYYY")
    : "Date";

  const durationLabel =
    filters.minDuration !== undefined || filters.maxDuration !== undefined
      ? `${filters.minDuration ?? 0}–${filters.maxDuration ?? "∞"} min`
      : "Duration";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder="Search tags…"
          className="h-8 w-44 rounded-full pl-8 text-xs"
        />
      </div>

      {/* Tag multi-select */}
      <Popover>
        <FilterPill active={filters.tags.length > 0}>
          {filters.tags.length > 0
            ? `Tags · ${filters.tags.length}`
            : "Tags"}
        </FilterPill>
        <PopoverContent className="w-60 p-3" align="start">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Filter by tag
          </p>
          {allTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tags yet.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {allTags.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    checked={filters.tags.includes(tag)}
                    onCheckedChange={() => toggleTag(tag)}
                  />
                  <TagBadge tag={tag} />
                </label>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Date range */}
      <Popover>
        <FilterPill active={filters.dateRange?.from !== undefined}>
          {dateLabel}
        </FilterPill>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={filters.dateRange}
            onSelect={(range) => setFilters({ dateRange: range })}
            numberOfMonths={1}
          />
          {filters.dateRange?.from && (
            <button
              onClick={() => setFilters({ dateRange: undefined })}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-2 border-t transition-colors"
            >
              Clear dates
            </button>
          )}
        </PopoverContent>
      </Popover>

      {/* Duration bounds */}
      <Popover>
        <FilterPill
          active={
            filters.minDuration !== undefined ||
            filters.maxDuration !== undefined
          }
        >
          {durationLabel}
        </FilterPill>
        <PopoverContent className="w-56 p-3" align="start">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Duration (minutes)
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={filters.minDuration ?? ""}
              onChange={(e) =>
                setFilters({
                  minDuration:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="Min"
              className="h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              value={filters.maxDuration ?? ""}
              onChange={(e) =>
                setFilters({
                  maxDuration:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="Max"
              className="h-8 text-xs"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all */}
      {isFilterActive(filters) && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
        >
          <FaXmark className="size-3" />
          Clear filters
        </button>
      )}
    </div>
  );
}
