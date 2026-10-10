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

import { useEffect, useState, type JSX, type ReactNode } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { usePomo, displaySeconds, phaseLabel } from "@/hooks/PomoContext";
import { useTag } from "@/hooks/useTag";
import { useFocusGoal, GOAL_PRESETS } from "@/hooks/useFocusGoal";
import { useConfig, type FeatureKey } from "@/hooks/useConfig";
import { useProjects } from "@/hooks/useProjects";
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
  FaFileExport,
  FaForwardFast,
  FaGear,
  FaHashtag,
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
  const { state, start, pause, reset, extend, setMode, resetCycle } = usePomo();
  const { tag, savedTags, setTag, removeTag } = useTag();
  const { goalMinutes, setGoal, clearGoal } = useFocusGoal();
  const { featureToggles } = useConfig();
  const { projects, loadProjects } = useProjects();

  useEffect(() => {
    if (paletteOpen && featureToggles.projects) loadProjects();
  }, [paletteOpen, featureToggles.projects, loadProjects]);

  useEffect(() => {
    if (!paletteOpen) setSearch("");
  }, [paletteOpen]);

  /** Run an action, then close the palette. */
  const run = (action: () => void) => () => {
    setPaletteOpen(false);
    action();
  };

  const isPomodoro = state.mode === "pomodoro";
  const isBreak = isPomodoro && state.phase === "break";
  const hasElapsed = state.startTime !== null || state.elapsedSeconds > 0;
  const trimmed = search.trim().replace(/^#/, "");
  const offerNewTag =
    trimmed.length > 0 &&
    trimmed.length <= 32 &&
    !savedTags.some((t) => t.t.toLowerCase() === trimmed.toLowerCase());

  return (
    <Command.Dialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
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
          placeholder="Type a command, page, tag or project…"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Kbd className="shrink-0">Esc</Kbd>
      </div>

      <Command.List className="max-h-[min(24rem,60dvh)] overflow-y-auto overscroll-contain p-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-muted-foreground">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nothing matches “{search}”.
        </Command.Empty>

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
              SaveManager.exportData()
                .then(() => toast.success("Backup exported."))
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
}: {
  icon: ReactNode;
  onSelect: () => void;
  value?: string;
  keywords?: string[];
  shortcut?: string;
  hint?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Command.Item
      onSelect={onSelect}
      value={value}
      keywords={keywords}
      className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm text-foreground/90 data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
    >
      <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
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
