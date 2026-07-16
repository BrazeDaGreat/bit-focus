/**
 * Focus Table Page
 *
 * Tabular view of every focus session with filtering (search, tags,
 * date range, duration), sortable columns, pagination, bulk actions
 * (delete, re-tag), per-row edit/delete, and CSV export of the
 * filtered set. Reached via the sidebar or the "T" shortcut.
 *
 * @fileoverview Focus sessions table view
 * @author BIT Focus Development Team
 * @since v0.18.11
 */

"use client";

import { useEffect, useState, type JSX } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TagBadge from "@/components/TagBadge";
import { useFocus } from "@/hooks/useFocus";
import { useTag } from "@/hooks/useTag";
import { cn, durationFromSeconds, formatTimeNew } from "@/lib/utils";
import {
  FaAngleLeft,
  FaAngleRight,
  FaArrowDown,
  FaArrowUp,
  FaDownload,
  FaTag,
  FaTrash,
  FaXmark,
} from "react-icons/fa6";
import FocusTableFilters from "./FocusTableFilters";
import FocusTableRow from "./FocusTableRow";
import { exportSessionsCsv } from "./exportCsv";
import { useFocusTable, type SortKey } from "./useFocusTable";

const SORTABLE_COLUMNS: { key: SortKey; label: string; className?: string }[] =
  [
    { key: "tag", label: "Tag" },
    { key: "startTime", label: "Start" },
    { key: "endTime", label: "End" },
    { key: "duration", label: "Duration", className: "text-right" },
  ];

export default function FocusTablePage(): JSX.Element {
  const { focusSessions, loadingFocusSessions, loadFocusSessions } = useFocus();

  useEffect(() => {
    loadFocusSessions();
  }, [loadFocusSessions]);

  const table = useFocusTable(focusSessions);
  const {
    filters,
    setFilters,
    clearFilters,
    sortKey,
    sortDir,
    toggleSort,
    page,
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
  } = table;

  const totalText = formatTimeNew(
    durationFromSeconds(Math.floor(totals.totalMs / 1000)),
    "H:M:S",
    "text"
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selected.has(s.id!));
  const someSelected = selected.size > 0;

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-6 flex flex-col gap-4">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Focus Table
            </p>
            {/* Totals strip — live summary of the filtered set */}
            <p className="text-sm mt-1">
              <span className="font-mono font-semibold tabular-nums">
                {totals.count}
              </span>{" "}
              <span className="text-muted-foreground">
                {totals.count === 1 ? "session" : "sessions"} ·
              </span>{" "}
              <span className="font-mono font-semibold tabular-nums">
                {totalText}
              </span>{" "}
              <span className="text-muted-foreground">total</span>
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={filtered.length === 0}
            onClick={() => exportSessionsCsv(filtered)}
          >
            <FaDownload className="size-3" />
            Export CSV
          </Button>
        </div>

        {/* ── Filter bar / bulk action bar ──────────────────────────── */}
        {someSelected ? (
          <BulkActionBar
            selected={selected}
            clearSelection={clearSelection}
          />
        ) : (
          <FocusTableFilters
            sessions={focusSessions}
            filters={filters}
            setFilters={setFilters}
            clearFilters={clearFilters}
          />
        )}

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-2">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleAllFiltered}
                    disabled={filtered.length === 0}
                    aria-label="Select all filtered sessions"
                  />
                </TableHead>
                {SORTABLE_COLUMNS.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    <button
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 hover:text-foreground transition-colors",
                        sortKey === col.key
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {col.label}
                      {sortKey === col.key &&
                        (sortDir === "asc" ? (
                          <FaArrowUp className="size-2.5" />
                        ) : (
                          <FaArrowDown className="size-2.5" />
                        ))}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingFocusSessions ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-sm text-muted-foreground"
                  >
                    {focusSessions.length === 0
                      ? "No sessions yet. Start the timer to begin tracking."
                      : "No sessions match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((session) => (
                  <FocusTableRow
                    key={session.id}
                    session={session}
                    selected={selected.has(session.id!)}
                    onToggle={toggleRow}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Pagination footer ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              title="Previous page"
            >
              <FaAngleLeft className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= pageCount - 1}
              onClick={() => setPage(page + 1)}
              title="Next page"
            >
              <FaAngleRight className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Action Bar ───────────────────────────────────────────────────────────

function BulkActionBar({
  selected,
  clearSelection,
}: {
  selected: Set<number>;
  clearSelection: () => void;
}): JSX.Element {
  const { bulkRemoveFocusSessions, bulkUpdateTag } = useFocus();
  const { savedTags } = useTag();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [customTag, setCustomTag] = useState("");

  const ids = Array.from(selected);

  const applyTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    await bulkUpdateTag(ids, trimmed);
    setTagPopoverOpen(false);
    setCustomTag("");
    clearSelection();
  };

  const handleDelete = async () => {
    await bulkRemoveFocusSessions(ids);
    setConfirmOpen(false);
    clearSelection();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-full border bg-accent/40 px-4 py-1.5">
      <span className="text-xs font-medium">
        <span className="font-mono tabular-nums">{selected.size}</span>{" "}
        selected
      </span>

      <span className="h-4 w-px bg-border" />

      {/* Change tag */}
      <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <FaTag className="size-3" />
            Change tag
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" align="start">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Apply tag to {selected.size}{" "}
            {selected.size === 1 ? "session" : "sessions"}
          </p>
          {savedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {savedTags.map((t) => (
                <button key={t.t} onClick={() => applyTag(t.t)}>
                  <TagBadge tag={t.t} noHover />
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyTag(customTag)}
              placeholder="Custom tag…"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="shrink-0 h-8"
              onClick={() => applyTag(customTag)}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete */}
      <button
        onClick={() => setConfirmOpen(true)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full text-destructive hover:bg-destructive/10 transition-colors"
      >
        <FaTrash className="size-3" />
        Delete
      </button>

      <span className="flex-1" />

      <button
        onClick={clearSelection}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
      >
        <FaXmark className="size-3" />
        Clear selection
      </button>

      {/* Delete confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} sessions?</DialogTitle>
            <DialogDescription>
              This permanently removes the selected focus{" "}
              {selected.size === 1 ? "session" : "sessions"} and can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
