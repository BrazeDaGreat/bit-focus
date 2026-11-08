/**
 * Command Palette
 *
 * Ctrl/⌘+K opens a searchable list of everything you can do without
 * reaching for the mouse: drive the timer, switch tags and goals, jump to a
 * page or a project, change theme, open the notepad, or export a backup.
 *
 * The header mirrors the live timer, so the palette doubles as a glance at
 * where the session stands. Typing a word that isn't a saved tag offers to
 * use it as the session tag.
 *
 * @fileoverview Global command palette built on cmdk
 * @author BIT Focus Development Team
 * @since v0.23.0
 */

"use client";

import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { format } from "date-fns";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { usePomo, displaySeconds, phaseLabel } from "@/hooks/PomoContext";
import { useTag } from "@/hooks/useTag";
import { useFocusGoal, GOAL_PRESETS } from "@/hooks/useFocusGoal";
import { useConfig, type FeatureKey } from "@/hooks/useConfig";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useTimeblocks } from "@/hooks/useTimeblocks";
import { blockTimes, parseTaskInput } from "@/lib/task-parse";
import { useNotes } from "@/hooks/useNotes";
import { isTrashed, noteHref, noteTitle } from "@/lib/notes";
import { isTaskOverdue, taskDeadline, type Task } from "@/lib/tasks";
import { ProjectIcon } from "@/components/tasks/ProjectIcon";
import { useNotepad } from "@/hooks/useNotepad";
import { useCommandPalette, useShortcutsDialog } from "@/hooks/useShortcuts";
import { pipSupported, usePipWindow } from "@/hooks/usePipWindow";
import { THEMES } from "@/lib/ThemeManager";
import SaveManager from "@/lib/SaveManager";
import { humanMinutes } from "@/lib/timerRing";
import { cn, formatClock } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { FaPause, FaPlay } from "react-icons/fa";
import {
  FaArrowRight,
  FaBullseye,
  FaCalendarPlus,
  FaFileExport,
  FaForwardFast,
  FaGear,
  FaHashtag,
  FaListCheck,
  FaMagnifyingGlass,
  FaNoteSticky,
  FaPlus,
  FaRegKeyboard,
  FaRepeat,
  FaXmark,
  FaFolder,
} from "react-icons/fa6";
import { IoIosTimer } from "react-icons/io";
import { GiTomato } from "react-icons/gi";
import { TbPictureInPicture } from "react-icons/tb";

const PAGES: { title: string; url: string; key?: string; feature?: FeatureKey }[] = [
  { title: "Home", url: "/", key: "H" },
  { title: "Focus", url: "/focus", key: "F" },
  { title: "Focus Table", url: "/focus-table", key: "T" },
  { title: "Calendar", url: "/calendar", key: "C", feature: "calendar" },
  { title: "Projects", url: "/projects", key: "P", feature: "projects" },
  { title: "Notes", url: "/notes", key: "O", feature: "notes" },
  { title: "AI Chat", url: "/ai", key: "G", feature: "aiChat" },
  { title: "Rewards", url: "/rewards", key: "R", feature: "rewards" },
  { title: "Changelog", url: "/changelog", key: "L" },
  { title: "Settings", url: "/settings", key: "S" },
];

export default function CommandPalette(): JSX.Element {
  const { paletteOpen, setPaletteOpen } = useCommandPalette();
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { state, start, pause, reset, extend, setMode, resetCycle, startTask } = usePomo();
  const { tag, savedTags, setTag, removeTag } = useTag();
  const { goalMinutes, setGoal, clearGoal } = useFocusGoal();
  const { featureToggles } = useConfig();
  const { projects, loadProjects } = useProjects();
  const { tasks, loadTasks } = useTasks();
  const { notes, loadNotes } = useNotes();
  const addTimeblock = useTimeblocks((s) => s.addTimeblock);
  const planning = useRef(false);
  const parsed = useMemo(() => parseTaskInput(search, { projects }), [search, projects]);
  const planned = blockTimes(parsed);
  const rangeLabel = parsed.tokens.find((token) => token.kind === "block")?.label;

  const planBlock = async () => {
    if (planning.current) return;
    const now = new Date();
    const current = parseTaskInput(search, { now, projects });
    const times = blockTimes(current, now);
    if (!times) return;
    planning.current = true;
    try {
      const project = projects.find((p) => p.id === current.projectId);
      await addTimeblock(current.tags[0] || tag || "Focus", times.start, times.end, current.title, {
        projectUid: project?.uid,
      });
      toast(`Block planned for ${format(times.start, "EEE, MMM d")} ${current.tokens.find((token) => token.kind === "block")!.label}`);
    } catch {
      toast.error("Could not plan block");
    } finally {
      planning.current = false;
    }
  };

  useEffect(() => {
    if (paletteOpen && featureToggles.projects) loadProjects();
  }, [paletteOpen, featureToggles.projects, loadProjects]);

  useEffect(() => {
    if (paletteOpen && featureToggles.projects) {
      void loadTasks().catch(() => toast.error("Could not load tasks"));
    }
  }, [paletteOpen, featureToggles.projects, loadTasks]);

  useEffect(() => {
    if (paletteOpen && featureToggles.notes) {
      void loadNotes().catch(() => toast.error("Could not load notes"));
    }
  }, [paletteOpen, featureToggles.notes, loadNotes]);

  useEffect(() => {
    if (!paletteOpen) setSearch("");
  }, [paletteOpen]);

  /** Run an action, then close the palette. */
  const run = (action: () => void) => () => {
    setPaletteOpen(false);
    action();
  };

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.completedAt || t.deletedAt) return false;
      const project = projects.find((p) => p.id === t.projectId);
      if (project && project.status === "Closed") return false;
      return true;
    });
  }, [tasks, projects]);

  const displayedTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    const sortTasks = (list: Task[]) => {
      return [...list].sort((a, b) => {
        const aDue = taskDeadline(a)?.getTime() ?? Infinity;
        const bDue = taskDeadline(b)?.getTime() ?? Infinity;
        if (aDue !== bDue) return aDue - bDue;
        if (b.priority !== a.priority) return b.priority - a.priority;
        return (b.order ?? 0) - (a.order ?? 0) || (b.id ?? 0) - (a.id ?? 0);
      });
    };

    const sorted = sortTasks(activeTasks);

    if (!query) {
      return sorted.slice(0, 5);
    }

    const tokens = query.split(/\s+/).filter(Boolean);
    const matched = sorted.filter((task) => {
      const project = projects.find((p) => p.id === task.projectId);
      const haystack = `${task.title} ${project?.title ?? ""} ${task.tags.join(" ")}`.toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });

    return matched.slice(0, 15);
  }, [activeTasks, projects, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) {
      const selected = document.querySelector<HTMLElement>(
        '[cmdk-item][data-selected="true"], [cmdk-item][aria-selected="true"]'
      );
      const taskUid = selected?.getAttribute("data-task-uid");
      if (taskUid) {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen(false);
        router.push(`/projects?task=${encodeURIComponent(taskUid)}`);
      }
    }
  };

  const isPomodoro = state.mode === "pomodoro";
  const isBreak = isPomodoro && state.phase === "break";
  const hasElapsed = state.startTime !== null || state.elapsedSeconds > 0;
  const trimmed = search.trim().replace(/^#/, "");
  const offerNewTag =
    !planned &&
    trimmed.length > 0 &&
    trimmed.length <= 32 &&
    !savedTags.some((t) => t.t.toLowerCase() === trimmed.toLowerCase());

  return (
    <Command.Dialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      onKeyDown={handleKeyDown}
      label="Command palette"
      loop
      overlayClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.98] motion-safe:duration-150"
    >
      {/* Live timer strip */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "size-1.5 rounded-full",
            state.isRunning
              ? "bg-emerald-500 motion-safe:animate-pulse"
              : hasElapsed
              ? "bg-amber-400"
              : "bg-muted-foreground/40"
          )}
        />
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatClock(displaySeconds(state))}
        </span>
        <span>
          {isPomodoro ? phaseLabel(state) : state.isRunning ? "Counting up" : hasElapsed ? "Paused" : "Ready"}
        </span>
        {tag && <span className="truncate">· #{tag}</span>}
        {goalMinutes && !isPomodoro && <span>· goal {humanMinutes(goalMinutes)}</span>}
      </div>

      <div className="flex items-center gap-2.5 border-b px-4">
        <FaMagnifyingGlass className="size-3.5 shrink-0 text-muted-foreground" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or plan “Study tomorrow 2-4pm”…"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Kbd className="shrink-0">Esc</Kbd>
      </div>

      <Command.List className="max-h-[min(24rem,60dvh)] overflow-y-auto overscroll-contain p-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-muted-foreground">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nothing matches “{search}”.
        </Command.Empty>

        {planned && (
          <Command.Group heading="Calendar">
            <Item
              icon={<FaCalendarPlus />}
              value={search}
              keywords={["plan", "block", "calendar"]}
              onSelect={run(() => { void planBlock(); })}
            >
              Plan block: {parsed.title} · <span className="font-mono tabular-nums">{format(planned.start, "EEE, MMM d")} {rangeLabel}</span>
              {parsed.tags[0] && <span className="ml-2 inline-flex rounded-md bg-primary/12 px-1.5 py-0.5 text-xs text-primary">#{parsed.tags[0]}</span>}
            </Item>
          </Command.Group>
        )}

        {/* ── Timer ── */}
        <Command.Group heading="Timer">
          <Item
            icon={state.isRunning ? <FaPause /> : <FaPlay />}
            onSelect={run(state.isRunning ? pause : start)}
            shortcut="Space"
            keywords={["start", "pause", "resume", "play", "stop"]}
          >
            {state.isRunning ? "Pause the timer" : hasElapsed ? "Resume the timer" : "Start the timer"}
          </Item>
          {hasElapsed && !isBreak && (
            <Item icon={<FaForwardFast />} onSelect={run(reset)} shortcut="Shift R" keywords={["stop", "end", "save"]}>
              Reset and save the session
            </Item>
          )}
          {isBreak && (
            <Item icon={<FaForwardFast />} onSelect={run(reset)} shortcut="N">
              Skip the break
            </Item>
          )}
          {isPomodoro && hasElapsed && (
            <Item icon={<FaPlus />} onSelect={run(() => extend())} shortcut="+" keywords={["extend", "more", "time"]}>
              Add 5 minutes
            </Item>
          )}
          <Item
            icon={isPomodoro ? <IoIosTimer /> : <GiTomato />}
            onSelect={run(() => setMode(isPomodoro ? "standard" : "pomodoro"))}
            keywords={["mode", "standard", "pomodoro"]}
          >
            {isPomodoro ? "Switch to Standard" : "Switch to Pomodoro"}
          </Item>
          {isPomodoro && state.completedPomodoros > 0 && (
            <Item icon={<FaRepeat />} onSelect={run(resetCycle)} keywords={["cycle", "long break"]}>
              Start the Pomodoro cycle over
            </Item>
          )}
          <Item
            icon={<TbPictureInPicture />}
            onSelect={run(() => {
              if (!pipSupported()) {
                toast("Picture in picture needs a Chromium browser, like Chrome or Edge.");
                return;
              }
              void usePipWindow.getState().open();
            })}
            keywords={["pip", "float", "mini", "window"]}
          >
            Open picture in picture
          </Item>
        </Command.Group>

        {/* ── Tags ── */}
        <Command.Group heading="Tag">
          {offerNewTag && (
            <Item icon={<FaPlus />} onSelect={run(() => setTag(trimmed))} value={`new-tag ${trimmed}`}>
              Tag this session “{trimmed}”
            </Item>
          )}
          {savedTags.map((saved) => (
            <Item
              key={saved.t}
              icon={<span className="size-2 rounded-full" style={{ backgroundColor: saved.c }} />}
              onSelect={run(() => setTag(saved.t))}
              value={`tag ${saved.t}`}
              keywords={["tag", saved.t]}
              hint={saved.t === tag ? "Active" : undefined}
            >
              #{saved.t}
            </Item>
          ))}
          {tag && (
            <Item icon={<FaXmark />} onSelect={run(removeTag)} keywords={["tag", "remove"]}>
              Clear the tag
            </Item>
          )}
          {savedTags.length === 0 && !offerNewTag && (
            <Item icon={<FaHashtag />} onSelect={run(() => router.push("/"))} keywords={["tag"]}>
              Add saved tags on Home
            </Item>
          )}
        </Command.Group>

        {/* ── Goal (standard timer) ── */}
        {!isPomodoro && (
          <Command.Group heading="Session goal">
            {GOAL_PRESETS.map((minutes) => (
              <Item
                key={minutes}
                icon={<FaBullseye />}
                onSelect={run(() => setGoal(minutes))}
                value={`goal ${minutes}`}
                keywords={["goal", "target"]}
                hint={goalMinutes === minutes ? "Active" : undefined}
              >
                Goal: {humanMinutes(minutes)}
              </Item>
            ))}
            {goalMinutes && (
              <Item icon={<FaXmark />} onSelect={run(clearGoal)} keywords={["goal"]}>
                Remove the goal
              </Item>
            )}
          </Command.Group>
        )}

        {/* ── Pages ── */}
        <Command.Group heading="Go to">
          {PAGES.filter((p) => !p.feature || featureToggles[p.feature]).map((page) => (
            <Item
              key={page.url}
              icon={<FaArrowRight />}
              onSelect={run(() => router.push(page.url))}
              value={`page ${page.title}`}
              keywords={["go", "open", "page"]}
              shortcut={page.key}
            >
              {page.title}
            </Item>
          ))}
        </Command.Group>

        {/* ── Projects ── */}
        {featureToggles.projects && projects.length > 0 && (
          <Command.Group heading="Projects">
            {projects
              .filter((p) => p.status !== "Closed")
              .map((project) => (
                <Item
                  key={project.id}
                  icon={<FaFolder />}
                  onSelect={run(() => router.push(`/projects/${project.id}`))}
                  value={`project ${project.id} ${project.title}`}
                  keywords={["project", project.title]}
                  hint={project.status}
                >
                  {project.title}
                </Item>
              ))}
          </Command.Group>
        )}

        {/* ── Tasks ── */}
        {featureToggles.projects && displayedTasks.length > 0 && (
          <Command.Group heading="Tasks">
            {displayedTasks.map((task) => {
              const project = projects.find((p) => p.id === task.projectId);
              const deadline = taskDeadline(task);
              const dueLabel = deadline
                ? format(deadline, task.dueTime ? "MMM d · h:mm a" : "MMM d")
                : null;
              const overdue = deadline ? isTaskOverdue(task) : false;
              const primaryTag = task.primaryTag || task.tags[0];

              return (
                <Item
                  key={task.uid ?? task.id}
                  icon={<FaListCheck />}
                  value={`task ${task.title} ${project?.title ?? ""} ${task.tags.join(" ")} ${task.uid ?? task.id}`}
                  keywords={["task", ...(project?.title ? [project.title] : []), ...task.tags]}
                  dataTaskUid={task.uid}
                  onClick={(e) => {
                    if (e.shiftKey && task.uid) {
                      e.preventDefault();
                      e.stopPropagation();
                      run(() => router.push(`/projects?task=${encodeURIComponent(task.uid!)}`))();
                    }
                  }}
                  onSelect={run(() => {
                    if (task.uid) {
                      startTask({
                        uid: task.uid,
                        projectUid: project?.uid,
                        title: task.title,
                        tag: primaryTag || "Focus",
                      });
                    }
                  })}
                  actions={
                    <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground group-data-[selected=true]:inline-flex shrink-0">
                      <span className="inline-flex items-center gap-1">
                        <Kbd>↵</Kbd>
                        <span>Focus</span>
                      </span>
                      {task.uid && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            run(() => router.push(`/projects?task=${encodeURIComponent(task.uid!)}`))();
                          }}
                          title="Open in Projects (Shift+Enter)"
                          aria-label={`Open ${task.title} in Projects`}
                          className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-background/80 hover:text-foreground transition-colors"
                        >
                          <Kbd>⇧↵</Kbd>
                          <span>Open</span>
                        </button>
                      )}
                    </span>
                  }
                >
                  <span className="inline-flex min-w-0 max-w-full items-center gap-2">
                    <span className="truncate font-medium">{task.title}</span>
                    {(project || dueLabel || primaryTag) && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {project && (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-muted-foreground/60">·</span>
                            <span className="max-w-28 truncate">{project.title}</span>
                          </span>
                        )}
                        {dueLabel && (
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <span className="text-muted-foreground/60">·</span>
                            <span className={cn(overdue && "text-destructive font-medium")}>{dueLabel}</span>
                          </span>
                        )}
                        {primaryTag && (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-muted-foreground/60">·</span>
                            <span>#{primaryTag}</span>
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </Item>
              );
            })}
          </Command.Group>
        )}

        {featureToggles.notes && (
          <Command.Group heading="Notes">
            <Item icon={<FaPlus />} onSelect={run(() => router.push("/notes?new=1"))} keywords={["notes", "create"]}>
              New page
            </Item>
            {notes.filter((note) => !isTrashed(note) && !note.isTemplate).map((note) => (
              <Item
                key={note.uid ?? note.id}
                icon={<ProjectIcon name={note.icon ?? "FileText"} />}
                onSelect={run(() => router.push(noteHref(note)))}
                value={`note ${note.uid ?? note.id} ${noteTitle(note)}`}
                keywords={["notes", "page", noteTitle(note)]}
              >
                {noteTitle(note)}
              </Item>
            ))}
          </Command.Group>
        )}

        {/* ── App ── */}
        <Command.Group heading="App">
          <Item
            icon={<FaNoteSticky />}
            onSelect={run(() => {
              const notepad = useNotepad.getState();
              notepad.setIsOpen(!notepad.isOpen);
            })}
            shortcut="Alt N"
            keywords={["notes", "calculator"]}
          >
            Toggle the notepad
          </Item>
          <Item icon={<FaGear />} onSelect={run(() => router.push("/settings"))} keywords={["preferences", "options"]}>
            Open settings
          </Item>
          <Item
            icon={<FaRegKeyboard />}
            onSelect={run(() => useShortcutsDialog.getState().setHelpOpen(true))}
            shortcut="?"
            keywords={["keys", "hotkeys"]}
          >
            Show keyboard shortcuts
          </Item>
          <Item
            icon={<FaFileExport />}
            onSelect={run(() => {
              SaveManager.exportData({ includeAttachments: true })
                .then(() => toast.success("Backup exported.", { id: "backup-export" }))
                .catch(() => toast.error("Export failed. Try again from the data menu."));
            })}
            keywords={["backup", "download", "data"]}
          >
            Export a backup
          </Item>
        </Command.Group>

        <Command.Group heading="Theme">
          {THEMES.map((t) => {
            const Icon = t.icon;
            return (
              <Item
                key={t.value}
                icon={<Icon className={t.iconClass} />}
                onSelect={run(() => setTheme(t.value))}
                value={`theme ${t.label}`}
                keywords={["theme", "colour", "color"]}
                hint={theme === t.value ? "Active" : undefined}
              >
                {t.label} theme
              </Item>
            );
          })}
        </Command.Group>
      </Command.List>

      {/* Palette footer */}
      <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            <span>Focus</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>⇧↵</Kbd>
            <span>Open task</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          <span>Close</span>
        </div>
      </div>
    </Command.Dialog>
  );
}

function Item({
  icon,
  onSelect,
  value,
  keywords,
  shortcut,
  hint,
  children,
  dataTaskUid,
  actions,
  onClick,
}: {
  icon: ReactNode;
  onSelect: () => void;
  value?: string;
  keywords?: string[];
  shortcut?: string;
  hint?: string;
  children: ReactNode;
  dataTaskUid?: string;
  actions?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}): JSX.Element {
  return (
    <Command.Item
      onSelect={onSelect}
      value={value}
      keywords={keywords}
      data-task-uid={dataTaskUid}
      onClick={onClick}
      className="group flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm text-foreground/90 data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
    >
      <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {actions}
      {hint && <span className="shrink-0 text-[11px] text-muted-foreground">{hint}</span>}
      {shortcut && (
        <span className="flex shrink-0 gap-1">
          {shortcut.split(" ").map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}
