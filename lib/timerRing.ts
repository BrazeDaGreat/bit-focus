/**
 * Timer Ring
 *
 * What the progress ring around the clock means in each timer state, shared
 * by the Focus page and the Picture-in-Picture window so both read the same:
 *
 * - Pomodoro fills toward the end of the current phase, in a different colour
 *   for focus and for break.
 * - Standard fills toward your session goal. Past the goal the ring changes
 *   colour and keeps sweeping, because a goal is a target, not a stop.
 * - With no goal set, standard sweeps once per hour of the session.
 *
 * @fileoverview Ring progress, colour and labels for a timer state
 * @author BIT Focus Development Team
 * @since v0.23.0
 */

import {
  cyclePosition,
  phaseLabel,
  phaseTargetSeconds,
  type PomoState,
} from "@/hooks/PomoContext";

/** Ring colours. Focus, break, and "past your goal" are three different states. */
export const RING_FOCUS = "var(--primary)";
export const RING_BREAK = "var(--chart-2)";
export const RING_GOAL_MET = "#10b981";

// ── helpers ───────────────────────────────────────────────────────────────────

export interface RingState {
  /** Ring fill, 0–1. */
  progress: number;
  /** Stroke colour for the current state. */
  color: string;
  /** Line above the clock. */
  label: string;
  /** Line below the clock, when there is something worth saying. */
  caption?: string;
  /** Pomodoro only: where this phase sits in the long-break cycle. */
  cycle?: { current: number; total: number; onBreak: boolean };
}

/** Everything the ring needs to describe the current timer state. */
export function describeRing(
  state: PomoState,
  goalMinutes: number | null,
  hasElapsed: boolean
): RingState {
  const { mode, phase, elapsedSeconds, isRunning, extensionSeconds } = state;

  if (mode === "pomodoro") {
    const isBreak = phase === "break";
    const total = phaseTargetSeconds(state);
    const minutes = Math.round(total / 60);
    return {
      progress: total > 0 ? Math.min(1, elapsedSeconds / total) : 0,
      color: isBreak ? RING_BREAK : RING_FOCUS,
      label: phaseLabel(state),
      caption:
        extensionSeconds > 0
          ? `${minutes} min phase · +${Math.round(extensionSeconds / 60)} added`
          : `${minutes} min phase`,
      cycle: { ...cyclePosition(state), onBreak: isBreak },
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
export function humanMinutes(minutes: number): string {
  if (minutes < 120) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
