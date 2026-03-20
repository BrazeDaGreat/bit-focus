"use client";

import { usePomo } from "@/hooks/PomoContext";
import { useTag } from "@/hooks/useTag";
import { cn, formatTime } from "@/lib/utils";
import { useRouter } from "next/navigation";

/**
 * Slim Sidebar Timer Block
 *
 * Only renders when the timer is running or paused.
 * Clicking navigates to /focus. Shows a pulsing dot,
 * monospace time, mode label, and active tag chip.
 */
export default function PomoFooterTimer() {
  const { state } = usePomo();
  const { tag, savedTags } = useTag();
  const router = useRouter();

  const { isRunning, elapsedSeconds, mode, phase, pomodoroSettings } = state;
  const isPaused = !isRunning && elapsedSeconds > 0;

  if (!isRunning && !isPaused) return null;

  // Calculate the display time
  const displaySeconds =
    mode === "pomodoro" && phase === "focus"
      ? Math.max(0, pomodoroSettings.focusDuration * 60 - elapsedSeconds)
      : mode === "pomodoro" && phase === "break"
      ? Math.max(0, pomodoroSettings.breakDuration * 60 - elapsedSeconds)
      : elapsedSeconds;

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;

  const modeLabel =
    mode === "pomodoro" ? (phase === "focus" ? "Focus" : "Break") : "Standard";

  const tagColor = savedTags.find((t) => t.t === tag)?.c;

  return (
    <div
      className="border-t px-3 py-3 cursor-pointer hover:bg-accent/40 transition-colors"
      onClick={() => router.push("/focus")}
      title="Go to Focus page"
    >
      {/* Time row */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            isRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
          )}
        />
        <span className="font-mono text-lg font-semibold tracking-tight">
          {formatTime(minutes, seconds)}
        </span>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2 pl-4">
        <span className="text-xs text-muted-foreground">
          {isRunning ? "Running" : "Paused"} — {modeLabel}
        </span>
        {tag && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={
              tagColor
                ? { backgroundColor: tagColor + "33", color: tagColor }
                : { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }
            }
          >
            {tag}
          </span>
        )}
      </div>
    </div>
  );
}
