/**
 * Picture-in-Picture Timer
 *
 * The Focus page timer, shrunk to a floating window: the same progress ring
 * and phase colours on the left, the clock and the dock's controls on the
 * right. It renders through a portal from {@link PipHost}, so it reads the
 * live timer context directly and uses the app's own theme tokens — the
 * window changes theme with the app.
 *
 * @fileoverview Floating timer rendered inside the Document PiP window
 * @author BIT Focus Development Team
 * @since v0.9.0-alpha
 * @updated v0.23.0
 */

"use client";

import type { JSX, ReactNode } from "react";
import { displaySeconds, usePomo } from "@/hooks/PomoContext";
import { useTag } from "@/hooks/useTag";
import { useFocusGoal } from "@/hooks/useFocusGoal";
import { describeRing, type RingState } from "@/lib/timerRing";
import { cn, formatClock } from "@/lib/utils";
import { FaPause, FaPlay } from "react-icons/fa";
import { FaForwardFast, FaPlus, FaArrowUpRightFromSquare } from "react-icons/fa6";

export default function PipTimer(): JSX.Element {
  const { state, start, pause, reset, extend } = usePomo();
  const { tag, savedTags } = useTag();
  const { goalMinutes } = useFocusGoal();

  const hasElapsed = state.startTime !== null || state.elapsedSeconds > 0;
  const ring = describeRing(state, goalMinutes, hasElapsed);
  const isPomodoro = state.mode === "pomodoro";
  const isBreak = isPomodoro && state.phase === "break";
  const tagColor = savedTags.find((t) => t.t === tag)?.c;
  const startLabel = state.isRunning ? "Pause" : hasElapsed ? "Resume" : "Start";

  return (
    <main className="flex h-screen w-screen select-none items-center gap-4 overflow-hidden bg-background px-4 py-3 text-foreground">
      <MiniRing ring={ring} isRunning={state.isRunning} hasGoal={!!goalMinutes} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phase and tag */}
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] transition-colors duration-700"
            style={{ color: ring.color }}
          >
            {state.isRunning && (
              <span
                className="size-1.5 rounded-full motion-safe:animate-pulse"
                style={{ backgroundColor: ring.color }}
              />
            )}
            {ring.label}
            {ring.cycle && (
              <span className="font-mono tracking-normal text-muted-foreground">
                {ring.cycle.current}/{ring.cycle.total}
              </span>
            )}
          </span>
          {tag && (
            <span className="ml-auto flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: tagColor ?? "var(--muted-foreground)" }}
              />
              <span className="truncate">{tag}</span>
            </span>
          )}
        </div>

        {/* Clock */}
        <span className="mt-1 font-mono text-[2.5rem] font-semibold leading-none tracking-tighter tabular-nums">
          {formatClock(displaySeconds(state))}
        </span>

        {/* Controls, in the Focus dock's button style */}
        <div className="mt-3 flex items-center gap-1">
          <PipButton
            primary
            onClick={state.isRunning ? pause : start}
            label={startLabel}
            className="px-3"
          >
            {state.isRunning ? <FaPause className="size-3" /> : <FaPlay className="size-3" />}
            <span className="text-xs">{startLabel}</span>
          </PipButton>

          {(hasElapsed || isBreak) && (
            <PipButton
              onClick={reset}
              label={isBreak ? "Skip the break" : "Reset and save the session"}
            >
              <FaForwardFast className="size-3" />
            </PipButton>
          )}

          {isPomodoro && hasElapsed && (
            <PipButton onClick={() => extend()} label="Add 5 minutes">
              <FaPlus className="size-2.5" />
              <span className="font-mono text-[11px]">5</span>
            </PipButton>
          )}

          <PipButton
            onClick={() => window.focus()}
            label="Back to BIT Focus"
            className="ml-auto"
          >
            <FaArrowUpRightFromSquare className="size-2.5" />
          </PipButton>
        </div>
      </div>
    </main>
  );
}

/** The Focus page ring at window scale, with the phase colour glowing behind. */
function MiniRing({
  ring,
  isRunning,
  hasGoal,
}: {
  ring: RingState;
  isRunning: boolean;
  hasGoal: boolean;
}): JSX.Element {
  const size = 100;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, ring.progress)));
  const cycle = ring.cycle;
  // On a break the pips show the block just finished; in focus, the one underway.
  const finished = cycle ? (cycle.onBreak ? cycle.current : cycle.current - 1) : 0;

  return (
    <div className="relative aspect-square h-full max-h-[120px] shrink-0 max-[240px]:hidden">
      <div
        className="absolute inset-3 rounded-full opacity-[0.12] blur-xl transition-colors duration-700"
        style={{ backgroundColor: ring.color }}
        aria-hidden="true"
      />
      <svg viewBox={`0 0 ${size} ${size}`} className="relative size-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
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

      {/* Centre: cycle pips for Pomodoro, goal progress for standard */}
      <div className="absolute inset-0 flex items-center justify-center">
        {cycle ? (
          <div className="flex max-w-[60%] flex-wrap justify-center gap-1">
            {Array.from({ length: cycle.total }, (_, i) => {
              const done = i < finished;
              const active = !cycle.onBreak && i === cycle.current - 1;
              return (
                <span
                  key={i}
                  className={cn("size-1.5 rounded-full", active && isRunning && "motion-safe:animate-pulse")}
                  style={{
                    backgroundColor: done ? ring.color : "transparent",
                    boxShadow: done
                      ? undefined
                      : `inset 0 0 0 1px ${active ? ring.color : "var(--muted-foreground)"}`,
                    opacity: done || active ? 1 : 0.4,
                  }}
                />
              );
            })}
          </div>
        ) : hasGoal ? (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {Math.round(ring.progress * 100)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PipButton({
  primary = false,
  onClick,
  label,
  className,
  children,
}: {
  primary?: boolean;
  onClick: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}
