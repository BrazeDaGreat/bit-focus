"use client";

import { Repeat2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { describeTaskRecurrence, type TaskRecurrence } from "@/lib/tasks";

const field = "h-9 rounded-lg bg-muted/50 px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-primary";

export function TaskRepeatPicker({ value, baseDate, onChange }: {
  value?: TaskRecurrence | null;
  baseDate?: Date | null;
  onChange: (rule: TaskRecurrence | null) => void;
}) {
  const base = baseDate ?? new Date();
  return <Popover>
    <PopoverTrigger aria-label="Task repeat" className={`${field} mt-1.5 flex w-full items-center gap-2 text-left`}>
      <Repeat2 className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>{value ? describeTaskRecurrence(value) : "Does not repeat"}</span>
    </PopoverTrigger>
    <PopoverContent align="start" aria-label="Task repeat" className="w-[min(19rem,calc(100vw-2rem))] space-y-3 rounded-2xl p-3 shadow-xs motion-reduce:animate-none">
      <label className="block space-y-1.5 text-xs text-muted-foreground">
        <span>Repeat</span>
        <select aria-label="Repeat frequency" value={value?.freq ?? "none"} className={`${field} w-full text-foreground`} onChange={(event) => {
          const freq = event.target.value;
          onChange(freq === "none" ? null : {
            freq: freq as TaskRecurrence["freq"],
            ...(value?.until ? { until: value.until } : {}),
            ...(freq === "weekly" ? { days: [base.getDay()] } : {}),
            ...(freq === "monthly" ? { dayOfMonth: base.getDate() } : {}),
          });
        }}>
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
      {value && <>
        {value.freq !== "weekdays" && <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Every
          <Input key={`${value.freq}-${value.interval}`} aria-label="Repeat interval" type="number" min={1} max={10000} defaultValue={value.interval ?? 1}
            className="h-9 w-20 rounded-lg bg-muted/50 font-mono tabular-nums" onBlur={(event) => {
              const interval = Number(event.target.value);
              if (Number.isInteger(interval) && interval >= 1 && interval <= 10000) onChange({ ...value, interval });
              else event.target.value = String(value.interval ?? 1);
            }} />
          {value.freq === "daily" ? "days" : value.freq === "weekly" ? "weeks" : "months"}
        </label>}
        {value.freq === "weekly" && <div role="group" aria-label="Repeat weekdays" className="flex gap-1 rounded-xl bg-muted/40 p-1">
          {[1, 2, 3, 4, 5, 6, 0].map(day => {
            const days = value.days?.length ? value.days : [base.getDay()];
            const selected = days.includes(day);
            return <button key={day} type="button" aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]} aria-pressed={selected}
              className={cn("h-8 min-w-0 flex-1 rounded-lg text-xs focus-visible:outline-2 focus-visible:outline-primary", selected ? "bg-primary/12 text-primary" : "hover:bg-muted")}
              onClick={() => { if (!selected || days.length > 1) onChange({ ...value, days: selected ? days.filter(d => d !== day) : [...days, day] }); }}>
              {["S", "M", "T", "W", "T", "F", "S"][day]}
            </button>;
          })}
        </div>}
        <label className="block space-y-1.5 text-xs text-muted-foreground">
          <span>End date (optional)</span>
          <Input aria-label="Repeat end date" type="date" value={value.until ?? ""} className="h-9 rounded-lg bg-muted/50 font-mono tabular-nums"
            onChange={(event) => onChange({ ...value, until: event.target.value || undefined })} />
        </label>
        <p className="text-xs text-muted-foreground">Next task appears on completion, from the previous deadline or completion day. Subtasks are not copied; logged time starts at zero.</p>
        {value.freq === "monthly" && <p className="text-xs text-muted-foreground">Short months use their last day, then return to the original date.</p>}
      </>}
    </PopoverContent>
  </Popover>;
}
