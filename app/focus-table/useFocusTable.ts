/**
 * Focus Table Logic Hook
 *
 * Colocated hook powering the Focus Table page: filtering, sorting,
 * pagination, and row selection over the in-memory session list from
 * useFocus. Pure derivation via useMemo — no persistence of its own.
 *
 * @fileoverview Filtering/sorting/pagination/selection for the Focus Table
 * @author BIT Focus Development Team
 * @since v0.18.11
 */

import { useCallback, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import type { FocusSession } from "@/hooks/useFocus";
import dayjs from "dayjs";

export type SortKey = "startTime" | "endTime" | "tag" | "duration";
export type SortDir = "asc" | "desc";

export interface FocusTableFiltersState {
  /** Free-text match against the tag (sessions have no name field) */
  search: string;
  /** Exact-tag multi-select; empty = all tags */
  tags: string[];
  /** Inclusive day range on startTime */
  dateRange: DateRange | undefined;
  /** Minimum duration in minutes */
  minDuration?: number;
  /** Maximum duration in minutes */
  maxDuration?: number;
}

export const EMPTY_FILTERS: FocusTableFiltersState = {
  search: "",
  tags: [],
  dateRange: undefined,
  minDuration: undefined,
  maxDuration: undefined,
};

export function isFilterActive(f: FocusTableFiltersState): boolean {
  return (
    f.search.trim() !== "" ||
    f.tags.length > 0 ||
    f.dateRange?.from !== undefined ||
    f.minDuration !== undefined ||
    f.maxDuration !== undefined
  );
}

export function sessionDurationMs(s: FocusSession): number {
  return Math.max(
    0,
    new Date(s.endTime).getTime() - new Date(s.startTime).getTime()
  );
}

export function useFocusTable(sessions: FocusSession[]) {
  const [filters, setFiltersState] =
    useState<FocusTableFiltersState>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState(25);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const setFilters = useCallback(
    (
      update:
        | Partial<FocusTableFiltersState>
        | ((prev: FocusTableFiltersState) => FocusTableFiltersState)
    ) => {
      setFiltersState((prev) =>
        typeof update === "function" ? update(prev) : { ...prev, ...update }
      );
      setPage(0);
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFiltersState(EMPTY_FILTERS);
    setPage(0);
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      setSortDir((prevDir) =>
        prevKey === key ? (prevDir === "asc" ? "desc" : "asc") : "desc"
      );
      return key;
    });
    setPage(0);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(0);
  }, []);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const tagSet = new Set(filters.tags);
    const from = filters.dateRange?.from
      ? dayjs(filters.dateRange.from).startOf("day")
      : null;
    const to = filters.dateRange?.to
      ? dayjs(filters.dateRange.to).endOf("day")
      : from
      ? dayjs(filters.dateRange!.from).endOf("day")
      : null;

    const result = sessions.filter((s) => {
      if (search && !s.tag.toLowerCase().includes(search)) return false;
      if (tagSet.size > 0 && !tagSet.has(s.tag)) return false;
      if (from && dayjs(s.startTime).isBefore(from)) return false;
      if (to && dayjs(s.startTime).isAfter(to)) return false;
      const minutes = sessionDurationMs(s) / 60000;
      if (filters.minDuration !== undefined && minutes < filters.minDuration)
        return false;
      if (filters.maxDuration !== undefined && minutes > filters.maxDuration)
        return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    result.sort((a, b) => {
      switch (sortKey) {
        case "tag":
          return a.tag.localeCompare(b.tag) * dir;
        case "duration":
          return (sessionDurationMs(a) - sessionDurationMs(b)) * dir;
        case "endTime":
          return (
            (new Date(a.endTime).getTime() - new Date(b.endTime).getTime()) *
            dir
          );
        default:
          return (
            (new Date(a.startTime).getTime() -
              new Date(b.startTime).getTime()) *
            dir
          );
      }
    });

    return result;
  }, [sessions, filters, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [filtered, safePage, pageSize]
  );

  const totals = useMemo(
    () => ({
      count: filtered.length,
      totalMs: filtered.reduce((sum, s) => sum + sessionDurationMs(s), 0),
    }),
    [filtered]
  );

  const toggleRow = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Selects the whole filtered set; unselects it if already fully selected */
  const toggleAllFiltered = useCallback(() => {
    setSelected((prev) => {
      const ids = filtered.map((s) => s.id!).filter((id) => id !== undefined);
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set<number>() : new Set(ids);
    });
  }, [filtered]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  return {
    filters,
    setFilters,
    clearFilters,
    sortKey,
    sortDir,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    filtered,
    pageRows,
    totals,
    selected,
    toggleRow,
    toggleAllFiltered,
    clearSelection,
  };
}
