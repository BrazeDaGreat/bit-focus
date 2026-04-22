"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { usePomo } from "@/hooks/PomoContext";
import { FocusSession, useFocus } from "@/hooks/useFocus";
import { useTag } from "@/hooks/useTag";
import {
  calculateTime,
  cn,
  durationFromSeconds,
  formatTime,
  formatTimeNew,
} from "@/lib/utils";
import { useTheme } from "next-themes";
import { FaPause, FaPlay, FaTrash, FaYoutube } from "react-icons/fa";
import {
  FaChevronDown,
  FaEllipsis,
  FaForwardFast,
  FaGear,
} from "react-icons/fa6";
import { IoIosTimer } from "react-icons/io";
import { GiTomato } from "react-icons/gi";
import { TbPictureInPicture } from "react-icons/tb";
import { Toaster } from "@/components/ui/sonner";
import TagBadge from "@/components/TagBadge";
import { EditFocusSession } from "./EditFocusSection";
import GraphDialog from "./Graph";
import PomodoroSettings from "@/components/PomodoroSettings";
import { usePip, usePipSpace } from "@/hooks/usePip";
import PipTimer from "@/components/PipTimer";
import YouTubePlayer from "@/components/YouTubePlayer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { type JSX, useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";

// ── helpers ───────────────────────────────────────────────────────────────────

function calcDisplayTime(state: ReturnType<typeof usePomo>["state"]) {
  const { mode, phase, elapsedSeconds, pomodoroSettings } = state;
  const raw =
    mode === "pomodoro" && phase === "focus"
      ? Math.max(0, pomodoroSettings.focusDuration * 60 - elapsedSeconds)
      : mode === "pomodoro" && phase === "break"
      ? Math.max(0, pomodoroSettings.breakDuration * 60 - elapsedSeconds)
      : elapsedSeconds;
  return { minutes: Math.floor(raw / 60), seconds: raw % 60 };
}

function calcProgress(state: ReturnType<typeof usePomo>["state"]): number {
  const { mode, phase, elapsedSeconds, pomodoroSettings } = state;
  if (mode !== "pomodoro") return 0;
  const total =
    phase === "focus"
      ? pomodoroSettings.focusDuration * 60
      : pomodoroSettings.breakDuration * 60;
  return Math.min(100, (elapsedSeconds / total) * 100);
}

// ── Focus Page ─────────────────────────────────────────────────────────────────

export default function Focus(): JSX.Element {
  const { theme } = useTheme();
  const { state, start, pause, reset, setMode } = usePomo();
  const { focusSessions, loadFocusSessions } = useFocus();
  const isMobile = useIsMobile();

  const [showSettings, setShowSettings] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);

  useEffect(() => {
    loadFocusSessions();
  }, [loadFocusSessions]);

  // PiP setup
  const { show } = usePip(PipTimer, {
    width: 300,
    height: 200,
    injectStyles: `
    * { padding:0; margin:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#0c0c0e; }
    button { cursor:pointer; }
    button:focus { outline:none; }
    `,
  });

  const { data, update } = usePipSpace("piptimer", {
    time: state.elapsedSeconds,
    running: state.isRunning,
    mode: state.mode,
    phase: state.phase,
    pomodoroSettings: state.pomodoroSettings,
    inc: { pause: 0, resume: 0 },
  });

  useEffect(() => {
    update({
      time: state.elapsedSeconds,
      running: state.isRunning,
      mode: state.mode,
      phase: state.phase,
      pomodoroSettings: state.pomodoroSettings,
    });
  }, [state, update]);

  useEffect(() => {
    if (data.inc.pause === 1) {
      pause();
      update({ running: false, inc: { pause: 0, resume: 0 } });
    }
    if (data.inc.resume === 1) {
      start();
      update({ running: true, inc: { pause: 0, resume: 0 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, update]);

  const { minutes, seconds } = calcDisplayTime(state);
  const progress = calcProgress(state);

  const modeStrip =
    state.mode === "standard"
      ? "Standard Mode"
      : `Pomodoro · ${state.phase === "focus" ? "Focus" : "Break"} Phase`;

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Timer Stage ────────────────────────────────────────────────── */}
      <div className="w-full bg-card border-b">
        <div className="max-w-screen-xl mx-auto px-6 py-12 flex flex-col items-center relative">
          {/* PiP button — top-right corner of stage */}
          {!isMobile && (
            <button
              className="absolute top-4 right-6 size-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() =>
                show({}, {
                  width: state.mode === "pomodoro" ? 280 : 220,
                  height: state.mode === "pomodoro" ? 170 : 130,
                })
              }
              title="Picture in Picture"
            >
              <TbPictureInPicture className="size-4" />
            </button>
          )}

          {/* Mode strip */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            {modeStrip}
          </p>

          {/* Timer display */}
          <span
            className={cn(
              "font-mono font-semibold tracking-tighter leading-none select-none",
              isMobile ? "text-6xl" : "text-8xl"
            )}
          >
            {formatTime(minutes, seconds)}
          </span>

          {/* Progress bar — Pomodoro only */}
          {state.mode === "pomodoro" && (
            <div className="w-full max-w-md mx-auto mt-6 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Control strip */}
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            {/* Tag selector pill */}
            <TagSelectorPill />

            {/* Start / Pause */}
            <Button
              size="default"
              onClick={state.isRunning ? pause : start}
              className="gap-2 px-6"
            >
              {state.isRunning ? (
                <FaPause className="size-3.5" />
              ) : (
                <FaPlay className="size-3.5" />
              )}
              {state.isRunning ? "Pause" : "Start"}
            </Button>

            {/* Reset — only when there's elapsed time */}
            {(state.startTime !== null || state.elapsedSeconds > 0) && (
              <Button
                variant="outline"
                size="default"
                onClick={reset}
                className={cn("gap-2", isMobile && "w-9 px-0")}
                title="Reset"
              >
                <FaForwardFast className="size-3.5" />
                {!isMobile && "Reset"}
              </Button>
            )}

            {/* Pomodoro settings */}
            {state.mode === "pomodoro" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                title="Pomodoro settings"
              >
                <FaGear className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Secondary Bar ─────────────────────────────────────────────── */}
      <div className="border-b py-3 px-6 flex items-center justify-between gap-4 shrink-0">
        {/* Left: YouTube toggle pill */}
        <button
          onClick={() => setShowYouTube((v) => !v)}
          className={cn(
            "flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors",
            showYouTube
              ? "bg-accent text-foreground border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border-transparent"
          )}
        >
          <FaYoutube className="size-3.5 text-red-500" />
          <span className="text-xs">Music</span>
          <FaChevronDown
            className={cn(
              "size-2.5 transition-transform",
              showYouTube && "rotate-180"
            )}
          />
        </button>

        {/* Right: Mode toggle pills */}
        <div className="flex items-center gap-1 bg-muted rounded-full p-1">
          <button
            onClick={() => setMode("standard")}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors font-medium",
              state.mode === "standard"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <IoIosTimer className="size-3" />
            Standard
          </button>
          <button
            onClick={() => setMode("pomodoro")}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors font-medium",
              state.mode === "pomodoro"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GiTomato className="size-3" />
            Pomodoro
          </button>
        </div>
      </div>

      {/* ── YouTube Player (collapsible) ──────────────────────────────── */}
      {showYouTube && (
        <div className="border-b px-6 py-4 bg-card">
          <YouTubePlayer />
        </div>
      )}

      {/* ── Session Log ───────────────────────────────────────────────── */}
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-6">
        <SessionLog sessions={focusSessions} />
      </div>

      {/* ── Pomodoro Settings Dialog ──────────────────────────────────── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pomodoro Settings</DialogTitle>
            <DialogDescription>
              Configure your Pomodoro timer durations and behavior.
            </DialogDescription>
          </DialogHeader>
          <PomodoroSettings />
        </DialogContent>
      </Dialog>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

// ── Tag Selector Pill ─────────────────────────────────────────────────────────

function TagSelectorPill(): JSX.Element {
  const { tag, setTag, removeTag, savedTags } = useTag();
  const [open, setOpen] = useState(false);
  const [tempTag, setTempTag] = useState("");

  const tagColor = savedTags.find((t) => t.t === tag)?.c;

  const handleSave = () => {
    if (tempTag.trim()) {
      setTag(tempTag.trim());
    }
    setOpen(false);
    setTempTag("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="gap-2 rounded-full px-4"
          style={
            tag && tagColor
              ? {
                  borderColor: tagColor + "66",
                  backgroundColor: tagColor + "15",
                }
              : undefined
          }
        >
          {tag ? (
            <>
              <span
                className="size-2 rounded-full shrink-0"
                style={{
                  backgroundColor: tagColor ?? "hsl(var(--muted-foreground))",
                }}
              />
              <span className="text-sm max-w-24 truncate">{tag}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No tag</span>
          )}
          <FaChevronDown className="size-2.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Tag
          </p>

          {/* Saved tag chips */}
          {savedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedTags.map((t) => (
                <button
                  key={t.t}
                  onClick={() => {
                    setTag(t.t);
                    setOpen(false);
                  }}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-medium transition-opacity hover:opacity-80",
                    tag === t.t && "ring-2 ring-offset-1"
                  )}
                  style={{
                    backgroundColor: t.c + "33",
                    color: t.c,
                    border: `1px solid ${t.c}55`,
                  }}
                >
                  {t.t}
                </button>
              ))}
            </div>
          )}

          {/* Custom tag input */}
          <div className="flex gap-2">
            <Input
              value={tempTag}
              onChange={(e) => setTempTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Custom tag…"
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={handleSave} className="shrink-0 h-8">
              Set
            </Button>
          </div>

          {tag && (
            <button
              onClick={() => {
                removeTag();
                setOpen(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground text-left transition-colors"
            >
              Clear tag
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Session Log ───────────────────────────────────────────────────────────────

interface SessionGroup {
  date: string;
  label: string;
  sessions: FocusSession[];
  totalSeconds: number;
}

function SessionLog({ sessions }: { sessions: FocusSession[] }): JSX.Element {
  const [visibleCount, setVisibleCount] = useState(20);

  const groups = useMemo<SessionGroup[]>(() => {
    const sorted = [...sessions].sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    const map = new Map<string, SessionGroup>();
    const today = dayjs().format("YYYY-MM-DD");
    const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

    for (const s of sorted) {
      const key = dayjs(s.startTime).format("YYYY-MM-DD");
      if (!map.has(key)) {
        const label =
          key === today
            ? "Today"
            : key === yesterday
            ? "Yesterday"
            : dayjs(s.startTime).format("MMMM D, YYYY");
        map.set(key, { date: key, label, sessions: [], totalSeconds: 0 });
      }
      const g = map.get(key)!;
      g.sessions.push(s);
      g.totalSeconds += Math.max(
        0,
        (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) /
          1000
      );
    }

    return Array.from(map.values());
  }, [sessions]);

  // Flatten all sessions to apply the visible cap
  const allSessions = useMemo(
    () => groups.flatMap((g) => g.sessions),
    [groups]
  );
  const hasMore = allSessions.length > visibleCount;

  // Rebuild groups respecting the visible cap
  const visibleGroups = useMemo<SessionGroup[]>(() => {
    let remaining = visibleCount;
    const result: SessionGroup[] = [];
    for (const g of groups) {
      if (remaining <= 0) break;
      const slice = g.sessions.slice(0, remaining);
      remaining -= slice.length;
      result.push({ ...g, sessions: slice });
    }
    return result;
  }, [groups, visibleCount]);

  return (
    <div>
      {/* Log header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Session Log
        </p>
        <GraphDialog />
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            No sessions yet. Start the timer to begin tracking.
          </p>
        </div>
      ) : (
        <>
          {visibleGroups.map((group) => (
            <SessionDateGroup key={group.date} group={group} />
          ))}

          {hasMore && (
            <button
              onClick={() => setVisibleCount((n) => n + 20)}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Load more ({allSessions.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SessionDateGroup({ group }: { group: SessionGroup }): JSX.Element {
  const totalFormatted = formatTimeNew(
    durationFromSeconds(group.totalSeconds),
    "H:M:S",
    "text"
  );

  return (
    <div className="mb-6">
      {/* Group header */}
      <div className="flex items-center justify-between py-2 border-b">
        <span className="text-sm font-semibold">{group.label}</span>
        <span className="text-xs text-muted-foreground font-mono">
          {totalFormatted} total
        </span>
      </div>

      {/* Session rows */}
      {group.sessions.map((s) => (
        <SessionRow key={s.id} session={s} />
      ))}
    </div>
  );
}

function SessionRow({ session }: { session: FocusSession }): JSX.Element {
  const { removeFocusSession } = useFocus();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const duration = calculateTime(session.startTime, session.endTime);
  const durationText = formatTimeNew(duration, "H:M:S", "text");
  const startTimeStr = dayjs(session.startTime).format("HH:mm");

  return (
    <div className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 py-2 border-b border-dashed last:border-0 hover:bg-accent/40 transition-colors px-1 rounded-sm">
      {/* Start time */}
      <span className="text-xs text-muted-foreground font-mono tabular-nums">
        {startTimeStr}
      </span>

      {/* Tag chip */}
      <div className="min-w-0">
        <TagBadge tag={session.tag} />
      </div>

      {/* Duration */}
      <span className="text-sm font-mono font-medium tabular-nums shrink-0">
        {durationText}
      </span>

      {/* Actions */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Actions"
          >
            <FaEllipsis className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-xs font-mono text-muted-foreground">
            {dayjs(session.startTime).format("MMM D, YYYY")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <EditFocusSession
            item={session}
            setIsDropdownOpen={setDropdownOpen}
          />
          <DropdownMenuItem
            onClick={() => removeFocusSession(session.id!)}
            className="text-destructive focus:text-destructive gap-2"
          >
            <FaTrash className="size-3" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
