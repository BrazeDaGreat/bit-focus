/**
 * Mini Timer - Compact Timer Controls for the Top Bar
 *
 * A condensed version of the Focus page timer that lives in the {@link TopBar},
 * letting users start, pause, and reset a focus or Pomodoro session from
 * anywhere in the app without navigating away.
 *
 * State is not duplicated: this reads and drives the shared {@link usePomo}
 * context (the same one the Focus page, sidebar footer timer, and PiP window
 * use), so the displayed time, mode, phase, and active tag stay in sync across
 * every surface. Tag selection uses the shared {@link useTag} store.
 *
 * Layout:
 * - Always-visible pill: status dot, monospace time, and a Start/Pause button.
 * - A popover (chevron) holds the less-frequent controls: mode toggle, active
 *   tag selection, reset, and a link to the full Focus page.
 *
 * @fileoverview Top-bar mini timer wired to the shared Pomodoro context.
 * @author BIT Focus Development Team
 * @since v0.18.2-beta
 */

"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { usePomo } from "@/hooks/PomoContext";
import { useTag } from "@/hooks/useTag";
import { cn, formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FaPlay,
  FaPause,
  FaForwardFast,
  FaChevronDown,
  FaHashtag,
  FaArrowRightLong,
} from "react-icons/fa6";
import { IoIosTimer } from "react-icons/io";
import { GiTomato } from "react-icons/gi";

/** Compute the seconds to display, mirroring the Focus page / footer timer. */
function displaySeconds(state: ReturnType<typeof usePomo>["state"]): number {
  const { mode, phase, elapsedSeconds, pomodoroSettings } = state;
  if (mode === "pomodoro" && phase === "focus") {
    return Math.max(0, pomodoroSettings.focusDuration * 60 - elapsedSeconds);
  }
  if (mode === "pomodoro" && phase === "break") {
    return Math.max(0, pomodoroSettings.breakDuration * 60 - elapsedSeconds);
  }
  return elapsedSeconds;
}

export default function MiniTimer({
  className,
}: {
  className?: string;
}): JSX.Element {
  const { state, start, pause, reset, setMode } = usePomo();
  const { tag, setTag, removeTag, savedTags } = useTag();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [customTag, setCustomTag] = useState("");

  const { isRunning, elapsedSeconds, mode, phase } = state;
  const isPaused = !isRunning && elapsedSeconds > 0;
  const isActive = isRunning || isPaused;

  const total = displaySeconds(state);

  const modeLabel =
    mode === "pomodoro" ? (phase === "focus" ? "Focus" : "Break") : "Standard";
  const tagColor = savedTags.find((t) => t.t === tag)?.c;

  const applyCustomTag = () => {
    const t = customTag.trim();
    if (!t) return;
    setTag(t);
    setCustomTag("");
  };

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border bg-card pl-2 pr-0.5 sm:gap-2 sm:pl-2.5 sm:pr-1",
        className
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          "hidden size-2 shrink-0 rounded-full min-[360px]:block",
          isRunning
            ? "bg-emerald-500 animate-pulse"
            : isPaused
            ? "bg-amber-400"
            : "bg-muted-foreground/40"
        )}
        title={isRunning ? "Running" : isPaused ? "Paused" : "Idle"}
      />

      {/* Time */}
      <span className="min-w-[3.2rem] flex-1 font-mono text-sm font-semibold tracking-tight tabular-nums lg:flex-none">
        {formatClock(total)}
      </span>

      {/* Start / Pause */}
      <Button
        size="icon"
        variant={isRunning ? "secondary" : "default"}
        onClick={isRunning ? pause : start}
        className="size-6 rounded-full"
        title={isRunning ? "Pause" : "Start"}
      >
        {isRunning ? (
          <FaPause className="size-2.5" />
        ) : (
          <FaPlay className="size-2.5" />
        )}
      </Button>

      {/* More controls */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="grid place-items-center size-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Timer options"
          >
            <FaChevronDown className="size-2.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3">
          {/* Status line */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {isActive ? (isRunning ? "Running" : "Paused") : "Ready"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {modeLabel}
            </span>
          </div>

          {/* Mode toggle */}
          <div className="mt-3 flex items-center gap-1 bg-muted rounded-full p-1">
            <button
              onClick={() => setMode("standard")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors font-medium",
                mode === "standard"
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
                "flex flex-1 items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors font-medium",
                mode === "pomodoro"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GiTomato className="size-3" />
              Pomodoro
            </button>
          </div>

          {/* Tag selection */}
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Tag
            </p>
            <div className="flex gap-2">
              <Input
                className="h-8"
                placeholder="Set a tag…"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustomTag();
                  }
                }}
              />
            </div>

            {savedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {savedTags.map((t) => {
                  const active = t.t === tag;
                  return (
                    <button
                      key={t.t}
                      onClick={() => setTag(t.t)}
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border transition-colors",
                        !active && "border-transparent hover:bg-accent"
                      )}
                      style={
                        active
                          ? {
                              backgroundColor: t.c + "22",
                              color: t.c,
                              borderColor: t.c + "55",
                            }
                          : undefined
                      }
                    >
                      <FaHashtag className="size-2.5 opacity-70" />
                      {t.t}
                    </button>
                  );
                })}
              </div>
            )}

            {tag && (
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">
                  Active:{" "}
                  <span
                    className="font-medium"
                    style={tagColor ? { color: tagColor } : undefined}
                  >
                    #{tag}
                  </span>
                </span>
                <button
                  onClick={removeTag}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={!isActive}
              className="gap-1.5"
              title="Reset & save session"
            >
              <FaForwardFast className="size-3" />
              Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push("/focus");
              }}
              className="gap-1.5 text-muted-foreground"
            >
              Focus page
              <FaArrowRightLong className="size-3" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
