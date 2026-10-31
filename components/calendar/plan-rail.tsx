"use client";

import { useState, type ReactNode } from "react";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useTimeblocks } from "@/hooks/useTimeblocks";
import { useProjects } from "@/hooks/useProjects";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import type { Task } from "@/lib/tasks";
import { dayKey } from "@/lib/timeblocks";
import { cn } from "@/lib/utils";
import {
  CONTROL,
  FIELD,
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
  const projects = useProjects((state) => state.projects);
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
          {filtered.map((task) => {
            const project = projects.find((item) => item.id === task.projectId);
            return (
            <div
              key={task.uid || task.id}
              draggable={!!task.uid}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", task.uid || "");
                event.dataTransfer.effectAllowed = "copy";
                onDragTask(task);
              }}
              onDragEnd={() => onDragTask(null)}
              // No visible button: drag it onto the grid, or press Enter to
              // drop it into the next free slot.
              tabIndex={task.uid ? 0 : -1}
              aria-label={`${task.title}. Drag onto the calendar, or press Enter to plan it in the next free slot.`}
              title="Drag onto the calendar"
              onKeyDown={(event) => {
                if (event.key === "Enter" && task.uid) {
                  event.preventDefault();
                  onPlanTask(task);
                }
              }}
              className="group flex cursor-grab items-center gap-1 rounded-lg py-2 pl-1 pr-2 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            >
              <GripVertical
                aria-hidden
                className="size-3 shrink-0 cursor-grab text-muted-foreground/50"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" title={task.title}>
                  {task.title}
                </p>
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="shrink-0 font-mono tabular-nums">{durationLabel(task.estimateMinutes || 60)}</span>
                  {project && <span className="inline-flex min-w-0 items-center gap-1" title={project.title}>
                    <ProjectIcon name={project.icon} className="size-3 shrink-0" />
                    <span className="truncate">{project.title}</span>
                  </span>}
                  {plannedTasks.has(task.uid || "") && <span className="shrink-0">· Planned</span>}
                </div>
              </div>
            </div>
            );
          })}
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
