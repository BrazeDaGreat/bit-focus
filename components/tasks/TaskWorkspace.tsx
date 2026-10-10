"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CircleDashed,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
  DropdownMenuSeparator,
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
import { parseTaskInput, parsedToTaskFields } from "@/lib/task-parse";
import { ParsePreview } from "./ParsePreview";
import { TaskSyntaxHelp } from "./TaskSyntaxHelp";
import { TaskRow } from "./TaskRow";
import { TaskDetails } from "./TaskDetails";
import {
  ProjectRail,
  ProjectTiles,
  type ProjectScope,
  type ScopeStats,
} from "./ProjectNavigation";
import { DeadlineRunway } from "./DeadlineRunway";
import { TaskGroups, type TaskRowExtras } from "./TaskGroups";
import { ProjectEditor } from "./ProjectEditor";
import { ProjectIconPicker } from "./ProjectIconPicker";
import { TaskWorkspaceSkeleton } from "./TaskWorkspaceSkeleton";

function readScope(
  params: URLSearchParams,
  initialProjectId?: number,
): ProjectScope {
  const project = params.get("project");
  if (project === "none" || project === "all") return project;
  if (project && Number.isFinite(Number(project))) return Number(project);
  const view = params.get("view");
  if (view?.startsWith("project:") && Number.isFinite(Number(view.slice(8))))
    return Number(view.slice(8));
  if (view === "inbox") return "none";
  return initialProjectId ?? "all";
}

function byNext(a: Task, b: Task) {
  const da = taskDeadline(a)?.getTime() ?? Infinity;
  const db = taskDeadline(b)?.getTime() ?? Infinity;
  return da - db || a.order - b.order || a.id! - b.id!;
}

function sessionMinutes(session: { startTime: Date; endTime: Date }) {
  return Math.max(
    0,
    (new Date(session.endTime).getTime() -
      new Date(session.startTime).getTime()) /
      60000,
  );
}

export function TaskWorkspace({
  initialProjectId,
}: {
  initialProjectId?: number;
}) {
  const { tasks, loading, error, loadTasks, addTask, updateTask } = useTasks();
  const { projects, loadingProjects, loadProjects } = useProjects();
  const { focusSessions, loadFocusSessions } = useFocus();
  const { loadTimeblocks } = useTimeblocks();
  const { state: timer, startTask } = usePomo();
  const router = useRouter();
  const params = useSearchParams();
  const scope = readScope(params, initialProjectId);
  const selectedTask = tasks.find((task) => task.uid === params.get("task"));
  const project =
    typeof scope === "number"
      ? projects.find((p) => p.id === scope)
      : undefined;
  const archived = project?.status === "Closed";
  const missingProject = typeof scope === "number" && !project;
  const hasMobileSelection =
    initialProjectId !== undefined ||
    params.has("project") ||
    params.has("view") ||
    params.has("task");
  const [quickTitle, setQuickTitle] = useState("");
  const [ignore, setIgnore] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [projectDialog, setProjectDialog] = useState<"new" | Project | null>(
    null,
  );
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(
    () => parseTaskInput(quickTitle, { projects, ignore }),
    [quickTitle, projects, ignore],
  );

  useEffect(() => {
    void loadProjects();
    void loadTasks();
    void loadFocusSessions();
    void loadTimeblocks();
  }, [loadProjects, loadTasks, loadFocusSessions, loadTimeblocks]);

  const navigate = (next: ProjectScope, taskUid?: string) => {
    const query = new URLSearchParams();
    // An explicit all scope distinguishes the mobile task pane from its index.
    query.set("project", String(next));
    if (taskUid) query.set("task", taskUid);
    router.replace(`/projects?${query.toString()}`, { scroll: false });
  };
  const selectScope = (next: ProjectScope) => navigate(next);
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

  const closedIds = useMemo(
    () =>
      new Set(projects.filter((p) => p.status === "Closed").map((p) => p.id)),
    [projects],
  );
  const inScope = useMemo(
    () =>
      tasks.filter((task) => {
        if (scope === "all") return !closedIds.has(task.projectId ?? undefined);
        if (scope === "none") return !task.projectId;
        return task.projectId === scope;
      }),
    [tasks, scope, closedIds],
  );
  const open = inScope
    .filter((task) => !task.deletedAt && !task.completedAt)
    .sort(byNext);
  const done = inScope
    .filter((task) => !task.deletedAt && task.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    );
  const trashed = inScope.filter((task) => task.deletedAt);
  const stats = useMemo(() => {
    const map = new Map<ProjectScope, ScopeStats>();
    const bump = (key: ProjectScope, task: Task) => {
      const count = map.get(key) || { open: 0, done: 0 };
      if (task.completedAt) count.done++;
      else count.open++;
      map.set(key, count);
    };
    for (const task of tasks) {
      if (task.deletedAt) continue;
      bump(task.projectId ?? "none", task);
      if (!closedIds.has(task.projectId ?? undefined)) bump("all", task);
    }
    return map;
  }, [tasks, closedIds]);
  const actualByTask = useMemo(
    () =>
      new Map(tasks.map((task) => [task.id, taskMinutes(task, focusSessions)])),
    [tasks, focusSessions],
  );
  const focused = useMemo(() => {
    const taskUids = new Set(inScope.map((task) => task.uid).filter(Boolean));
    const projectUids = new Set(
      (scope === "all"
        ? projects.filter((p) => p.status !== "Closed")
        : project
          ? [project]
          : []
      )
        .map((p) => p.uid)
        .filter(Boolean),
    );
    return focusSessions
      .filter(
        (session) =>
          (session.taskUid && taskUids.has(session.taskUid)) ||
          (session.projectUid && projectUids.has(session.projectUid)),
      )
      .reduce((sum, session) => sum + sessionMinutes(session), 0);
  }, [inScope, projects, project, scope, focusSessions]);

  const addQuickTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed.title.trim() || adding) return;
    setAdding(true);
    try {
      const fields = {
        projectId: typeof scope === "number" ? scope : null,
        ...parsedToTaskFields(parsed),
      };
      await addTask(parsed.title, fields);
      if (
        parsed.projectId !== undefined &&
        parsed.projectId !== (typeof scope === "number" ? scope : null)
      ) {
        const destination = projects.find((p) => p.id === parsed.projectId);
        if (destination) toast(`Added to ${destination.title}`);
      }
      setQuickTitle("");
      setIgnore([]);
      inputRef.current?.focus();
    } catch {
      toast.error("Could not add task");
    } finally {
      setAdding(false);
    }
  };

  const row = (task: Task, extras: TaskRowExtras) => {
    const parent =
      scope === "all"
        ? projects.find((p) => p.id === task.projectId)
        : undefined;
    return (
      <TaskRow
        task={task}
        project={parent?.title}
        projectIcon={parent?.icon}
        {...extras}
        actualMinutes={actualByTask.get(task.id) || 0}
        active={timer.isRunning && timer.task?.uid === task.uid}
        selected={selectedTask?.id === task.id}
        onSelect={() => openTask(task)}
        onComplete={() => toggleDone(task)}
        onFocus={() => focusTask(task)}
      />
    );
  };
  const currentStats = stats.get(scope) || { open: 0, done: 0 };
  const navigationProps = {
    projects,
    tasks,
    stats,
    scope,
    onSelect: selectScope,
    onNew: () => setProjectDialog("new"),
  };

  if (loading || loadingProjects) return <TaskWorkspaceSkeleton />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-3 sm:p-6">
      <div className="flex min-w-0 items-start gap-5">
        <ProjectRail {...navigationProps} />
        {!hasMobileSelection && (
          <div className="min-w-0 flex-1 lg:hidden">
            <ProjectTiles {...navigationProps} />
          </div>
        )}
        <main
          className={cn(
            "min-w-0 flex-1 rounded-2xl border bg-card p-5 shadow-xs",
            !hasMobileSelection && "hidden lg:block",
          )}
        >
          <button
            type="button"
            onClick={() => router.replace("/projects", { scroll: false })}
            className="-ml-2 mb-4 flex h-10 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary lg:hidden"
          >
            <ArrowLeft className="size-4" />
            Projects
          </button>
          <header className="mb-6 flex items-start gap-3">
            {project ? (
              <ProjectIconPicker
                value={project.icon}
                onChange={(icon) =>
                  void act(() =>
                    useProjects.getState().updateProject(project.id!, { icon }),
                  )
                }
              />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                {scope === "none" ? (
                  <CircleDashed className="size-6" />
                ) : (
                  <ListChecks className="size-6" />
                )}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-xl font-semibold tracking-tight">
                {project?.title ||
                  (missingProject
                    ? "Project unavailable"
                    : scope === "none"
                      ? "No project"
                      : "All tasks")}
              </h1>
              <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                {currentStats.done} of {currentStats.open + currentStats.done}{" "}
                done · {formatMinutes(focused)} focused
              </p>
              {archived && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Archived project
                </p>
              )}
              {project?.notes && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {project.notes}
                </p>
              )}
            </div>
            {project && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Project options"
                  className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-xl shadow-xs"
                >
                  <DropdownMenuItem onSelect={() => setProjectDialog(project)}>
                    <Pencil className="size-4" />
                    Edit project
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      void act(async () => {
                        await useProjects
                          .getState()
                          .updateProject(project.id!, {
                            status: archived ? "Active" : "Closed",
                          });
                        toast(
                          archived ? "Project restored" : "Project archived",
                        );
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setProjectToDelete(project)}
                  >
                    <Trash2 className="size-4" />
                    Delete project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </header>
          {missingProject ? (
            <div className="rounded-xl bg-muted/40 p-5">
              <p className="text-sm font-medium">
                This project could not be found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a project from the list, or create a new one.
              </p>
            </div>
          ) : (
            <>
              <DeadlineRunway tasks={inScope} onOpenTask={openTask} />
              {!archived && (
                <form
                  onSubmit={addQuickTask}
                  className="mb-6 rounded-xl bg-muted/60 p-1 focus-within:ring-2 focus-within:ring-primary/40"
                >
                  <div className="flex min-w-0 items-center gap-1 pl-2">
                    <Plus
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      ref={inputRef}
                      aria-label="New task title"
                      placeholder="Add a task — try “Essay draft by Friday 5pm #uni”"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <TaskSyntaxHelp
                      onInsert={(example) => {
                        setQuickTitle(example);
                        setIgnore([]);
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!parsed.title.trim() || adding}
                      className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  {parsed.tokens.length > 0 && (
                    <div className="px-2 pb-2 pt-1">
                      <ParsePreview
                        tokens={parsed.tokens}
                        onIgnore={(key) =>
                          setIgnore((current) =>
                            current.includes(key) ? current : [...current, key],
                          )
                        }
                      />
                    </div>
                  )}
                </form>
              )}
              {error ? (
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-sm font-medium text-destructive">
                    Could not load tasks
                  </p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadTasks()}
                    className="mt-2 h-10 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <TaskGroups
                  key={scope}
                  open={open}
                  done={done}
                  trashed={trashed}
                  allTasks={tasks}
                  archived={archived}
                  renderRow={row}
                  expanded={expandedTasks}
                  onToggleSubtasks={(id) =>
                    setExpandedTasks((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                />
              )}
            </>
          )}
        </main>
      </div>
      <Sheet
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) closeTask();
        }}
      >
        <SheetContent className="w-full overflow-hidden p-0 shadow-xs sm:max-w-lg data-[state=open]:animate-none data-[state=closed]:animate-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out [&>button]:hidden">
          <SheetTitle className="sr-only">Task details</SheetTitle>
          <SheetDescription className="sr-only">
            Edit project, deadline, estimate, subtasks, tags, and notes.
          </SheetDescription>
          {selectedTask && (
            <TaskDetails
              key={selectedTask.id}
              task={selectedTask}
              onClose={closeTask}
              onFocus={focusTask}
              onOpenTask={openTask}
            />
          )}
        </SheetContent>
      </Sheet>
      {projectDialog && (
        <ProjectEditor
          project={projectDialog === "new" ? undefined : projectDialog}
          onClose={() => setProjectDialog(null)}
          onCreated={selectScope}
        />
      )}
      {projectToDelete && (
        <ResponsiveDialog
          open
          onOpenChange={(open) => {
            if (!open && !deletingProject) setProjectToDelete(null);
          }}
          title="Delete project?"
          description={`Permanently delete “${projectToDelete.title}” and all its tasks, subtasks, and attachments. This cannot be undone. Your recorded focus sessions will be kept.`}
        >
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deletingProject}
              onClick={() => setProjectToDelete(null)}
              className="h-10 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deletingProject}
              onClick={async () => {
                if (deletingProject) return;
                setDeletingProject(true);
                try {
                  await useProjects.getState().deleteProject(projectToDelete.id!);
                  setProjectToDelete(null);
                  navigate("all");
                  toast("Project deleted");
                } catch {
                  toast.error("Could not delete project");
                } finally {
                  setDeletingProject(false);
                }
              }}
              className="h-10 rounded-lg bg-destructive px-3 text-sm font-medium text-white hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-destructive disabled:pointer-events-none disabled:opacity-50"
            >
              {deletingProject ? "Deleting…" : "Delete project"}
            </button>
          </div>
        </ResponsiveDialog>
      )}
    </div>
  );
}
