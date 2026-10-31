"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { useTimeblocks, type SeriesScope } from "@/hooks/useTimeblocks";
import { useProjects } from "@/hooks/useProjects";
import type { FocusSession } from "@/hooks/useFocus";
import type { TimeBlock, TimeblockTemplate } from "@/lib/db";
import type { Task } from "@/lib/tasks";
import { dayKey, expandTimeblocks, templateFromDay } from "@/lib/timeblocks";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { AnchoredPanel } from "./anchored-panel";
import { editCalendarOccurrence } from "./occurrence-actions";
import { FIELD, PRIMARY, QUIET, type AnchorRect, type CalendarDisplay, type CalendarEvent, type CalendarFilters, type CalendarView, type ContextTarget, type Point, type ZoomLevel } from "./calendar-shared";

export interface CalendarMenuTarget {
  target: ContextTarget;
  point: Point;
  rect?: AnchorRect;
  global?: boolean;
  returnFocus?: HTMLElement | null;
}

interface CalendarMenuProps {
  menu: CalendarMenuTarget | null;
  onClose: () => void;
  onPanelChange: (open: boolean) => void;
  view: CalendarView;
  now: Date;
  canShift: boolean;
  tasks: Task[];
  tags: { tag: string; color: string }[];
  savedTags: { tag: string; color: string }[];
  filters: CalendarFilters;
  onFilters: (filters: CalendarFilters) => void;
  zoom: ZoomLevel;
  onZoom: (zoom: ZoomLevel) => void;
  display: CalendarDisplay;
  onDisplay: (display: CalendarDisplay) => void;
  onOpenDay: (day: Date) => void;
  onToday: () => void;
  onNew: (at: Date, point: Point) => void;
  onEdit: (event: CalendarEvent, point: Point, rect?: AnchorRect) => void;
  onStart: (event: CalendarEvent) => void;
  onSession: (session: FocusSession) => void;
  onTask: (uid: string) => void;
  onPlanTask: (task: Task, at: Date) => void;
}

const SURFACE = "z-50 min-w-56 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xs outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";
const ITEM = "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none focus:bg-muted data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40";

function Item({ children, onSelect, disabled = false, destructive = false }: { children: ReactNode; onSelect: () => void; disabled?: boolean; destructive?: boolean }) {
  return <Menu.Item
    className={`${ITEM}${destructive ? " text-destructive" : ""}`}
    disabled={disabled}
    onSelect={onSelect}>{children}</Menu.Item>;
}

function Sub({ label, children, disabled = false }: { label: ReactNode; children: ReactNode; disabled?: boolean }) {
  return <Menu.Sub>
    <Menu.SubTrigger disabled={disabled} className={ITEM}>{label}<ChevronRight className="ml-auto size-3.5 shrink-0" />
    </Menu.SubTrigger>
    <Menu.Portal>
      <Menu.SubContent className={SURFACE} sideOffset={4} collisionPadding={12}>{children}</Menu.SubContent>
    </Menu.Portal>
  </Menu.Sub>;
}

function Separator() { return <Menu.Separator className="my-1.5 h-px bg-border" />; }

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />;
}

function RadioChoices({ value, options, onValue }: { value: string; options: readonly (readonly [string, string])[]; onValue: (value: string) => void }) {
  return <Menu.RadioGroup value={value} onValueChange={onValue}>{options.map(([key, label]) => <Menu.RadioItem key={key} value={key} className={ITEM}>
    <span className="flex size-4 items-center">
      <Menu.ItemIndicator>
        <Check className="size-4" />
      </Menu.ItemIndicator>
    </span>{label}</Menu.RadioItem>)}</Menu.RadioGroup>;
}

interface TemplatePanel {
  kind: "save" | "rename" | "delete";
  day: Date;
  point: Point;
  template?: TimeblockTemplate;
}

export function CalendarMenu(props: CalendarMenuProps) {
  const { menu, filters, display, onPanelChange } = props;
  const store = useTimeblocks();
  const projects = useProjects((state) => state.projects);
  const [panel, setPanel] = useState<TemplatePanel | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (menu) previousFocus.current = menu.returnFocus || null;
  }, [menu]);
  useEffect(() => { onPanelChange(!!panel); }, [panel, onPanelChange]);
  const target = menu?.target;
  const day = target?.kind === "slot" ? target.day : target?.event.start || props.now;
  const occurrence = target?.kind === "block" ? target.event.occurrence : undefined;
  const dayOccurrences = expandTimeblocks(store.timeblocks, startOfDay(day), addDays(startOfDay(day), 1)).filter((item) => item.day === dayKey(day));
  async function run(action: () => Promise<void>, message?: string) {
    try { await action(); if (message) toast.success(message); } catch { toast.error("Could not update calendar"); }
  }
  function openPanel(kind: TemplatePanel["kind"], template?: TimeblockTemplate) {
    setName(template?.name || "");
    setPanel({ kind, template, day, point: menu!.point });
  }
  async function submitPanel() {
    if (!panel || busy) return;
    setBusy(true);
    try {
      if (panel.kind === "delete") await store.removeTemplate(panel.template!.id!);
      else if (panel.kind === "rename") await store.renameTemplate(panel.template!.id!, name.trim());
      else {
        const blocks = expandTimeblocks(store.timeblocks, startOfDay(panel.day), addDays(startOfDay(panel.day), 1)).filter((item) => item.day === dayKey(panel.day));
        if (!blocks.length) {
          toast.message("No blocks on this day", { description: "Plan a block first, then save this day." });
          return;
        }
        await store.saveTemplate(name.trim(), templateFromDay(blocks));
      }
      toast.success(panel.kind === "delete" ? "Template deleted" : panel.kind === "rename" ? "Template renamed" : "Day saved as template");
      setPanel(null);
    } catch { toast.error("Could not update template"); } finally { setBusy(false); }
  }
  function updateBlock(updates: Partial<TimeBlock>) {
    if (occurrence) void run(() => editCalendarOccurrence(occurrence, updates, occurrence.recurring ? "all" : "this"), occurrence.recurring ? "Series updated" : "Block updated");
  }
  function deleteBlock(scope: SeriesScope) {
    if (occurrence) void run(() => store.removeOccurrence(occurrence, scope), scope === "all" ? "Series deleted" : "Block deleted");
  }
  return <>
    <Menu.Root open={!!menu} modal={false} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <Menu.Trigger
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none fixed size-px opacity-0"
        style={{ left: menu?.point.x ?? 0, top: menu?.point.y ?? 0 }} />
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={2}
          collisionPadding={12}
          className={SURFACE}
          aria-label={menu?.global ? "View options" : "Calendar actions"}
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!panel && (document.activeElement === document.body || document.activeElement?.closest("[role=menu]"))) previousFocus.current?.focus({ preventScroll: true });
          }}>
          {!menu?.global && target && <>
            {target.kind === "slot" && target.time && <>
              <Item onSelect={() => props.onNew(target.time!, menu!.point)}>New block here</Item>
              <Sub label="Plan task here" disabled={!props.tasks.length}>{props.tasks.slice(0, 8).map((task) => {
                const project = projects.find((item) => item.id === task.projectId);
                return <Item
                  key={task.uid || task.id}
                  disabled={!task.uid}
                  onSelect={() => props.onPlanTask(task, target.time!)}>
                  <span className="min-w-0 max-w-64">
                    <span className="block truncate">{task.title}</span>{project && <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ProjectIcon name={project.icon} className="size-3" />
                      <span className="truncate">{project.title}</span>
                    </span>}</span>
                </Item>;
              })}</Sub>
              <Separator />
            </>}
            {target.kind === "block" && occurrence && <>
              <Item onSelect={() => props.onEdit(target.event, menu!.point, menu!.rect)}>Edit…</Item>
              {occurrence.start <= props.now && occurrence.end > props.now && <Item onSelect={() => props.onStart(target.event)}>Start block</Item>}
              <Sub label="Tag" disabled={!props.savedTags.length}>{occurrence.recurring && <Menu.Label className="px-3 py-2 text-xs text-muted-foreground">Applies to all in series</Menu.Label>}{props.savedTags.map(({ tag, color }) => <Item key={tag} onSelect={() => updateBlock({ tag })}>
                <Dot color={color} />{tag}{occurrence.block.tag === tag && <Check className="ml-auto size-4" />}</Item>)}</Sub>
              <Sub label="Timer">{occurrence.recurring && <Menu.Label className="px-3 py-2 text-xs text-muted-foreground">Applies to all in series</Menu.Label>}<RadioChoices
                value={occurrence.block.timerMode || "keep"}
                options={[["keep", "Keep current"], ["pomodoro", "Pomodoro"], ["standard", "Standard"]]}
                onValue={(value) => updateBlock({ timerMode: value === "keep" ? undefined : value as TimeBlock["timerMode"] })} />
              </Sub>
              {occurrence.recurring ? <Sub label={<span className="text-destructive">Delete</span>}>
                <Item destructive onSelect={() => deleteBlock("this")}>Only this one</Item>
                <Item destructive onSelect={() => deleteBlock("all")}>All in series</Item>
              </Sub> : <Item destructive onSelect={() => deleteBlock("this")}>Delete</Item>}
              <Separator />
            </>}
            {target.kind === "session" && target.event.session && <>
              <Item onSelect={() => props.onSession(target.event.session!)}>Edit session…</Item>
              <Separator />
            </>}
            {target.kind === "deadline" && <>
              <Item onSelect={() => props.onTask(target.event.taskUid || "")}>Open task</Item>
              <Separator />
            </>}
            {props.view !== "day" && <Item onSelect={() => props.onOpenDay(day)}>Open day<span className="ml-auto font-mono text-xs text-muted-foreground">D</span>
            </Item>}
            <Item disabled={!dayOccurrences.length} onSelect={() => openPanel("save")}>Save day as template…</Item>
            {!dayOccurrences.length && <Menu.Label className="px-3 pb-2 text-xs font-normal text-muted-foreground">Plan a block first to save this day.</Menu.Label>}
            <Sub label="Apply template" disabled={!store.templates.length}>{store.templates.map((template) => <Sub key={template.id} label={template.name}>{([[1, "This day"], [5, "Mon–Fri this week"], [7, "Whole week"]] as const).map(([count, label]) => <Item
              key={count}
              onSelect={() => void run(async () => {
                const first = count === 1 ? startOfDay(day) : startOfWeek(day, { weekStartsOn: 1 });
                const added = await store.applyTemplate(template, Array.from({ length: count }, (_, index) => addDays(first, index)));
                toast.success(`${added} blocks added`, { description: count === 1 ? format(first, "EEEE, MMM d") : `Week of ${format(first, "MMM d")}` });
              })}>{label}</Item>)}</Sub>)}</Sub>
            <Sub label="Manage templates" disabled={!store.templates.length}>{store.templates.map((template) => <Sub key={template.id} label={template.name}>
              <Item onSelect={() => openPanel("rename", template)}>Rename…</Item>
              <Item destructive onSelect={() => openPanel("delete", template)}>Delete…</Item>
            </Sub>)}</Sub>
            {isSameDay(day, props.now) && props.canShift && <Sub label="Running late?">{[[15, "+15m"], [30, "+30m"], [60, "+1h"], [-15, "−15m"]].map(([minutes, label]) => <Item
              key={minutes}
              onSelect={() => void run(async () => {
                const count = await store.shiftRestOfDay(Number(minutes));
                toast.success(`${count} blocks shifted ${Number(minutes) < 0 ? "earlier" : "later"}`, { description: `${Math.abs(Number(minutes))} minutes · today only` });
              })}>
              <span className="font-mono tabular-nums">{label}</span>
            </Item>)}</Sub>}
            <Separator />
          </>}
          <Sub label="Show">{([["sessions", "Focus sessions"], ["blocks", "Time blocks"], ["deadlines", "Task deadlines"]] as const).map(([key, label]) => <Menu.CheckboxItem
            key={key}
            className={ITEM}
            checked={filters[key]}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => props.onFilters({ ...filters, [key]: checked })}>
            <span className="flex size-4 items-center">
              <Menu.ItemIndicator>
                <Check className="size-4" />
              </Menu.ItemIndicator>
            </span>{label}</Menu.CheckboxItem>)}{!!props.tags.length && <Separator />}{props.tags.map(({ tag, color }) => <Menu.CheckboxItem
              key={tag}
              className={ITEM}
              checked={!filters.hiddenTags.includes(tag)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => props.onFilters({ ...filters, hiddenTags: checked ? filters.hiddenTags.filter((item) => item !== tag) : [...filters.hiddenTags, tag] })}>
              <span className="flex size-4 items-center">
                <Menu.ItemIndicator>
                  <Check className="size-4" />
                </Menu.ItemIndicator>
              </span>
              <Dot color={color} />{tag}</Menu.CheckboxItem>)}</Sub>
          {props.view !== "month" && <Sub label="Zoom">
            <RadioChoices
              value={props.zoom}
              options={[["compact", "Compact"], ["normal", "Normal"], ["expanded", "Expanded"]]}
              onValue={(value) => props.onZoom(value as ZoomLevel)} />
          </Sub>}
          <Sub label="Focus sessions">
            <RadioChoices
              value={display.sessions}
              options={[["pills", "Pills"], ["full", "Full blocks"]]}
              onValue={(value) => props.onDisplay({ ...display, sessions: value as CalendarDisplay["sessions"] })} />
          </Sub>
          <Sub label="Planned blocks">
            <RadioChoices
              value={display.blocks}
              options={[["solid", "Solid"], ["seeThrough", "See-through"]]}
              onValue={(value) => props.onDisplay({ ...display, blocks: value as CalendarDisplay["blocks"] })} />
          </Sub>
          <Item onSelect={props.onToday}>Go to today<span className="ml-auto font-mono text-xs text-muted-foreground">T</span>
          </Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
    {panel && <AnchoredPanel
      point={panel.point}
      label={panel.kind === "delete" ? "Delete template" : panel.kind === "rename" ? "Rename template" : "Save day as template"}
      onClose={() => { if (!busy) setPanel(null); }}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (panel.kind === "delete" || name.trim()) void submitPanel();
        }}>
        <h2 className="text-sm font-semibold">{panel.kind === "delete" ? "Delete template?" : panel.kind === "rename" ? "Rename template" : "Save day as template"}</h2>
        {panel.kind === "delete" ? <p className="text-xs text-muted-foreground">Delete “{panel.template?.name}”? Blocks already planned will stay.</p> : <label className="block space-y-1.5 text-xs text-muted-foreground">
          <span>Template name</span>
          <input autoFocus className={FIELD} value={name} onChange={(event) => setName(event.target.value)} />
        </label>}
        <div className="flex gap-1">
          <button
            type="submit"
            disabled={busy || (panel.kind !== "delete" && !name.trim())}
            className={panel.kind === "delete" ? `${QUIET} text-destructive` : PRIMARY}>{panel.kind === "delete" ? "Delete template" : panel.kind === "rename" ? "Save name" : "Save template"}</button>
          <button type="button" disabled={busy} className={QUIET} onClick={() => setPanel(null)}>Cancel</button>
        </div>
      </form>
    </AnchoredPanel>}
  </>;
}
