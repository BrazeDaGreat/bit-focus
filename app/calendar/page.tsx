"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  addMinutes,
  format,
  isSameDay,
  isValid,
  parse,
  startOfDay,
} from "date-fns";
import type { SlotInfo } from "react-big-calendar";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { useFocus, type FocusSession } from "@/hooks/useFocus";
import { useTasks } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useTag } from "@/hooks/useTag";
import { useTimeblocks, type SeriesScope } from "@/hooks/useTimeblocks";
import { useCurrentBlock } from "@/hooks/useCurrentBlock";
import { usePomo } from "@/hooks/PomoContext";
import type { TimeBlock } from "@/lib/db";
import { taskDeadline, type Task } from "@/lib/tasks";
import { expandTimeblocks, type TimeblockOccurrence } from "@/lib/timeblocks";
import { getTagColor } from "@/lib/utils";
import { EditFocusSessionDialog } from "@/components/EditFocusSessionDialog";
import {
  CalendarHeader,
  useCalendarFilters,
} from "@/components/calendar/calendar-header";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { CalendarMenu, type CalendarMenuTarget } from "@/components/calendar/calendar-menu";
import { MonthOverview } from "@/components/calendar/month-overview";
import { PlanRail } from "@/components/calendar/plan-rail";
import {
  BlockEditor,
  SeriesChoice,
  type EditorTarget,
} from "@/components/calendar/block-editor";
import { AnchoredPanel } from "@/components/calendar/anchored-panel";
import { editCalendarOccurrence } from "@/components/calendar/occurrence-actions";
import {
  DEFAULT_DISPLAY,
  QUIET,
  type CalendarDisplay,
  type ContextTarget,
  movePeriod,
  periodRange,
  renderRange,
  type CalendarEvent,
  type CalendarView,
  type Point,
  type ZoomLevel,
} from "@/components/calendar/calendar-shared";

interface PendingMove {
  occurrence: TimeblockOccurrence;
  updates: Partial<TimeBlock>;
  point: Point;
}

function CalendarWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const { tasks, loadTasks } = useTasks();
  const { projects, loadProjects } = useProjects();
  const { savedTags } = useTag();
  const { focusSessions, loadFocusSessions, loadingFocusSessions } = useFocus();
  const {
    timeblocks,
    loadTimeblocks,
    loadingTimeblocks,
    addTimeblock,
    removeOccurrence,
  } = useTimeblocks();
  const { now, current, next, startOccurrence } = useCurrentBlock();
  const {
    state: { pomodoroSettings },
  } = usePomo();
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [zoom, setZoom] = useState<ZoomLevel>("normal");
  const [filters, setFilters] = useCalendarFilters();
  const [display, setDisplay] = useState<CalendarDisplay>(DEFAULT_DISPLAY);
  const [displayReady, setDisplayReady] = useState(false);
  const [menu, setMenu] = useState<CalendarMenuTarget | null>(null);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const contextTarget = useRef<ContextTarget | null>(null);
  const ignoreSelectionGesture = useRef(false);
  const optionsButton = useRef<HTMLButtonElement>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moving, setMoving] = useState(false);
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(
    null,
  );
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const draggedTaskRef = useRef<Task | null>(null);
  const pointer = useRef<Point>({ x: 100, y: 160 });
  const [highlight, setHighlight] = useState<string | null>(null);
  const queryDate = params.get("date"),
    queryView = params.get("view"),
    queryBlock = params.get("block");

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("bit-focus-calendar-display") || "null");
      if (stored && typeof stored === "object") {
        const value = stored as Partial<CalendarDisplay>;
        setDisplay({ sessions: value.sessions === "full" ? "full" : "pills", blocks: value.blocks === "seeThrough" ? "seeThrough" : "solid" });
      }
    } catch { /* Display options still work without storage. */ }
    setDisplayReady(true);
  }, []);
  useEffect(() => {
    if (!displayReady) return;
    try { localStorage.setItem("bit-focus-calendar-display", JSON.stringify(display)); } catch { /* Private mode can disable storage. */ }
  }, [display, displayReady]);
  useEffect(() => {
    function beginGesture() {
      // Keep this value for the entire gesture, even after outside-down dismisses a panel.
      ignoreSelectionGesture.current = !!editor || !!pendingMove || !!selectedSession || !!menu || templatePanelOpen;
    }
    window.addEventListener("pointerdown", beginGesture, true);
    return () => window.removeEventListener("pointerdown", beginGesture, true);
  }, [editor, pendingMove, selectedSession, menu, templatePanelOpen]);
  useEffect(() => {
    void loadTasks();
    void loadProjects();
    void loadFocusSessions();
    void loadTimeblocks();
  }, [loadTasks, loadProjects, loadFocusSessions, loadTimeblocks]);
  useEffect(() => {
    if (queryDate) {
      const picked = parse(queryDate, "yyyy-MM-dd", new Date());
      if (isValid(picked) && format(picked, "yyyy-MM-dd") === queryDate)
        setDate(picked);
    }
    if (queryView === "day" || queryView === "week" || queryView === "month")
      setView(queryView);
  }, [queryDate, queryView]);
  useEffect(() => {
    if (!queryBlock || loadingTimeblocks) return;
    setHighlight(queryBlock);
    const timeout = window.setTimeout(() => setHighlight(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [queryBlock, loadingTimeblocks]);
  useEffect(() => {
    function track(event: PointerEvent | DragEvent) {
      if (event.clientX || event.clientY)
        pointer.current = { x: event.clientX, y: event.clientY };
    }
    window.addEventListener("pointerdown", track, true);
    window.addEventListener("pointermove", track);
    window.addEventListener("dragover", track);
    return () => {
      window.removeEventListener("pointerdown", track, true);
      window.removeEventListener("pointermove", track);
      window.removeEventListener("dragover", track);
    };
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]",
        )
      )
        return;
      if (editor || pendingMove || selectedSession || menu || templatePanelOpen) return;
      const key = event.key.toLowerCase();
      if (key === "d") setView("day");
      else if (key === "w") setView("week");
      else if (key === "m") setView("month");
      else if (key === "t") setDate(new Date());
      else if (key === "arrowleft" || key === "arrowright")
        setDate((value) =>
          movePeriod(value, view, key === "arrowleft" ? -1 : 1),
        );
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [view, editor, pendingMove, selectedSession, menu, templatePanelOpen]);

  const range = useMemo(() => periodRange(date, view), [date, view]);
  const visibleRange = useMemo(() => renderRange(date, view), [date, view]);
  const occurrences = useMemo(
    () => expandTimeblocks(timeblocks, visibleRange.start, visibleRange.end),
    [timeblocks, visibleRange],
  );
  const openTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !task.deletedAt &&
          !task.completedAt &&
          !projects.some(
            (project) =>
              project.id === task.projectId && project.status === "Closed",
          ),
      ),
    [tasks, projects],
  );
  const plannedTasks = useMemo(() => {
    const future = expandTimeblocks(timeblocks, now, addDays(now, 35));
    return new Set(
      [
        ...future.map((occurrence) => occurrence.block.taskUid),
        ...timeblocks
          .filter((block) => new Date(block.endTime) > now)
          .map((block) => block.taskUid),
      ].filter((uid): uid is string => !!uid),
    );
  }, [timeblocks, now]);
  const tags = useMemo(() => {
    const names = new Set([
      ...savedTags.map((tag) => tag.t),
      ...timeblocks.map((block) => block.tag),
      ...focusSessions.map((session) => session.tag),
      ...openTasks.map((task) => task.primaryTag || task.tags[0] || "Focus"),
    ]);
    return [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ tag, color: getTagColor(savedTags, tag)[0] }));
  }, [savedTags, timeblocks, focusSessions, openTasks]);
  const events = useMemo(() => {
    const result: CalendarEvent[] = [];
    const visible = (tag: string) => !filters.hiddenTags.includes(tag);
    if (filters.blocks)
      for (const occurrence of occurrences) {
        if (!visible(occurrence.block.tag)) continue;
        result.push({
          id: `block:${occurrence.key}`,
          title:
            tasks.find(
              (task) =>
                task.uid === occurrence.block.taskUid && !task.deletedAt,
            )?.title ||
            occurrence.block.title ||
            occurrence.block.tag,
          start: occurrence.start,
          end: occurrence.end,
          tag: occurrence.block.tag,
          color: getTagColor(savedTags, occurrence.block.tag)[0],
          kind: "block",
          occurrence,
        });
      }
    if (filters.sessions)
      for (const session of focusSessions) {
        const start = new Date(session.startTime),
          end = new Date(session.endTime);
        if (
          start >= visibleRange.end ||
          end <= visibleRange.start ||
          !visible(session.tag)
        )
          continue;
        const [color, whiteText] = getTagColor(savedTags, session.tag);
        result.push({
          id: `session:${session.uid || session.id}`,
          title:
            tasks.find((task) => task.uid === session.taskUid)?.title ||
            session.tag,
          start,
          end,
          tag: session.tag,
          color,
          whiteText,
          kind: "session",
          session,
        });
      }
    if (filters.deadlines)
      for (const task of openTasks) {
        const deadline = taskDeadline(task),
          tag = task.primaryTag || task.tags[0] || "Focus";
        if (
          !deadline ||
          deadline < visibleRange.start ||
          deadline >= visibleRange.end ||
          !visible(tag)
        )
          continue;
        result.push({
          id: `deadline:${task.uid || task.id}`,
          title: task.title,
          start: startOfDay(deadline),
          end: addDays(startOfDay(deadline), 1),
          tag,
          color: getTagColor(savedTags, tag)[0],
          kind: "deadline",
          allDay: true,
          taskUid: task.uid,
        });
      }
    if (editor && !editor.occurrence)
      result.push({ id: "pending", kind: "pending", start: editor.start, end: editor.end, title: "", tag: "", color: "var(--primary)" });
    return result;
  }, [
    editor,
    occurrences,
    focusSessions,
    openTasks,
    tasks,
    savedTags,
    visibleRange,
    filters,
  ]);
  const review = useMemo(() => {
    const totals = new Map<string, number>();
    let total = 0,
      count = 0;
    for (const session of focusSessions) {
      if (filters.hiddenTags.includes(session.tag)) continue;
      const minutes = Math.max(
        0,
        (Math.min(+new Date(session.endTime), +range.end) -
          Math.max(+new Date(session.startTime), +range.start)) /
          60_000,
      );
      if (!minutes) continue;
      total += minutes;
      count++;
      totals.set(session.tag, (totals.get(session.tag) || 0) + minutes);
    }
    return {
      total,
      count,
      tags: [...totals]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, minutes]) => ({
          tag,
          minutes,
          color: getTagColor(savedTags, tag)[0],
        })),
    };
  }, [focusSessions, range, savedTags, filters.hiddenTags]);
  const scrollTo = useMemo(() => {
    const target = occurrences.find(
      (occurrence) => occurrence.key === queryBlock,
    )?.start;
    const time = new Date(target || new Date());
    time.setHours(Math.max(0, time.getHours() - 1), 0, 0, 0);
    return time;
  }, [occurrences, queryBlock]);

  async function saveEditor(updates: Partial<TimeBlock>, scope: SeriesScope) {
    if (!editor) return;
    const task = tasks.find((item) => item.uid === updates.taskUid);
    const attribution = {
      projectUid: task
        ? projects.find((project) => project.id === task.projectId)?.uid
        : undefined,
    };
    if (editor.occurrence)
      await editCalendarOccurrence(
        editor.occurrence,
        { ...updates, ...attribution },
        scope,
      );
    else {
      const { tag, title, startTime, endTime, ...extras } = updates;
      await addTimeblock(tag || "Focus", startTime!, endTime!, title, {
        ...extras,
        ...attribution,
      });
    }
    toast.success(editor.occurrence ? "Block updated" : "Block planned");
  }
  const moveBlock = useCallback(
    ({ event, start, end, isAllDay }: EventInteractionArgs<CalendarEvent>) => {
      if (!event.occurrence || isAllDay) return;
      const updates = { startTime: new Date(start), endTime: new Date(end) };
      if (updates.endTime <= updates.startTime) return;
      if (event.occurrence.recurring)
        setPendingMove({
          occurrence: event.occurrence,
          updates,
          point: { ...pointer.current },
        });
      else
        void editCalendarOccurrence(event.occurrence, updates, "this").catch(
          () => toast.error("Could not move block"),
        );
    },
    [],
  );
  async function finishMove(scope: SeriesScope) {
    if (!pendingMove || moving) return;
    setMoving(true);
    try {
      await editCalendarOccurrence(
        pendingMove.occurrence,
        pendingMove.updates,
        scope,
      );
      setPendingMove(null);
    } catch {
      toast.error("Could not move block");
    } finally {
      setMoving(false);
    }
  }
  async function planTask(task: Task, droppedAt?: Date) {
    if (!task.uid) return;
    const duration = Math.max(1, task.estimateMinutes || 60);
    let start: Date;
    if (droppedAt) start = droppedAt;
    else {
      const day =
        startOfDay(date) < startOfDay(now) ? startOfDay(now) : startOfDay(date);
      start = isSameDay(day, now)
        ? new Date(Math.ceil(+now / 900_000) * 900_000)
        : addMinutes(day, 9 * 60);
      const blocks = expandTimeblocks(timeblocks, day, addDays(day, 2));
      for (const occurrence of blocks) {
        if (occurrence.end <= start) continue;
        if (occurrence.start >= addMinutes(start, duration)) break;
        start = new Date(Math.ceil(+occurrence.end / 900_000) * 900_000);
      }
      if (addMinutes(start, duration) > addDays(day, 1)) {
        toast.message("No free slot left on this day", {
          description:
            "Choose another day or drag the task onto a specific time.",
        });
        return;
      }
    }
    try {
      const project = projects.find((item) => item.id === task.projectId);
      const block = await addTimeblock(
        task.primaryTag || task.tags[0] || "Focus",
        start,
        addMinutes(start, duration),
        task.title,
        { taskUid: task.uid, projectUid: project?.uid },
      );
      if (!droppedAt) setDate(start);
      toast.success("Task planned", {
        description: format(start, "EEE, MMM d · h:mm a"),
        action: {
          label: "Undo",
          onClick: () => {
            void useTimeblocks
              .getState()
              .removeTimeblock(block.id!)
              .catch(() => toast.error("Could not undo block"));
          },
        },
      });
    } catch {
      toast.error("Could not plan task");
    }
  }
  function selectSlot(slot: SlotInfo) {
    if (editor || pendingMove || selectedSession || menu || templatePanelOpen || ignoreSelectionGesture.current || view === "month") return;
    const point = slot.box ? { x: slot.box.clientX, y: slot.box.clientY } : { ...pointer.current };
    const rect = slot.bounds
      ? { left: slot.bounds.left, top: slot.bounds.top, right: slot.bounds.right, bottom: slot.bounds.bottom }
      : { left: point.x, top: point.y, right: point.x + 1, bottom: point.y + 1 };
    setEditor({ start: slot.start, end: slot.end > slot.start ? slot.end : addMinutes(slot.start, 60), point, rect });
  }
  function openDay(day: Date) { setDate(day); setView("day"); }
  function openTask(uid: string) { router.push(`/projects?task=${encodeURIComponent(uid)}`); }
  function editEvent(event: CalendarEvent, point: Point, rect?: EditorTarget["rect"]) {
    if (!event.occurrence) return;
    setEditor({ occurrence: event.occurrence, start: event.start, end: event.end, point,
      rect: rect || { left: point.x, top: point.y, right: point.x + 1, bottom: point.y + 1 } });
  }
  const draggedEvent: CalendarEvent | null = draggedTask
    ? {
        id: `drag:${draggedTask.uid}`,
        title: draggedTask.title,
        start: now,
        end: addMinutes(now, draggedTask.estimateMinutes || 60),
        tag: draggedTask.primaryTag || draggedTask.tags[0] || "Focus",
        color: getTagColor(
          savedTags,
          draggedTask.primaryTag || draggedTask.tags[0] || "Focus",
        )[0],
        kind: "block",
      }
    : null;
  const rail = (
    <PlanRail
      date={date}
      view={view}
      range={range}
      onDate={setDate}
      tasks={openTasks}
      plannedTasks={plannedTasks}
      onPlanTask={(task) => void planTask(task)}
      onDragTask={(task) => {
        draggedTaskRef.current = task;
        setDraggedTask(task);
      }}
      canShift={isSameDay(date, now) && (!!current || !!next)}
      review={review}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[560px] min-w-0 flex-col overflow-hidden"
      onContextMenu={(event) => {
        event.preventDefault();
        const target = contextTarget.current || { kind: "slot" as const, day: date, time: null };
        contextTarget.current = null;
        const eventElement = (event.target as HTMLElement).closest(".rbc-event");
        const rect = eventElement?.getBoundingClientRect();
        setEditor(null);
        setPendingMove(null);
        setMenu({ target, point: { x: event.clientX, y: event.clientY }, rect,
          returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null });
      }}
    >
      <CalendarHeader
        date={date}
        view={view}
        onDate={(direction) =>
          setDate((value) =>
            direction === 0 ? new Date() : movePeriod(value, view, direction),
          )
        }
        onView={setView}
        viewOptions={<button ref={optionsButton} className={`${QUIET} w-9 px-0`} aria-label="View options" title="View options" aria-haspopup="menu" aria-expanded={!!menu?.global}
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setMenu({ target: { kind: "slot", day: date, time: null }, global: true, point: { x: bounds.left, y: bounds.bottom }, returnFocus: optionsButton.current });
          }}><SlidersHorizontal className="size-4" /></button>}
        rail={rail}
      />
      <div className="flex min-h-0 flex-1 gap-2">
        <aside
          aria-label="Plan and review"
          className="hidden w-72 shrink-0 overflow-y-auto px-5 pb-6 pt-3 md:block"
        >
          {rail}
        </aside>
        {view === "month" ? <MonthOverview
          month={date}
          sessions={events.flatMap((event) => event.session ? [event.session] : [])}
          occurrences={events.flatMap((event) => event.occurrence ? [event.occurrence] : [])}
          deadlines={events.filter((event) => event.kind === "deadline")}
          tagColor={(tag) => getTagColor(savedTags, tag)[0]}
          onOpenDay={openDay}
          onContextTarget={(target) => { contextTarget.current = target; }}
        /> : <CalendarGrid
          display={display}
          onContextTarget={(target) => { contextTarget.current = target; }}
          date={date}
          view={view}
          zoom={zoom}
          events={events}
          settings={pomodoroSettings}
          loading={loadingFocusSessions || loadingTimeblocks}
          highlight={highlight}
          scrollTo={scrollTo}
          draggedEvent={draggedEvent}
          onDate={setDate}
          onView={setView}
          onSlot={selectSlot}
          onMove={moveBlock}
          onSelect={(event, details) => {
            if (ignoreSelectionGesture.current || editor || pendingMove || templatePanelOpen) return;
            if (event.kind === "deadline") openTask(event.taskUid || "");
            else if (event.occurrence) {
              const element = (details.target as HTMLElement | null)?.closest(".rbc-event");
              const bounds = (element || details.currentTarget)?.getBoundingClientRect();
              editEvent(event, bounds ? { x: bounds.left, y: bounds.top } : { ...pointer.current }, bounds);
            } else if (event.session) setSelectedSession(event.session);
          }}
          onOutsideDrop={({ start, allDay }) => {
            const task = draggedTaskRef.current;
            draggedTaskRef.current = null;
            setDraggedTask(null);
            if (!task) return;
            if (allDay) {
              toast.message("Drop tasks into a timed day or week slot");
              return;
            }
            void planTask(task, new Date(start));
          }}
        />}
      </div>
      <CalendarMenu
        menu={menu} onClose={() => setMenu(null)} onPanelChange={setTemplatePanelOpen}
        view={view} now={now} canShift={!!current || !!next}
        tasks={openTasks.filter((task) => !plannedTasks.has(task.uid || ""))}
        tags={tags} savedTags={savedTags.map((tag) => ({ tag: tag.t, color: getTagColor(savedTags, tag.t)[0] }))}
        filters={filters} onFilters={setFilters} zoom={zoom} onZoom={setZoom} display={display} onDisplay={setDisplay}
        onOpenDay={openDay} onToday={() => setDate(new Date())}
        onNew={(at, point) => setEditor({ start: at, end: addMinutes(at, 60), point, rect: { left: point.x, top: point.y, right: point.x + 1, bottom: point.y + 1 } })}
        onEdit={editEvent} onStart={(event) => { if (event.occurrence) startOccurrence(event.occurrence); }}
        onSession={setSelectedSession} onTask={openTask} onPlanTask={(task, at) => void planTask(task, at)}
      />
      {editor && (
        <BlockEditor
          key={`${editor.occurrence?.key || "new"}:${+editor.start}:${+editor.end}`}
          target={editor}
          tasks={openTasks}
          savedTags={savedTags}
          settings={pomodoroSettings}
          now={now}
          onSave={saveEditor}
          onDelete={async (scope) => {
            if (editor.occurrence) {
              await removeOccurrence(editor.occurrence, scope);
              toast.success("Block deleted");
            }
          }}
          onStart={() => {
            if (editor.occurrence) startOccurrence(editor.occurrence);
            setEditor(null);
          }}
          onClose={() => setEditor(null)}
        />
      )}
      {pendingMove && (
        <AnchoredPanel
          point={pendingMove.point}
          onClose={() => {
            if (!moving) setPendingMove(null);
          }}
          label="Move repeating block"
        >
          <SeriesChoice
            action="Apply this time change to…"
            busy={moving}
            onChoose={(scope) => void finishMove(scope)}
            onCancel={() => setPendingMove(null)}
          />
        </AnchoredPanel>
      )}
      <EditFocusSessionDialog
        session={selectedSession}
        open={!!selectedSession}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null);
        }}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div
          className="m-4 h-[80dvh] rounded-2xl bg-muted/40"
          role="status"
          aria-label="Loading calendar"
        />
      }
    >
      <CalendarWorkspace />
    </Suspense>
  );
}
