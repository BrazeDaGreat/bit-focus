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
 * - The chevron opens a bottom drawer on mobile and an anchored popover on
 *   larger screens for mode, tag, reset, and full Focus page controls.
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
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  const isMobile = useIsMobile();

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

  const renderOptions = (showStatus: boolean): JSX.Element => (
    <div>
      {showStatus && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {isActive ? (isRunning ? "Running" : "Paused") : "Ready"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {modeLabel}
          </span>
        </div>
      )}

      {/* Mode toggle */}
      <div className={cn("flex items-center gap-1 rounded-full bg-muted p-1", showStatus && "mt-3")}>
        <button
          type="button"
          onClick={() => setMode("standard")}
          className={cn(
            "flex min-h-12 flex-1 touch-manipulation items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-[background-color,color,transform] active:scale-[0.98] motion-reduce:transition-none md:min-h-0 md:gap-1.5 md:px-3 md:py-1.5 md:text-xs",
            mode === "standard"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <IoIosTimer className="size-4 md:size-3" />
          Standard
        </button>
        <button
          type="button"
          onClick={() => setMode("pomodoro")}
          className={cn(
            "flex min-h-12 flex-1 touch-manipulation items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-[background-color,color,transform] active:scale-[0.98] motion-reduce:transition-none md:min-h-0 md:gap-1.5 md:px-3 md:py-1.5 md:text-xs",
            mode === "pomodoro"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <GiTomato className="size-4 md:size-3" />
          Pomodoro
        </button>
      </div>

      {/* Tag selection */}
      <div className="mt-5 md:mt-3">
        <label
          htmlFor="mini-timer-tag"
          className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Tag
        </label>
        <Input
          id="mini-timer-tag"
          className="h-12 rounded-xl text-base md:h-8 md:rounded-md md:text-sm"
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

        {savedTags.length > 0 && (
          <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto overscroll-contain md:mt-2 md:max-h-24 md:gap-1.5">
            {savedTags.map((savedTag) => {
              const active = savedTag.t === tag;
              return (
                <button
                  type="button"
                  key={savedTag.t}
                  onClick={() => setTag(savedTag.t)}
                  className={cn(
                    "flex min-h-10 touch-manipulation items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-[background-color,color,transform] active:scale-95 motion-reduce:transition-none md:min-h-0 md:gap-1 md:px-2 md:py-1 md:text-xs",
                    !active && "border-transparent hover:bg-accent"
                  )}
                  style={
                    active
                      ? {
                          backgroundColor: savedTag.c + "22",
                          color: savedTag.c,
                          borderColor: savedTag.c + "55",
                        }
                      : undefined
                  }
                >
                  <FaHashtag className="size-3 opacity-70 md:size-2.5" />
                  {savedTag.t}
                </button>
              );
            })}
          </div>
        )}

        {tag && (
          <div className="mt-2 flex min-h-10 items-center justify-between gap-3 text-sm md:min-h-0 md:text-xs">
            <span className="min-w-0 truncate text-muted-foreground">
              Active:{" "}
              <span
                className="font-medium"
                style={tagColor ? { color: tagColor } : undefined}
              >
                #{tag}
              </span>
            </span>
            <button
              type="button"
              onClick={removeTag}
              className="min-h-10 shrink-0 touch-manipulation rounded-full px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:min-h-0 md:px-0 md:hover:bg-transparent"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 md:mt-3 md:flex md:items-center md:justify-between md:gap-2 md:pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reset}
          disabled={!isActive}
          className="h-12 touch-manipulation gap-2 rounded-full md:h-8 md:gap-1.5 md:rounded-md"
          title="Reset and save session"
        >
          <FaForwardFast className="size-3" />
          Reset
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            router.push("/focus");
          }}
          className="h-12 touch-manipulation gap-2 rounded-full text-muted-foreground md:h-8 md:gap-1.5 md:rounded-md"
        >
          Focus page
          <FaArrowRightLong className="size-3" />
        </Button>
      </div>
    </div>
  );

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
      {isMobile ? (
        <MobileDrawer
          open={open}
          onOpenChange={setOpen}
          title="Timer options"
          description={`${isActive ? (isRunning ? "Running" : "Paused") : "Ready"} · ${modeLabel}`}
          contentClassName="max-h-[min(85dvh,42rem)]"
          trigger={
            <button
              type="button"
              className="grid size-6 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Timer options"
              aria-label="Open timer options"
            >
              <FaChevronDown className="size-2.5" />
            </button>
          }
        >
          {renderOptions(false)}
        </MobileDrawer>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Timer options"
              aria-label="Open timer options"
            >
              <FaChevronDown className="size-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            {renderOptions(true)}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
