"use client";

/**
 * Focus Page
 *
 * The timer stage and its controls. The page is built around one object — a
 * progress ring with the clock inside it — and one control dock beneath it, so
 * every timer decision is made in a single place.
 *
 * The ring always means something:
 * - Pomodoro fills toward the end of the current phase, in a different colour
 *   for focus and for break.
 * - Standard fills toward your session goal. Past the goal the ring changes
 *   colour and keeps sweeping, because a goal is a target, not a stop.
 * - With no goal set, standard sweeps once per hour of the session.
 *
 * The session log recedes while a session runs.
 */

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
  GOAL_MAX_MINUTES,
  GOAL_MIN_MINUTES,
  GOAL_PRESETS,
  useFocusGoal,
} from "@/hooks/useFocusGoal";
import { calculateTime, cn, formatClock, formatTimeNew } from "@/lib/utils";
import { useTheme } from "next-themes";
import { FaPause, FaPlay, FaTrash, FaYoutube } from "react-icons/fa";
import {
  FaArrowRightLong,
  FaBullseye,
  FaChevronDown,
  FaEllipsis,
  FaHashtag,
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
import ManualSessionDialog from "./ManualSession";
import PomodoroSettings from "@/components/PomodoroSettings";
import { usePip, usePipSpace } from "@/hooks/usePip";
import PipTimer from "@/components/PipTimer";
import YouTubePlayer from "@/components/YouTubePlayer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "next/navigation";
import { type JSX, type ReactNode, useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";

/** How many sessions the page keeps on screen before sending you to the table. */
const RECENT_SESSION_COUNT = 5;

/** Ring colours. Focus, break, and "past your goal" are three different states. */
const RING_FOCUS = "var(--primary)";
const RING_BREAK = "var(--chart-2)";
const RING_GOAL_MET = "#10b981";

// ── helpers ───────────────────────────────────────────────────────────────────

function calcDisplaySeconds(state: ReturnType<typeof usePomo>["state"]): number {
  const { mode, phase, elapsedSeconds, pomodoroSettings } = state;
  return mode === "pomodoro" && phase === "focus"
    ? Math.max(0, pomodoroSettings.focusDuration * 60 - elapsedSeconds)
    : mode === "pomodoro" && phase === "break"
    ? Math.max(0, pomodoroSettings.breakDuration * 60 - elapsedSeconds)
    : elapsedSeconds;
}

interface RingState {
  /** Ring fill, 0–1. */
  progress: number;
  /** Stroke colour for the current state. */
  color: string;
  /** Line above the clock. */
  label: string;
  /** Line below the clock, when there is something worth saying. */
  caption?: string;
}

/** Everything the ring needs to describe the current timer state. */
function describeRing(
  state: ReturnType<typeof usePomo>["state"],
  goalMinutes: number | null,
  hasElapsed: boolean
): RingState {
  const { mode, phase, elapsedSeconds, pomodoroSettings, isRunning } = state;

  if (mode === "pomodoro") {
    const isBreak = phase === "break";
    const total =
      (isBreak
        ? pomodoroSettings.breakDuration
        : pomodoroSettings.focusDuration) * 60;
    return {
      progress: total > 0 ? Math.min(1, elapsedSeconds / total) : 0,
      color: isBreak ? RING_BREAK : RING_FOCUS,
      label: isBreak ? "Break" : "Focus",
      caption: `${
        isBreak
          ? pomodoroSettings.breakDuration
          : pomodoroSettings.focusDuration
      } min phase`,
    };
  }

  const label = isRunning ? "Counting up" : hasElapsed ? "Paused" : "Ready";

  if (!goalMinutes) {
    // No target to measure against: sweep once per hour, like a dial hand.
    return {
      progress: (elapsedSeconds % 3600) / 3600,
      color: RING_FOCUS,
      label,
    };
  }

  const goalSeconds = goalMinutes * 60;

  if (elapsedSeconds < goalSeconds) {
    return {
      progress: elapsedSeconds / goalSeconds,
      color: RING_FOCUS,
      label,
      caption: `${humanMinutes(
        Math.ceil((goalSeconds - elapsedSeconds) / 60)
      )} to goal`,
    };
  }

  // Past the goal the session continues; the ring laps in the goal-met colour.
  const overflow = elapsedSeconds - goalSeconds;
  return {
    progress: (overflow % goalSeconds) / goalSeconds,
    color: RING_GOAL_MET,
    label: "Goal reached",
    caption: `${humanMinutes(Math.floor(overflow / 60))} past ${humanMinutes(
      goalMinutes
    )}`,
  };
}

/** "90m" under two hours, "1h 30m" above. */
function humanMinutes(minutes: number): string {
  if (minutes < 120) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

// ── Focus Page ─────────────────────────────────────────────────────────────────

export default function Focus(): JSX.Element {
  const { theme } = useTheme();
  const { state, start, pause, reset, setMode } = usePomo();
  const { focusSessions, loadFocusSessions } = useFocus();
  const { goalMinutes } = useFocusGoal();
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

  const hasElapsed = state.startTime !== null || state.elapsedSeconds > 0;
  const ring = describeRing(state, goalMinutes, hasElapsed);

  return (
    <div className="flex flex-1 flex-col">
      {/* ── Timer screen: ring centred, dock along the bottom edge ──────── */}
      <section className="flex min-h-[calc(100dvh-7rem)] flex-col lg:min-h-[calc(100dvh-3.5rem)]">
        {/* Ring takes the whole screen above the dock */}
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <TimerRing
            seconds={calcDisplaySeconds(state)}
            ring={ring}
            isRunning={state.isRunning}
            compact={isMobile}
          />
        </div>

        {/* ── Music — rides just above the dock ── */}
        {showYouTube && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 sm:px-6">
            <YouTubePlayer onClose={() => setShowYouTube(false)} />
          </div>
        )}

        {/* ── Control dock ── */}
        <div className="w-full border-y bg-card/80 backdrop-blur-md">
          {/* Three tracks: mode left, session controls centred, tools right.
              The outer columns are equal width so the centre group sits on the
              page's midline rather than drifting with the tool count. */}
          <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-center gap-x-1 gap-y-2 px-3 py-2.5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-4">
            {/* Mode: the setting that changes what everything else means */}
            <div className="flex items-center gap-1">
              <DockButton
                active={state.mode === "standard"}
                onClick={() => setMode("standard")}
                icon={<IoIosTimer className="size-3.5" />}
              >
                Standard
              </DockButton>
              <DockButton
                active={state.mode === "pomodoro"}
                onClick={() => setMode("pomodoro")}
                icon={<GiTomato className="size-3.5" />}
              >
                Pomodoro
              </DockButton>
            </div>

            {/* Session controls — the middle of the dock */}
            <div className="flex items-center justify-center gap-1">
              <DockDivider className="mr-2.5 ml-0" />

              <DockButton
                primary
                onClick={state.isRunning ? pause : start}
                icon={
                  state.isRunning ? (
                    <FaPause className="size-3.5" />
                  ) : (
                    <FaPlay className="size-3.5" />
                  )
                }
                className="min-w-28 justify-center"
              >
                {state.isRunning ? "Pause" : hasElapsed ? "Resume" : "Start"}
              </DockButton>

              {hasElapsed && (
                <DockButton
                  onClick={reset}
                  icon={<FaForwardFast className="size-3.5" />}
                  title="Reset the timer"
                >
                  Reset
                </DockButton>
              )}

              <TagSelectorPill />

              {state.mode === "standard" && <GoalPill />}

              <DockDivider className="ml-2.5 mr-0" />
            </div>

            {/* Session tools */}
            <div className="flex items-center justify-end gap-1">
              <DockButton
                active={showYouTube}
                onClick={() => setShowYouTube((v) => !v)}
                title={showYouTube ? "Hide music" : "Show music"}
                icon={
                  <FaYoutube
                    className={cn("size-3.5", showYouTube && "text-red-500")}
                  />
                }
              />

              {state.mode === "pomodoro" && (
                <DockButton
                  onClick={() => setShowSettings(true)}
                  title="Pomodoro settings"
                  icon={<FaGear className="size-3.5" />}
                />
              )}

              {!isMobile && (
                <DockButton
                  onClick={() =>
                    show(
                      {},
                      {
                        width: state.mode === "pomodoro" ? 280 : 220,
                        height: state.mode === "pomodoro" ? 170 : 130,
                      }
                    )
                  }
                  title="Open picture in picture"
                  icon={<TbPictureInPicture className="size-4" />}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent sessions ─────────────────────────────────────────────── */}
      <section
        className={cn(
          "mx-auto w-full max-w-screen-xl px-4 py-8 transition-opacity duration-500 sm:px-6",
          // A running session owns the screen; the log steps back until you
          // reach for it.
          state.isRunning && "opacity-40 hover:opacity-100"
        )}
      >
        <RecentSessions sessions={focusSessions} />
      </section>

      {/* ── Pomodoro settings ───────────────────────────────────────────── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-base">Pomodoro</DialogTitle>
            <DialogDescription className="text-xs">
              How long each focus block and break runs.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5">
            <PomodoroSettings />
          </div>
        </DialogContent>
      </Dialog>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

// ── Timer ring ────────────────────────────────────────────────────────────────

function TimerRing({
  seconds,
  ring,
  isRunning,
  compact,
}: {
  seconds: number;
  ring: RingState;
  isRunning: boolean;
  compact: boolean;
}): JSX.Element {
  const size = compact ? 236 : 300;
  const stroke = compact ? 10 : 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, ring.progress)));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Phase colour bleeds softly behind the ring */}
      <div
        className="absolute inset-6 rounded-full opacity-[0.07] blur-2xl transition-colors duration-700"
        style={{ backgroundColor: ring.color }}
        aria-hidden="true"
      />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ring.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset,stroke] duration-700 ease-out"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors duration-700"
          style={{ color: ring.color }}
        >
          {isRunning && (
            <span
              className="size-1.5 rounded-full motion-safe:animate-pulse"
              style={{ backgroundColor: ring.color }}
            />
          )}
          {ring.label}
        </span>

        <span
          className={cn(
            "mt-2 select-none font-mono font-semibold leading-none tracking-tighter tabular-nums",
            compact ? "text-5xl" : "text-6xl"
          )}
        >
          {formatClock(seconds)}
        </span>

        {ring.caption && (
          <span className="mt-2.5 text-xs text-muted-foreground">
            {ring.caption}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Dock pieces ───────────────────────────────────────────────────────────────

/**
 * The one button style in the dock.
 *
 * Every control — mode, start, reset, tag, goal, tools — is this shape: 40px
 * tall, `rounded-lg`, icon then optional label. Only the primary action is
 * filled; state is carried by a quiet `bg-muted` fill.
 */
const DOCK_BUTTON_BASE =
  "flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

function DockButton({
  active = false,
  primary = false,
  onClick,
  title,
  icon,
  className,
  children,
}: {
  active?: boolean;
  primary?: boolean;
  onClick: () => void;
  title?: string;
  icon: JSX.Element;
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  const label = title ?? (typeof children === "string" ? children : undefined);

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        DOCK_BUTTON_BASE,
        !children && "w-10 justify-center px-0",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Hairline between dock groups. */
function DockDivider({ className }: { className?: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn("mx-1.5 hidden h-6 w-px bg-border sm:block", className)}
    />
  );
}

// ── Tag selector ──────────────────────────────────────────────────────────────

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
        <button
          title="Session tag"
          className={cn(
            DOCK_BUTTON_BASE,
            "min-w-0 gap-2",
            tag
              ? "text-foreground hover:opacity-90"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          style={tag && tagColor ? { backgroundColor: tagColor + "24" } : undefined}
        >
          {tag ? (
            <>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: tagColor ?? "var(--muted-foreground)" }}
              />
              <span className="max-w-24 truncate">{tag}</span>
            </>
          ) : (
            <>
              <FaHashtag className="size-3.5" />
              Tag
            </>
          )}
          <FaChevronDown className="size-2.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 rounded-xl p-3">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Session tag
          </p>

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
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
                    tag === t.t && "ring-2 ring-offset-1 ring-offset-background"
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

          <div className="flex gap-2">
            <Input
              value={tempTag}
              onChange={(e) => setTempTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="New tag…"
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={handleSave} className="h-8 shrink-0">
              Set
            </Button>
          </div>

          {tag && (
            <button
              onClick={() => {
                removeTag();
                setOpen(false);
              }}
              className="text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear tag
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Goal picker ───────────────────────────────────────────────────────────────

function GoalPill(): JSX.Element {
  const { goalMinutes, setGoal, clearGoal } = useFocusGoal();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const applyCustom = () => {
    const value = Number(custom);
    if (!Number.isFinite(value)) return;
    setGoal(value);
    setCustom("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            DOCK_BUTTON_BASE,
            goalMinutes
              ? "bg-primary/12 text-foreground hover:bg-primary/20"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          title="Session goal"
        >
          <FaBullseye className={cn("size-3.5", goalMinutes && "text-primary")} />
          {goalMinutes ? humanMinutes(goalMinutes) : "Goal"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-xl p-3">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Session goal
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The timer keeps running past it — the ring just changes colour.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setGoal(preset);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  goalMinutes === preset
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {humanMinutes(preset)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              type="number"
              min={GOAL_MIN_MINUTES}
              max={GOAL_MAX_MINUTES}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyCustom()}
              placeholder="Minutes"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              onClick={applyCustom}
              disabled={!custom.trim()}
              className="h-8 shrink-0"
            >
              Set
            </Button>
          </div>

          {goalMinutes && (
            <button
              onClick={() => {
                clearGoal();
                setOpen(false);
              }}
              className="text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Remove goal
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Recent sessions ───────────────────────────────────────────────────────────

function RecentSessions({ sessions }: { sessions: FocusSession[] }): JSX.Element {
  const router = useRouter();

  const recent = useMemo(
    () =>
      [...sessions]
        .sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )
        .slice(0, RECENT_SESSION_COUNT),
    [sessions]
  );

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Recent sessions
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sessions.length === 0
              ? "Nothing tracked yet"
              : `Last ${Math.min(RECENT_SESSION_COUNT, sessions.length)} of ${
                  sessions.length
                }`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <ManualSessionDialog />
          <GraphDialog />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs"
            onClick={() => router.push("/focus-table")}
          >
            All sessions
            <FaArrowRightLong className="size-2.5" />
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl bg-muted/40 px-4 py-6">
          <p className="text-sm font-medium">No sessions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start the timer above, or add a session you tracked elsewhere.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {recent.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: FocusSession }): JSX.Element {
  const { removeFocusSession } = useFocus();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const duration = calculateTime(session.startTime, session.endTime);
  const durationText = formatTimeNew(duration, "H:M:S", "text");

  const startedAt = dayjs(session.startTime);
  const isToday = startedAt.isSame(dayjs(), "day");
  const isYesterday = startedAt.isSame(dayjs().subtract(1, "day"), "day");
  const dayLabel = isToday
    ? "Today"
    : isYesterday
    ? "Yesterday"
    : startedAt.format("MMM D");

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
      <div className="flex w-24 shrink-0 flex-col">
        <span className="font-mono text-sm tabular-nums">
          {startedAt.format("HH:mm")}
        </span>
        <span className="text-[11px] text-muted-foreground">{dayLabel}</span>
      </div>

      <div className="min-w-0">
        <TagBadge tag={session.tag} />
      </div>

      <span className="shrink-0 font-mono text-sm font-medium tabular-nums">
        {durationText}
      </span>

      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Session actions"
            aria-label="Session actions"
          >
            <FaEllipsis className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
            {startedAt.format("MMM D, YYYY")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <EditFocusSession item={session} setIsDropdownOpen={setDropdownOpen} />
          <DropdownMenuItem
            onClick={() => removeFocusSession(session.id!)}
            className="gap-2 rounded-lg text-destructive focus:text-destructive"
          >
            <FaTrash className="size-3" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
