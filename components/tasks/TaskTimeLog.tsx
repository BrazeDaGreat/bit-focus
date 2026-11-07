"use client";

import { useState } from "react";
import { Clock3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useTasks } from "@/hooks/useTasks";
import { formatMinutes, parseLoggedMinutes, type Task } from "@/lib/tasks";

const quiet = "h-8 rounded-lg px-2.5 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";

export function TaskTimeLog({ task, open: controlledOpen, onOpenChange, triggerClassName, onReturnFocus }: {
  task: Task;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  onReturnFocus?: () => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger tabIndex={triggerClassName ? -1 : undefined} aria-hidden={triggerClassName ? true : undefined} className={triggerClassName ?? `${quiet} inline-flex items-center gap-1.5 bg-muted/50`} aria-label="Log time on task">
      <Clock3 className="size-3.5" />Log time
    </PopoverTrigger>
    <PopoverContent align="start" aria-label="Log time" className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-3 shadow-xs motion-reduce:animate-none" onCloseAutoFocus={onReturnFocus ? (event) => { event.preventDefault(); onReturnFocus(); } : undefined}>
      {open && <TimeLogForm task={task} />}
    </PopoverContent>
  </Popover>;
}

function TimeLogForm({ task }: { task: Task }) {
  const { logTime, updateTask } = useTasks();
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(minutes: number | null, replace = false) {
    if (busy || task.id == null) return;
    if (minutes === null) { setError("Enter a duration such as 2h, 90m or 1h30."); return; }
    setBusy(true);
    setError("");
    try {
      if (replace) await updateTask(task.id, { loggedMinutes: minutes });
      else await logTime(task.id, minutes);
      setValue("");
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not log time");
    } finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-1">
      <p className="text-sm font-semibold">Log time</p>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatMinutes(task.loggedMinutes ?? 0)} logged</span>
    </div>
    <div className="flex gap-1 rounded-xl bg-muted/40 p-1">
      {[15, 30, 60].map(minutes => <button key={minutes} type="button" disabled={busy} className={`${quiet} flex-1 font-mono tabular-nums`} onClick={() => void save(minutes)}>+{formatMinutes(minutes)}</button>)}
    </div>
    <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void save(parseLoggedMinutes(value), editing); }}>
      <label className="block space-y-1.5 text-xs text-muted-foreground">
        <span>{editing ? "Logged total" : "Add time"}</span>
        <Input autoFocus aria-label={editing ? "Logged total" : "Time to log"} value={value} disabled={busy} placeholder="2h, 90m, 1h30" className="h-9 rounded-lg bg-muted/50 font-mono tabular-nums" onChange={(event) => setValue(event.target.value)} aria-invalid={!!error} />
      </label>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-1">
        <button type="submit" disabled={busy || !value.trim()} className={`${quiet} bg-primary text-primary-foreground hover:bg-primary/90`}>{editing ? "Save total" : "Add time"}</button>
        <button type="button" disabled={busy} className={quiet} onClick={() => { setEditing(!editing); setValue(editing ? "" : `${task.loggedMinutes ?? 0}m`); setError(""); }}>{editing ? "Cancel" : "Edit total"}</button>
        {!!task.loggedMinutes && <button type="button" disabled={busy} className={quiet} onClick={() => void save(0, true)}>Clear</button>}
      </div>
    </form>
    <p className="text-xs text-muted-foreground">Counts toward task time only. Focus sessions, stats and rewards stay unchanged.</p>
  </div>;
}
