"use client";

import { useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameYear,
  nextMonday,
} from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDashed,
  Folder,
  X,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import { dateInput } from "@/lib/tasks";

const triggerClass =
  "mt-1.5 flex h-9 w-full items-center gap-2 rounded-lg bg-muted/50 px-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary data-[state=open]:bg-muted disabled:pointer-events-none";

export function ProjectPicker({
  value,
  projects,
  onChange,
}: {
  value: number | null;
  projects: Project[];
  onChange: (projectId: number | null) => void;
}) {
  const current = projects.find((p) => p.id === value);
  const open = projects.filter((p) => p.status !== "Closed");
  const archived = projects.filter((p) => p.status === "Closed");
  const item = (id: number | null, label: string, muted?: boolean) => {
    const selected = value === id;
    const Icon = id === null ? CircleDashed : Folder;
    return (
      <DropdownMenuItem
        key={id ?? "none"}
        role="menuitemradio"
        aria-checked={selected}
        onSelect={() => {
          if (!selected) onChange(id);
        }}
        className={cn("gap-2.5 py-2", muted && "text-muted-foreground")}
      >
        <Icon className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {selected && <Check className="text-primary" />}
      </DropdownMenuItem>
    );
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Task project" className={triggerClass}>
        {current ? (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !current && "text-muted-foreground",
          )}
        >
          {current?.title ?? "No project"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-(--radix-dropdown-menu-trigger-width) min-w-52 rounded-xl p-1"
      >
        {item(null, "No project")}
        {open.length > 0 && <DropdownMenuSeparator />}
        {open.map((p) => item(p.id!, p.title))}
        {archived.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Archived
            </DropdownMenuLabel>
            {archived.map((p) => item(p.id!, p.title, true))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Today", "Tomorrow", "Yesterday", else a short date (year only when not this year). */
function describeDay(date: Date, today: Date) {
  const diff = differenceInCalendarDays(date, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return format(date, isSameYear(date, today) ? "EEE, MMM d" : "MMM d, yyyy");
}

export function DeadlinePicker({
  value,
  overdue,
  onChange,
}: {
  value: Date | null;
  overdue?: boolean;
  /** Local day as YYYY-MM-DD, or null to clear. */
  onChange: (day: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const choose = (day: string | null) => {
    onChange(day);
    setOpen(false);
  };
  const monday = nextMonday(today);
  const quick = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    // On Sundays next Monday is tomorrow, so skip to the one after.
    {
      label: "Next week",
      date:
        differenceInCalendarDays(monday, today) === 1
          ? addDays(monday, 7)
          : monday,
    },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Task deadline" className={triggerClass}>
        <CalendarDays
          className={cn(
            "size-4 shrink-0",
            overdue ? "text-destructive" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !value && "text-muted-foreground",
            overdue && "text-destructive",
          )}
        >
          {value ? describeDay(value, today) : "No deadline"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto rounded-xl p-0">
        <div className="grid grid-cols-3 gap-1 p-2 pb-0">
          {quick.map(({ label, date }) => {
            const selected = !!value && dateInput(value) === dateInput(date);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                aria-label={`${label} (${format(date, "EEEE, MMM d")})`}
                onClick={() => choose(dateInput(date))}
                className={cn(
                  "flex flex-col items-start rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  selected
                    ? "bg-primary/12 text-primary"
                    : "bg-muted/50 hover:bg-muted",
                )}
              >
                <span className="font-medium">{label}</span>
                <span className="font-mono text-[10px] opacity-70">
                  {format(date, "EEE d")}
                </span>
              </button>
            );
          })}
        </div>
        <Calendar
          mode="single"
          selected={value ?? undefined}
          defaultMonth={value ?? today}
          // Re-picking the chosen day just closes; clearing has its own button.
          onSelect={(date) => (date ? choose(dateInput(date)) : setOpen(false))}
          className="bg-transparent"
        />
        {value && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => choose(null)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="size-3.5" />
              Clear deadline
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
