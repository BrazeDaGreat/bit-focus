"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { addDays, nextMonday } from "date-fns";
import { toast } from "sonner";
import { useTasks } from "@/hooks/useTasks";
import { dateInput, taskDeadline, taskDeadlineFields, type Task } from "@/lib/tasks";
import { DeadlinePicker } from "./TaskPickers";
import { TaskTimeLog } from "./TaskTimeLog";

const surface = "z-50 min-w-52 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xs outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";
const item = "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40";

/** Same controlled dropdown-at-pointer pattern as calendar-menu, with touch support. */
export function TaskRowActions({ task, children, onOpen, onComplete, onFocus }: {
  task: Task;
  children: ReactNode;
  onOpen: () => void;
  onComplete: () => void;
  onFocus: () => void;
}) {
  const updateTask = useTasks(state => state.updateTask);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [panel, setPanel] = useState<"date" | "time" | null>(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const row = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const clearPress = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function open(x: number, y: number, target: EventTarget | null) {
    clearPress();
    previousFocus.current = target instanceof HTMLElement ? target.closest("button") ?? row.current : row.current;
    setPoint({ x, y });
    setAnchor({ x, y });
  }
  function restoreFocus() { previousFocus.current?.focus({ preventScroll: true }); }
  function openPanel(next: "date" | "time") {
    panelRef.current = next;
    setPanel(next);
  }
  async function save(updates: Partial<Task>) {
    if (task.id == null) return false;
    try { await updateTask(task.id, updates); return true; }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not update task"); return false; }
  }
  const disabled = task.id == null || !!task.deletedAt;
  return <div ref={row} tabIndex={-1} className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-primary [@media(hover:none)]:select-none"
    onContextMenu={(event) => {
      // Portalled menus and pickers bubble through React's row ancestor too.
      if (!(event.target instanceof Node) || !row.current?.contains(event.target)) return;
      event.preventDefault(); event.stopPropagation(); open(event.clientX, event.clientY, event.target);
    }}
    onKeyDown={(event) => {
      if (panel || point) return;
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault(); event.stopPropagation();
        const rect = row.current!.getBoundingClientRect();
        open(rect.left + 16, rect.bottom, event.target);
      }
    }}
    onPointerDown={(event) => {
      if (event.pointerType !== "touch" || panel || point) return;
      suppressClick.current = false;
      pointer.current = { x: event.clientX, y: event.clientY };
      const { clientX, clientY, target } = event;
      clearPress();
      timer.current = setTimeout(() => { suppressClick.current = true; open(clientX, clientY, target); }, 550);
    }}
    onPointerMove={(event) => { if (pointer.current && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 8) clearPress(); }}
    onPointerUp={clearPress} onPointerCancel={clearPress}
    onClickCapture={(event) => { if (suppressClick.current && row.current?.contains(event.target as Node)) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    {children}
    <Menu.Root open={!!point} modal={false} onOpenChange={(value) => { if (!value) setPoint(null); }}>
      <Menu.Trigger tabIndex={-1} aria-hidden className="pointer-events-none fixed size-px opacity-0" style={{ left: point?.x ?? 0, top: point?.y ?? 0 }} />
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={2} collisionPadding={12} className={surface} aria-label={`Actions for ${task.title}`}
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); if (!panelRef.current) restoreFocus(); }}>
          <Menu.Item className={item} onSelect={onOpen}>Open task</Menu.Item>
          <Menu.Item className={item} disabled={disabled} onSelect={onComplete}>{task.completedAt ? "Reopen" : "Complete"}</Menu.Item>
          {!task.completedAt && <Menu.Item className={item} disabled={disabled} onSelect={onFocus}>Start focus</Menu.Item>}
          <Menu.Separator className="my-1.5 h-px bg-border" />
          <Menu.Label className="px-3 py-1.5 text-xs text-muted-foreground">Snooze deadline</Menu.Label>
          <Menu.Item className={item} disabled={disabled} onSelect={() => void save(taskDeadlineFields(task, dateInput(addDays(new Date(), 1))))}>Tomorrow</Menu.Item>
          <Menu.Item className={item} disabled={disabled} onSelect={() => void save(taskDeadlineFields(task, dateInput(nextMonday(new Date()))))}>Next week<span className="ml-auto text-xs text-muted-foreground">Monday</span></Menu.Item>
          <Menu.Item className={item} disabled={disabled} onSelect={() => openPanel("date")}>Pick date…</Menu.Item>
          <Menu.Item className={item} disabled={disabled || !task.dueDate} onSelect={() => void save(taskDeadlineFields(task, null))}>Remove deadline</Menu.Item>
          <Menu.Separator className="my-1.5 h-px bg-border" />
          <Menu.Item className={item} disabled={disabled} onSelect={() => openPanel("time")}>Log time…</Menu.Item>
          <Menu.Item className={`${item} text-destructive`} disabled={disabled} onSelect={() => {
            void save({ deletedAt: new Date() }).then((saved) => {
              if (saved) toast("Task deleted", { action: { label: "Undo", onClick: () => void save({ deletedAt: null }) } });
            });
          }}>Delete</Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
    <div className="pointer-events-none fixed size-px" style={{ left: anchor.x, top: anchor.y }}>
      <DeadlinePicker value={taskDeadline(task)} open={panel === "date"} onOpenChange={(value) => { if (!value) setPanel(null); }}
        triggerClassName="pointer-events-none size-px opacity-0" onReturnFocus={restoreFocus}
        onChange={(day) => void save(taskDeadlineFields(task, day))} />
      <TaskTimeLog task={task} open={panel === "time"} onOpenChange={(value) => { if (!value) setPanel(null); }}
        triggerClassName="pointer-events-none size-px opacity-0" onReturnFocus={restoreFocus} />
    </div>
  </div>;
}
