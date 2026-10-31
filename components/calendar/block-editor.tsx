"use client";

import { useState } from "react";
import { format, isValid, parse } from "date-fns";
import { Link2, Play, Repeat2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { TimeBlock, TimeblockRecurrence } from "@/lib/db";
import type { Task } from "@/lib/tasks";
import type { SavedTag } from "@/hooks/useTag";
import type { SeriesScope } from "@/hooks/useTimeblocks";
import {
  describeRecurrence,
  minutesBetween,
  pomodoroHint,
  type TimeblockOccurrence,
} from "@/lib/timeblocks";
import { cn, getTagColor } from "@/lib/utils";
import { AnchoredPanel } from "./anchored-panel";
import {
  CONTROL,
  FIELD,
  PRIMARY,
  QUIET,
  softTag,
  type Point,
} from "./calendar-shared";

export interface EditorTarget {
  start: Date;
  end: Date;
  point: Point;
  occurrence?: TimeblockOccurrence;
}
interface EditorProps {
  target: EditorTarget;
  tasks: Task[];
  savedTags: SavedTag[];
  settings: { focusDuration: number; breakDuration: number };
  now: Date;
  onSave: (updates: Partial<TimeBlock>, scope: SeriesScope) => Promise<void>;
  onDelete: (scope: SeriesScope) => Promise<void>;
  onStart: () => void;
  onClose: () => void;
}

export function SeriesChoice({
  action,
  busy,
  onChoose,
  onCancel,
}: {
  action: string;
  busy?: boolean;
  onChoose: (scope: SeriesScope) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="space-y-2 rounded-xl bg-muted/60 p-3"
      role="group"
      aria-label="Choose series scope"
    >
      <p className="text-sm font-medium">{action}</p>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={busy}
          className={PRIMARY}
          onClick={() => onChoose("this")}
        >
          Only this one
        </button>
        <button
          type="button"
          disabled={busy}
          className={QUIET}
          onClick={() => onChoose("all")}
        >
          All in series
        </button>
        <button
          type="button"
          disabled={busy}
          className={QUIET}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function BlockEditor({
  target,
  tasks,
  savedTags,
  settings,
  now,
  onSave,
  onDelete,
  onStart,
  onClose,
}: EditorProps) {
  const original = target.occurrence?.block;
  const [title, setTitle] = useState(original?.title || "");
  const [taskUid, setTaskUid] = useState(original?.taskUid || "");
  const [tag, setTag] = useState(original?.tag || "Focus");
  const [startDate, setStartDate] = useState(
    format(target.start, "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(format(target.end, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(target.start, "HH:mm"));
  const [endTime, setEndTime] = useState(format(target.end, "HH:mm"));
  const [repeat, setRepeat] = useState<TimeblockRecurrence["freq"] | "none">(
    original?.recurrence?.freq || "none",
  );
  const [days, setDays] = useState(
    original?.recurrence?.days?.length
      ? original.recurrence.days
      : [target.start.getDay()],
  );
  const [until, setUntil] = useState(original?.recurrence?.until || "");
  const [timer, setTimer] = useState<"keep" | "standard" | "pomodoro">(
    original?.timerMode || "keep",
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scopeAction, setScopeAction] = useState<"save" | "delete" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const linkedTask = tasks.find((task) => task.uid === taskUid);
  const start = parse(
    `${startDate} ${startTime}`,
    "yyyy-MM-dd HH:mm",
    new Date(),
  );
  const end = parse(`${endDate} ${endTime}`, "yyyy-MM-dd HH:mm", new Date());
  const valid =
    isValid(start) &&
    isValid(end) &&
    end > start &&
    !!tag.trim() &&
    (repeat !== "weekly" || !!days.length) &&
    (!until || until >= startDate);
  const hint = valid
    ? pomodoroHint(minutesBetween(start, end), settings)
    : null;
  const isHappening =
    !!target.occurrence && target.start <= now && target.end > now;

  async function perform(action: "save" | "delete", scope: SeriesScope) {
    setBusy(true);
    try {
      if (action === "delete") await onDelete(scope);
      else {
        const updates: Partial<TimeBlock> = {
          title: taskUid
            ? linkedTask?.title || title
            : title.trim() || undefined,
          tag: tag.trim(),
          taskUid: taskUid || undefined,
          startTime: start,
          endTime: end,
          timerMode: timer === "keep" ? undefined : timer,
        };
        // A one-off edit must stay detached; copying a rule would create a second series.
        if (original?.recurrence || repeat !== "none")
          updates.recurrence =
            target.occurrence?.recurring && scope === "this"
              ? undefined
              : repeat === "none"
                ? undefined
                : {
                    freq: repeat,
                    ...(repeat === "weekly" ? { days } : {}),
                    ...(until ? { until } : {}),
                  };
        await onSave(updates, scope);
      }
      onClose();
    } catch {
      toast.error(
        action === "save" ? "Could not save block" : "Could not delete block",
      );
    } finally {
      setBusy(false);
    }
  }
  function request(action: "save" | "delete") {
    if (target.occurrence?.recurring) setScopeAction(action);
    else void perform(action, "this");
  }

  return (
    <AnchoredPanel
      point={target.point}
      onClose={onClose}
      label={original ? "Edit time block" : "Plan time block"}
      className="w-[360px]"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy) request("save");
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            {original ? "Edit time block" : "Plan time block"}
          </h2>
          <button
            type="button"
            className={cn(QUIET, "w-9 px-0")}
            aria-label="Close block editor"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-2">
          <label
            className="block text-xs text-muted-foreground"
            htmlFor="block-title"
          >
            {taskUid ? "Linked task" : "Title"}
          </label>
          {taskUid ? (
            <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
              <span className="min-w-0 flex-1 truncate px-2 text-sm">
                {linkedTask?.title || title || "Linked task"}
              </span>
              <button
                type="button"
                className={cn(QUIET, "w-9 px-0")}
                aria-label="Unlink task"
                onClick={() => setTaskUid("")}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <input
              id="block-title"
              autoFocus
              placeholder="What will you work on?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={FIELD}
            />
          )}
          <button
            type="button"
            className={QUIET}
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen(!pickerOpen)}
          >
            <Link2 className="size-4" />
            {taskUid ? "Change linked task" : "Link a task"}
          </button>
          {pickerOpen && (
            <div className="space-y-1 rounded-xl bg-muted/40 p-2">
              <input
                className={FIELD}
                aria-label="Search tasks to link"
                placeholder="Find a task…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="max-h-36 overflow-y-auto">
                {tasks
                  .filter(
                    (task) =>
                      task.uid &&
                      task.title.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((task) => (
                    <button
                      type="button"
                      key={task.uid}
                      className={cn(
                        QUIET,
                        "h-auto min-h-9 w-full justify-start py-2 text-left",
                      )}
                      onClick={() => {
                        setTaskUid(task.uid!);
                        setTitle(task.title);
                        setTag(task.primaryTag || task.tags[0] || "Focus");
                        setPickerOpen(false);
                      }}
                    >
                      {task.title}
                    </button>
                  ))}
                {!tasks.some(
                  (task) =>
                    task.uid &&
                    task.title.toLowerCase().includes(query.toLowerCase()),
                ) && (
                  <p className="p-2 text-xs text-muted-foreground">
                    No open tasks match. Try another search.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="block-tag" className="text-xs text-muted-foreground">
            Tag
          </label>
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            {savedTags.map(({ t }) => (
              <button
                key={t}
                type="button"
                className={cn(
                  CONTROL,
                  "h-9 max-w-full",
                  tag === t && "ring-1 ring-ring",
                )}
                style={{ background: softTag(getTagColor(savedTags, t)[0]) }}
                aria-pressed={tag === t}
                onClick={() => setTag(t)}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: getTagColor(savedTags, t)[0] }}
                />
                <span className="truncate">{t}</span>
              </button>
            ))}
          </div>
          <input
            id="block-tag"
            className={FIELD}
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="Choose or type a tag"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label
              htmlFor="block-start-date"
              className="text-xs text-muted-foreground"
            >
              Start
            </label>
            <input
              id="block-start-date"
              aria-label="Start date"
              type="date"
              className={cn(FIELD, "font-mono tabular-nums")}
              value={startDate}
              required
              onChange={(event) => {
                const value = event.target.value;
                setStartDate(value);
                if (endDate === startDate || endDate < value) setEndDate(value);
              }}
            />
            <input
              aria-label="Start time"
              type="time"
              className={cn(FIELD, "font-mono tabular-nums")}
              value={startTime}
              required
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="block-end-date"
              className="text-xs text-muted-foreground"
            >
              End
            </label>
            <input
              id="block-end-date"
              aria-label="End date"
              type="date"
              className={cn(FIELD, "font-mono tabular-nums")}
              value={endDate}
              required
              onChange={(event) => setEndDate(event.target.value)}
            />
            <input
              aria-label="End time"
              type="time"
              className={cn(FIELD, "font-mono tabular-nums")}
              value={endTime}
              required
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
        </div>
        {!valid && (
          <p className="text-xs text-destructive">
            Choose a tag, an end after the start, and valid repeat dates.
          </p>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs text-muted-foreground">Repeat</legend>
          <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
            {(
              [
                { value: "none", label: "Does not repeat" },
                { value: "daily", label: "Every day" },
                { value: "weekdays", label: "Weekdays" },
                { value: "weekly", label: "Weekly" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={cn(
                  QUIET,
                  repeat === value && "bg-background text-foreground shadow-xs",
                )}
                aria-pressed={repeat === value}
                onClick={() => setRepeat(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {repeat === "weekly" && (
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((day, index) => (
                <button
                  key={day}
                  type="button"
                  className={cn(
                    QUIET,
                    "w-9 px-0 font-mono",
                    days.includes(day) && "bg-muted text-foreground",
                  )}
                  aria-label={
                    [
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ][index]
                  }
                  aria-pressed={days.includes(day)}
                  onClick={() =>
                    setDays(
                      days.includes(day)
                        ? days.filter((value) => value !== day)
                        : [...days, day],
                    )
                  }
                >
                  {["M", "T", "W", "T", "F", "S", "S"][index]}
                </button>
              ))}
            </div>
          )}
          {repeat !== "none" && (
            <>
              <label
                className="block text-xs text-muted-foreground"
                htmlFor="block-until"
              >
                Until (optional)
              </label>
              <input
                id="block-until"
                type="date"
                min={startDate}
                className={cn(FIELD, "font-mono tabular-nums")}
                value={until}
                onChange={(event) => setUntil(event.target.value)}
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Repeat2 className="size-3" />
                {describeRecurrence(
                  { freq: repeat, days },
                  isValid(start) ? start : target.start,
                )}
              </p>
            </>
          )}
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs text-muted-foreground">Timer</legend>
          <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
            {(
              [
                { value: "keep", label: "Keep current" },
                { value: "pomodoro", label: "Pomodoro" },
                { value: "standard", label: "Standard" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={cn(
                  QUIET,
                  "px-2",
                  timer === value && "bg-background text-foreground shadow-xs",
                )}
                aria-pressed={timer === value}
                onClick={() => setTimer(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
            {hint
              ? `${hint.label} · ${minutesBetween(start, end)} min planned`
              : valid
                ? `${minutesBetween(start, end)} min planned`
                : "Set block times to see a Pomodoro estimate"}
          </p>
        </fieldset>
        {scopeAction ? (
          <SeriesChoice
            action={scopeAction === "save" ? "Save changes to…" : "Delete…"}
            busy={busy}
            onChoose={(scope) => void perform(scopeAction, scope)}
            onCancel={() => setScopeAction(null)}
          />
        ) : (
          <div className="flex flex-wrap gap-1">
            <button className={PRIMARY} disabled={!valid || busy} type="submit">
              {busy ? "Saving…" : original ? "Save changes" : "Create block"}
            </button>
            {isHappening && (
              <button type="button" className={QUIET} onClick={onStart}>
                <Play className="size-4" />
                Start block
              </button>
            )}
            {original && (
              <button
                type="button"
                className={cn(QUIET, "text-destructive")}
                disabled={busy}
                onClick={() => request("delete")}
              >
                <Trash2 className="size-4" />
                Delete block
              </button>
            )}
          </div>
        )}
      </form>
    </AnchoredPanel>
  );
}
