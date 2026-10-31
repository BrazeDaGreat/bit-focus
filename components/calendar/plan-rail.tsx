"use client";

import { useState, type ReactNode } from "react";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useTimeblocks } from "@/hooks/useTimeblocks";
import type { Task } from "@/lib/tasks";
import { dayKey, expandTimeblocks, templateFromDay } from "@/lib/timeblocks";
import { cn } from "@/lib/utils";
import {
  CONTROL,
  FIELD,
  PRIMARY,
  QUIET,
  durationLabel,
  type CalendarView,
} from "./calendar-shared";

function Zone({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {children}
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function MiniCalendar({
  date,
  onDate,
  range,
}: {
  date: Date;
  onDate: (date: Date) => void;
  range: { start: Date; end: Date };
}) {
  const [offset, setOffset] = useState(0);
  const month = startOfMonth(addMonths(date, offset));
  const first = startOfWeek(month, { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, index) => addDays(first, index));
  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-sm font-semibold tabular-nums">
          {format(month, "MMMM yyyy")}
        </p>
        <div className="flex">
          <button
            className={cn(QUIET, "w-9 px-0")}
            aria-label="Previous month in mini calendar"
            onClick={() => setOffset(offset - 1)}
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            className={cn(QUIET, "w-9 px-0")}
            aria-label="Next month in mini calendar"
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
          <span
            key={index}
            className="grid h-6 place-items-center text-[11px] text-muted-foreground"
          >
            {label}
          </span>
        ))}
        {days.map((day) => (
          <button
            key={dayKey(day)}
            aria-label={format(day, "EEEE, MMMM d, yyyy")}
            aria-current={isSameDay(day, new Date()) ? "date" : undefined}
            aria-pressed={isSameDay(day, date)}
            className={cn(
              "mx-auto grid size-8 place-items-center rounded-lg font-mono text-xs tabular-nums outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
              !isSameMonth(day, month) && "text-muted-foreground/50",
              day >= range.start && day < range.end && "bg-muted/60",
              isSameDay(day, date) &&
                "bg-primary/12 font-semibold text-primary ring-1 ring-primary/30",
            )}
            onClick={() => {
              onDate(day);
              setOffset(0);
            }}
          >
            {format(day, "d")}
          </button>
        ))}
      </div>
    </div>
  );
}

function Templates({
  date,
  view,
  onDate,
}: {
  date: Date;
  view: CalendarView;
  onDate: (date: Date) => void;
}) {
  const {
    templates,
    timeblocks,
    saveTemplate,
    renameTemplate,
    removeTemplate,
    applyTemplate,
  } = useTimeblocks();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rename, setRename] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error("Could not update template");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const occurrences = expandTimeblocks(
      timeblocks,
      startOfDay(date),
      addDays(startOfDay(date), 1),
    ).filter((occurrence) => occurrence.day === dayKey(date));
    if (!occurrences.length) {
      toast.message("No blocks on this day", {
        description: "Plan a block first, then save your routine.",
      });
      return;
    }
    await saveTemplate(name.trim(), templateFromDay(occurrences));
    setSaving(false);
    setName("");
    toast.success("Day saved as template");
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Routines</h3>
        <button
          className={QUIET}
          onClick={() => setSaving(!saving)}
          aria-expanded={saving}
        >
          Save day
        </button>
      </div>
      <label className="block space-y-1.5 text-xs text-muted-foreground">
        <span>
          {view === "day"
            ? "Day to save or fill"
            : "Day to save or fill · pick any day"}
        </span>
        <input
          type="date"
          aria-label="Template day"
          className={cn(FIELD, "font-mono tabular-nums")}
          value={dayKey(date)}
          onChange={(event) => {
            const picked = new Date(`${event.target.value}T00:00:00`);
            if (!isNaN(+picked)) onDate(picked);
          }}
        />
      </label>
      {saving && (
        <form
          className="space-y-2 rounded-xl bg-muted/40 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() && !busy) void run(save);
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Deep work day"
            aria-label="Template name"
            className={FIELD}
          />
          <div className="flex gap-1">
            <button
              type="submit"
              className={PRIMARY}
              disabled={!name.trim() || busy}
            >
              Save template
            </button>
            <button
              type="button"
              className={QUIET}
              onClick={() => setSaving(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {!templates.length && !saving && (
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-sm font-medium">Keep a day that works</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Save its blocks, then reuse them when you need a familiar rhythm.
          </p>
        </div>
      )}
      <div className="space-y-1">
        {templates.map((template) => (
          <div key={template.id} className="rounded-xl bg-muted/40 p-2">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1 px-1">
                <p className="truncate text-sm font-medium">{template.name}</p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {template.blocks.length} blocks
                </p>
              </div>
              <button
                className={cn(QUIET, "w-9 px-0")}
                aria-label={`Manage ${template.name}`}
                aria-expanded={expanded === template.id}
                onClick={() => {
                  setExpanded(expanded === template.id ? null : template.id!);
                  setRename(template.name);
                }}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </div>
            {expanded === template.id && (
              <div className="mt-3 space-y-2">
                <p className="px-1 text-xs text-muted-foreground">Apply to</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: format(date, "EEE d"), count: 1 },
                    { label: "Mon–Fri", count: 5 },
                    { label: "All 7 days", count: 7 },
                  ].map(({ label, count }) => (
                    <button
                      key={count}
                      className={QUIET}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const first =
                            count === 1
                              ? startOfDay(date)
                              : startOfWeek(date, { weekStartsOn: 1 });
                          const added = await applyTemplate(
                            template,
                            Array.from({ length: count }, (_, index) =>
                              addDays(first, index),
                            ),
                          );
                          toast.success(`${added} blocks added`, {
                            description:
                              count === 1
                                ? format(first, "EEEE, MMM d")
                                : `Week of ${format(first, "MMM d")}`,
                          });
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <form
                  className="space-y-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (rename.trim())
                      void run(async () => {
                        await renameTemplate(template.id!, rename);
                        toast.success("Template renamed");
                      });
                  }}
                >
                  <input
                    aria-label={`Rename ${template.name}`}
                    className={FIELD}
                    value={rename}
                    onChange={(event) => setRename(event.target.value)}
                  />
                  <div className="flex gap-1">
                    <button
                      disabled={
                        busy ||
                        !rename.trim() ||
                        rename.trim() === template.name
                      }
                      className={QUIET}
                      type="submit"
                    >
                      Rename
                    </button>
                    <button
                      disabled={busy}
                      className={cn(QUIET, "text-destructive")}
                      type="button"
                      onClick={() =>
                        void run(async () => {
                          await removeTemplate(template.id!);
                          toast.success("Template deleted");
                        })
                      }
                    >
                      Delete template
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface RailProps {
  date: Date;
  view: CalendarView;
  range: { start: Date; end: Date };
  onDate: (date: Date) => void;
  tasks: Task[];
  plannedTasks: Set<string>;
  onPlanTask: (task: Task) => void;
  onDragTask: (task: Task | null) => void;
  canShift: boolean;
  review: {
    total: number;
    count: number;
    tags: { tag: string; minutes: number; color: string }[];
  };
}
export function PlanRail({
  date,
  view,
  range,
  onDate,
  tasks,
  plannedTasks,
  onPlanTask,
  onDragTask,
  canShift,
  review,
}: RailProps) {
  const [query, setQuery] = useState("");
  const [shifting, setShifting] = useState(false);
  const shiftRestOfDay = useTimeblocks((state) => state.shiftRestOfDay);
  const filtered = tasks
    .filter((task) => task.title.toLowerCase().includes(query.toLowerCase()))
    .sort(
      (a, b) =>
        Number(plannedTasks.has(a.uid || "")) -
        Number(plannedTasks.has(b.uid || "")),
    );
  return (
    <div className="space-y-6">
      <Zone>Plan</Zone>
      <MiniCalendar date={date} onDate={onDate} range={range} />
      <section className="space-y-3" aria-label="Unscheduled tasks">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Unscheduled</h3>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        {tasks.length > 6 && (
          <input
            aria-label="Search unscheduled tasks"
            placeholder="Find a task…"
            className={FIELD}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((task) => (
            <div
              key={task.uid || task.id}
              draggable={!!task.uid}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", task.uid || "");
                event.dataTransfer.effectAllowed = "copy";
                onDragTask(task);
              }}
              onDragEnd={() => onDragTask(null)}
              className="group flex items-center gap-1 rounded-lg py-2 pl-1 hover:bg-muted/50"
            >
              <GripVertical
                aria-hidden
                className="size-3 shrink-0 cursor-grab text-muted-foreground/50"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" title={task.title}>
                  {task.title}
                </p>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {durationLabel(task.estimateMinutes || 60)}
                  {plannedTasks.has(task.uid || "") && " · Planned"}
                </p>
              </div>
              <button
                className={cn(QUIET, "px-2")}
                disabled={!task.uid}
                aria-label={`Plan ${task.title}`}
                title="Plan at the next free 15-minute slot on the selected day"
                onClick={() => onPlanTask(task)}
              >
                Plan
              </button>
            </div>
          ))}
          {!filtered.length && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-sm font-medium">
                {query ? "No matching tasks" : "No open tasks"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {query
                  ? "Try another search."
                  : "Drag empty calendar time to plan a block."}
              </p>
            </div>
          )}
        </div>
      </section>
      <Templates date={date} view={view} onDate={onDate} />
      {canShift && (
        <section className="space-y-2 rounded-xl bg-muted/40 p-3">
          <h3 className="text-sm font-semibold">Running late?</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Move today’s current and upcoming blocks together.
          </p>
          <div className="flex flex-wrap gap-1">
            {[15, 30, 60, -15].map((minutes) => (
              <button
                key={minutes}
                disabled={shifting}
                className={cn(
                  CONTROL,
                  "px-2 font-mono tabular-nums text-muted-foreground hover:bg-muted/60",
                )}
                onClick={async () => {
                  setShifting(true);
                  try {
                    const count = await shiftRestOfDay(minutes);
                    toast.success(
                      `${count} ${count === 1 ? "block" : "blocks"} shifted ${minutes < 0 ? "earlier" : "later"}`,
                      {
                        description: `${Math.abs(minutes)} minutes · today only`,
                      },
                    );
                  } catch {
                    toast.error("Could not shift today’s blocks");
                  } finally {
                    setShifting(false);
                  }
                }}
              >
                {minutes === 60
                  ? "+1h"
                  : `${minutes > 0 ? "+" : "−"}${Math.abs(minutes)}m`}
              </button>
            ))}
          </div>
        </section>
      )}
      <Zone>Review</Zone>
      <section aria-label="Focus review" className="space-y-4">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Focus this{" "}
            {view === "day" ? "day" : view === "week" ? "week" : "month"}
          </p>
          <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
            {durationLabel(review.total)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{review.count}</span>{" "}
            sessions ·{" "}
            <span className="font-mono tabular-nums">
              {durationLabel(review.count ? review.total / review.count : 0)}
            </span>{" "}
            avg
          </p>
        </div>
        {review.tags.map(({ tag, minutes, color }) => (
          <div key={tag} className="space-y-1.5">
            <div className="flex justify-between gap-2 text-xs">
              <span className="truncate">{tag}</span>
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {durationLabel(minutes)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${review.total ? (minutes / review.total) * 100 : 0}%`,
                  background: color,
                }}
              />
            </div>
          </div>
        ))}
        {!review.count && (
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-sm font-medium">A fresh stretch of time</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed focus sessions will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
