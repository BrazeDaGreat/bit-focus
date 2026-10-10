"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, format, isWeekend, startOfDay } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { dateInput, isTaskOverdue, taskDeadline, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function DeadlineRunway({
  tasks,
  onOpenTask,
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}) {
  const today = startOfDay(new Date());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const live = tasks.filter((task) => !task.deletedAt);
  const overdue = live.filter((task) => isTaskOverdue(task));
  return (
    <section aria-label="Deadline runway" className="mb-5 min-w-0">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-xs text-muted-foreground">Deadline runway</h2>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          <span className="min-[480px]:hidden">
            Next <span className="font-mono tabular-nums">7</span> days
          </span>
          <span className="hidden min-[480px]:inline">
            Next <span className="font-mono tabular-nums">14</span> days
          </span>
        </span>
      </div>
      <div className="flex min-w-0 gap-1 rounded-xl bg-muted/60 p-1">
        {overdue.length > 0 && (
          <RunwayDay
            title="Overdue"
            tasks={overdue}
            onOpenTask={onOpenTask}
            open={openDay === "Overdue"}
            onOpenChange={(nextOpen) =>
              setOpenDay((current) =>
                nextOpen ? "Overdue" : current === "Overdue" ? null : current,
              )
            }
            overdue
          />
        )}
        {Array.from({ length: 14 }, (_, index) => {
          const day = addDays(today, index);
          const due = live.filter((task) => {
            const deadline = taskDeadline(task);
            return deadline && dateInput(deadline) === dateInput(day);
          });
          return (
            <RunwayDay
              key={dateInput(day)}
              day={day}
              title={format(day, "EEEE, MMMM d")}
              tasks={due}
              today={index === 0}
              onOpenTask={onOpenTask}
              open={openDay === dateInput(day)}
              onOpenChange={(nextOpen) =>
                setOpenDay((current) =>
                  nextOpen
                    ? dateInput(day)
                    : current === dateInput(day)
                      ? null
                      : current,
                )
              }
              className={index >= 7 ? "hidden min-[480px]:block" : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

function RunwayDay({
  day,
  title,
  tasks,
  today,
  overdue,
  onOpenTask,
  open,
  onOpenChange,
  className,
}: {
  day?: Date;
  title: string;
  tasks: Task[];
  today?: boolean;
  overdue?: boolean;
  onOpenTask: (task: Task) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const keepOpen = () => {
    clearTimeout(closeTimer.current);
    onOpenChange(true);
  };
  const delayClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      const hovered =
        triggerRef.current?.matches(":hover") ||
        contentRef.current?.matches(":hover");
      const focused =
        triggerRef.current === document.activeElement ||
        contentRef.current?.contains(document.activeElement);
      if (!hovered && !focused) onOpenChange(false);
    }, 0);
  };
  return (
    <div
      className={cn("min-w-0", overdue ? "w-9 shrink-0" : "flex-1", className)}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger
          ref={triggerRef}
          aria-label={`${title}: ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
          onPointerEnter={keepOpen}
          onPointerLeave={delayClose}
          onFocus={keepOpen}
          onClick={(event) => {
            event.preventDefault();
            keepOpen();
          }}
          onKeyDown={(event) => {
            if (["Enter", " ", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              keepOpen();
              requestAnimationFrame(() =>
                contentRef.current?.querySelector("button")?.focus(),
              );
            }
          }}
          onBlur={(event) => {
            if (
              !contentRef.current?.contains(event.relatedTarget as Node | null)
            )
              delayClose();
          }}
          className={cn(
            "flex h-20 w-full min-w-0 flex-col items-center rounded-lg py-2 transition-colors duration-150 hover:bg-background/70 focus-visible:outline-2 focus-visible:outline-primary",
            today && "bg-primary/12 text-primary",
            overdue && "bg-destructive/12 text-destructive",
            day && isWeekend(day) && !today && "text-muted-foreground",
          )}
        >
          <span className="text-[10px] text-muted-foreground">
            {overdue ? "Late" : format(day!, "EEEEE")}
          </span>
          <span className="mt-1 font-mono text-sm font-medium tabular-nums">
            {overdue ? tasks.length : format(day!, "d")}
          </span>
          <span
            className="mt-2 flex max-w-full flex-wrap justify-center gap-0.5 px-0.5"
            aria-hidden
          >
            {tasks.slice(0, 4).map((task) => (
              <span
                key={task.id}
                className={cn(
                  "h-1.5 w-1 rounded-full",
                  task.completedAt
                    ? "bg-muted-foreground/35"
                    : isTaskOverdue(task)
                      ? "bg-destructive"
                      : "bg-primary",
                )}
              />
            ))}
            {tasks.length > 4 && (
              <span className="font-mono text-[8px] leading-none tabular-nums">
                +
              </span>
            )}
          </span>
        </PopoverTrigger>
        <PopoverContent
          ref={contentRef}
          align="start"
          onPointerEnter={keepOpen}
          onPointerLeave={delayClose}
          onFocusCapture={keepOpen}
          onBlurCapture={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              delayClose();
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          className="w-72 max-w-[calc(100vw-24px)] rounded-xl p-2 shadow-xs data-[state=open]:animate-none data-[state=closed]:animate-none motion-safe:data-[state=open]:animate-in"
        >
          <p
            className={cn(
              "px-2 py-1 text-xs font-medium",
              overdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {title}
          </p>
          {tasks.length ? (
            <div className="max-h-64 overflow-y-auto">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenTask(task);
                  }}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      task.completedAt
                        ? "bg-muted-foreground/35"
                        : isTaskOverdue(task)
                          ? "bg-destructive"
                          : "bg-primary",
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 break-words",
                      task.completedAt && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-1 rounded-xl bg-muted/40 p-3">
              <p className="text-sm font-medium">No deadlines here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Give a task a date to place it on the runway.
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
