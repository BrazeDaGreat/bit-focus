"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTasks } from "@/hooks/useTasks";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useFocus } from "@/hooks/useFocus";
import { useTimeblocks } from "@/hooks/useTimeblocks";
import { usePomo } from "@/hooks/PomoContext";
import { cn } from "@/lib/utils";
import {
  formatMinutes,
  taskDeadline,
  taskMinutes,
  type Task,
} from "@/lib/tasks";
import { TaskRow } from "./TaskRow";
import { TaskDetails } from "./TaskDetails";

/** "all" | "none" (tasks without a project) | project id */
type Scope = "all" | "none" | number;

function readScope(params: URLSearchParams, initialProjectId?: number): Scope {
  const project = params.get("project");
  if (project === "none") return "none";
  if (project && Number.isFinite(Number(project))) return Number(project);
  // Older links used ?view=project:1 / ?view=inbox.
  const view = params.get("view");
  if (view?.startsWith("project:")) return Number(view.slice(8));
  if (view === "inbox") return "none";
  return initialProjectId ?? "all";
}

/** Dated tasks first (soonest deadline on top), then undated in creation order. */
function byNext(a: Task, b: Task) {
  const da = taskDeadline(a)?.getTime() ?? Infinity;
  const db = taskDeadline(b)?.getTime() ?? Infinity;
  return da - db || a.order - b.order || a.id! - b.id!;
}

function sessionMinutes(s: { startTime: Date; endTime: Date }) {
  return Math.max(
    0,
    (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000,
  );
}

export function TaskWorkspace({
  initialProjectId,
}: {
  initialProjectId?: number;
}) {
  const { tasks, loading, error, loadTasks, addTask, updateTask } = useTasks();
  const { projects, loadProjects } = useProjects();
  const { focusSessions, loadFocusSessions } = useFocus();
  const { loadTimeblocks } = useTimeblocks();
  const { state: timer, startTask } = usePomo();
  const router = useRouter();
  const params = useSearchParams();
  const scope = readScope(params, initialProjectId);
  const selectedTask = tasks.find((t) => t.uid === params.get("task"));
  const project =
    typeof scope === "number"
      ? projects.find((p) => p.id === scope)
      : undefined;
  const archived = project?.status === "Closed";
  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [projectDialog, setProjectDialog] = useState<"new" | Project | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadProjects();
    void loadTasks();
    void loadFocusSessions();
    void loadTimeblocks();
  }, [loadProjects, loadTasks, loadFocusSessions, loadTimeblocks]);

  const navigate = (next: Scope, taskUid?: string) => {
    const query = new URLSearchParams();
    if (next !== "all") query.set("project", String(next));
    if (taskUid) query.set("task", taskUid);
    const qs = query.toString();
    router.replace(`/projects${qs ? `?${qs}` : ""}`, { scroll: false });
  };
  const selectScope = (next: Scope) => {
    setShowDone(false);
    setShowTrash(false);
    navigate(next);
  };
  const openTask = (task: Task) => navigate(scope, task.uid);
  const closeTask = () => navigate(scope);

  const act = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save changes",
      );
    }
  };
  const focusTask = (task: Task) => {
    if (!task.uid || task.deletedAt || task.completedAt) return;
    const parent = projects.find((p) => p.id === task.projectId);
    startTask({
      uid: task.uid,
      projectUid: parent?.uid,
      title: task.title,
      tag: task.primaryTag || task.tags[0] || "Focus",
    });
    toast(`Focusing on ${task.title}`);
  };
  const toggleDone = (task: Task) =>
    void act(() =>
      updateTask(task.id!, {
        completedAt: task.completedAt ? null : new Date(),
      }),
    );

  const openProjects = projects.filter((p) => p.status !== "Closed");
  const closedProjects = projects.filter((p) => p.status === "Closed");
  const closedIds = useMemo(
    () => new Set(projects.filter((p) => p.status === "Closed").map((p) => p.id)),
    [projects],
  );

  const inScope = useMemo(
    () =>
      tasks.filter((t) => {
        if (scope === "all") return !closedIds.has(t.projectId ?? undefined);
        if (scope === "none") return !t.projectId;
        return t.projectId === scope;
      }),
    [tasks, scope, closedIds],
  );
  const open = inScope.filter((t) => !t.deletedAt && !t.completedAt).sort(byNext);
  const done = inScope
    .filter((t) => !t.deletedAt && t.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    );
  const trashed = inScope.filter((t) => t.deletedAt);

  const stats = useMemo(() => {
    const map = new Map<number | "none" | "all", { open: number; done: number }>();
    const bump = (key: number | "none" | "all", t: Task) => {
      const s = map.get(key) || { open: 0, done: 0 };
      if (t.completedAt) s.done++;
      else s.open++;
      map.set(key, s);
    };
    for (const t of tasks) {
      if (t.deletedAt) continue;
      bump(t.projectId ?? "none", t);
      if (!closedIds.has(t.projectId ?? undefined)) bump("all", t);
    }
    return map;
  }, [tasks, closedIds]);

  const actualByTask = useMemo(
    () => new Map(tasks.map((t) => [t.id, taskMinutes(t, focusSessions)])),
    [tasks, focusSessions],
  );
  const projectFocused = project
    ? focusSessions
        .filter(
          (s) =>
            (!!project.uid && s.projectUid === project.uid) ||
            inScope.some((t) => !!t.uid && t.uid === s.taskUid),
        )
        .reduce((sum, s) => sum + sessionMinutes(s), 0)
    : 0;

  const addQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || adding) return;
    setAdding(true);
    try {
      await addTask(quickTitle, {
        projectId: typeof scope === "number" ? scope : null,
      });
      setQuickTitle("");
      inputRef.current?.focus();
    } catch {
      toast.error("Could not add task");
    } finally {
      setAdding(false);
    }
  };

  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      project={
        scope === "all"
          ? projects.find((p) => p.id === task.projectId)?.title
          : undefined
      }
      actualMinutes={actualByTask.get(task.id) || 0}
      active={timer.isRunning && timer.task?.uid === task.uid}
      selected={selectedTask?.id === task.id}
      onSelect={() => openTask(task)}
      onComplete={() => toggleDone(task)}
      onFocus={() => focusTask(task)}
    />
  );

  const projectStats = project ? stats.get(project.id!) : undefined;
  const projectTotal = (projectStats?.open || 0) + (projectStats?.done || 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col p-3 sm:p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <Button size="sm" variant="ghost" onClick={() => setProjectDialog("new")}>
          <Plus className="size-4" />
          New project
        </Button>
      </header>

      <nav
        aria-label="Projects"
        className="-mx-3 mb-5 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0"
      >
        <ScopeTab
          label="All tasks"
          count={stats.get("all")?.open || 0}
          active={scope === "all"}
          onClick={() => selectScope("all")}
        />
        {(stats.get("none")?.open || scope === "none") ? (
          <ScopeTab
            label="No project"
            count={stats.get("none")?.open || 0}
            active={scope === "none"}
            onClick={() => selectScope("none")}
          />
        ) : null}
        {openProjects.map((p) => {
          const s = stats.get(p.id!);
          const total = (s?.open || 0) + (s?.done || 0);
          return (
            <ScopeTab
              key={p.id}
              label={p.title}
              count={s?.open || 0}
              progress={total ? (s!.done / total) * 100 : 0}
              active={scope === p.id}
              onClick={() => selectScope(p.id!)}
            />
          );
        })}
        {closedProjects.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary",
                archived && "text-foreground",
              )}
            >
              Archived
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {closedProjects.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => selectScope(p.id!)}>
                  {p.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>

      {project && (
        <section className="mb-5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {project.title}
              {archived && (
                <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                  Archived
                </span>
              )}
            </h2>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              {projectStats?.done || 0} of {projectTotal} done ·{" "}
              {formatMinutes(projectFocused)} focused
            </p>
            {project.notes && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {project.notes}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Project options"
              className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setProjectDialog(project)}>
                <Pencil className="size-4" />
                Edit project
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void act(async () => {
                    await useProjects.getState().updateProject(project.id!, {
                      status: archived ? "Active" : "Closed",
                    });
                    toast(archived ? "Project restored" : "Project archived");
                    if (!archived) selectScope("all");
                  })
                }
              >
                {archived ? (
                  <RotateCcw className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
                {archived ? "Restore project" : "Archive project"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>
      )}

      {!archived && (
        <form
          onSubmit={addQuickTask}
          className="mb-3 flex items-center gap-2 rounded-xl bg-muted/40 p-1.5 pl-3 focus-within:ring-2 focus-within:ring-primary/40"
        >
          <Plus className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            aria-label="New task title"
            placeholder={project ? `Add a task to ${project.title}` : "Add a task"}
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            className="h-9 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button size="sm" type="submit" disabled={!quickTitle.trim() || adding}>
            Add
          </Button>
        </form>
      )}

      {error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm">
          <p>{error}</p>
          <Button variant="ghost" size="sm" onClick={() => void loadTasks()}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {archived
                ? "No open tasks in this project."
                : done.length
                  ? "All done here. Add the next task above."
                  : projects.length === 0 && scope === "all"
                    ? "Add a task above. Make a project when you want to group tasks."
                    : "No tasks yet. Add one above."}
            </p>
          ) : (
            <div>{open.map(row)}</div>
          )}

          {done.length > 0 && (
            <FoldSection
              label="Completed"
              count={done.length}
              open={showDone}
              onToggle={() => setShowDone(!showDone)}
            >
              {done.map(row)}
            </FoldSection>
          )}
          {trashed.length > 0 && (
            <FoldSection
              label="Trash"
              count={trashed.length}
              open={showTrash}
              onToggle={() => setShowTrash(!showTrash)}
            >
              {trashed.map(row)}
            </FoldSection>
          )}
        </>
      )}

      <Sheet
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) closeTask();
        }}
      >
        <SheetContent className="w-full overflow-hidden p-0 sm:max-w-md [&>button]:hidden">
          <SheetTitle className="sr-only">Task details</SheetTitle>
          <SheetDescription className="sr-only">
            Edit project, deadline, estimate, tags, and notes.
          </SheetDescription>
          {selectedTask && (
            <TaskDetails
              key={selectedTask.id}
              task={selectedTask}
              onClose={closeTask}
              onFocus={focusTask}
            />
          )}
        </SheetContent>
      </Sheet>

      {projectDialog && (
        <ProjectEditor
          project={projectDialog === "new" ? undefined : projectDialog}
          onClose={() => setProjectDialog(null)}
          onCreated={(id) => selectScope(id)}
        />
      )}
    </div>
  );
}

function ScopeTab({
  label,
  count,
  progress,
  active,
  onClick,
}: {
  label: string;
  count: number;
  /** Share of the project's tasks that are done, drawn under the tab. */
  progress?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex max-w-48 shrink-0 items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        active
          ? "bg-primary/12 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      {count > 0 && (
        <span className="font-mono text-[11px] tabular-nums opacity-70">
          {count}
        </span>
      )}
      {progress !== undefined && progress > 0 && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 bg-current opacity-60"
          style={{ width: `${progress}%` }}
        />
      )}
    </button>
  );
}

function FoldSection({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
        {label}
        <span className="font-mono tabular-nums">{count}</span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </section>
  );
}

function ProjectEditor({
  project,
  onClose,
  onCreated,
}: {
  project?: Project;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { addProject, updateProject } = useProjects();
  const [title, setTitle] = useState(project?.title || "");
  const [notes, setNotes] = useState(project?.notes || "");
  const [busy, setBusy] = useState(false);
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={project ? "Edit project" : "New project"}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            if (project) {
              await updateProject(project.id!, { title: title.trim(), notes });
            } else {
              await addProject(title.trim(), "Active", "", notes);
              const created = useProjects.getState().projects.at(-1);
              if (created?.id) onCreated(created.id);
            }
            onClose();
          } catch {
            toast.error("Could not save project");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-xs text-muted-foreground">
          Name
          <Input
            aria-label="Project name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="mt-1.5"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Notes (optional)
          <Textarea
            aria-label="Project notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1.5"
          />
        </label>
        <Button type="submit" disabled={!title.trim() || busy}>
          {project ? "Save project" : "Create project"}
        </Button>
      </form>
    </ResponsiveDialog>
  );
}
