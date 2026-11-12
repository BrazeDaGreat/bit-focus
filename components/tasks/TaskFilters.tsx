"use client";

import { useRef } from "react";
import { Search } from "lucide-react";
import type { Task } from "@/lib/tasks";
import { EMPTY_TASK_FILTERS, hasTaskFilters, taskSearchTags, type TaskSearchFilters } from "@/lib/task-search";

export function TaskFilters({ tasks, value, onChange }: {
  tasks: Task[];
  value: TaskSearchFilters;
  onChange: (filters: TaskSearchFilters) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const tags = [...new Set(tasks.flatMap(taskSearchTags))].sort((a, b) => a.localeCompare(b));
  const control = "h-10 rounded-lg border bg-background px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-primary";
  return (
    <div role="search" aria-label="Filter tasks" className="mb-4 space-y-2">
      <div className="flex h-10 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/40">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input ref={searchRef} aria-label="Search tasks" placeholder="Search tasks…" value={value.text} onChange={(event) => onChange({ ...value, text: event.target.value })} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm" />
        {hasTaskFilters(value) && <button type="button" onClick={() => { onChange(EMPTY_TASK_FILTERS); searchRef.current?.focus(); }} className="h-8 shrink-0 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary">Clear filters</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by tag" value={value.tag} onChange={(event) => onChange({ ...value, tag: event.target.value })} className={`${control} min-w-24 max-w-full flex-1 sm:flex-none sm:max-w-48`}>
          <option value="">All tags</option>
          {value.tag && !tags.includes(value.tag) && <option value={value.tag}>#{value.tag}</option>}
          {tags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}
        </select>
        <select aria-label="Filter by priority" value={value.priority} onChange={(event) => onChange({ ...value, priority: event.target.value })} className={`${control} min-w-24 flex-1 sm:flex-none`}>
          <option value="">All priorities</option>
          {["None", "Low", "Medium", "High"].map((label, index) => <option key={label} value={String(index)}>{label}</option>)}
        </select>
        <button type="button" aria-pressed={value.overdue} onClick={() => onChange({ ...value, overdue: !value.overdue })} className={`${control} ${value.overdue ? "border-destructive/40 bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted/60"}`}>Overdue only</button>
      </div>
    </div>
  );
}
