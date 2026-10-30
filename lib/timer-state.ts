/**
 * Timer State - Pure Timer Model
 *
 * The timer's state shape, its reducer and the helpers that read it. Nothing
 * here touches storage, the clock or the DOM: every timestamp arrives in an
 * action payload, so the same input always produces the same state. That is
 * what lets the provider run the reducer ahead of React (keeping a ref in step
 * for fast repeated presses) and what lets the tests drive it directly.
 *
 * @fileoverview Timer state, reducer and session-stretch maths.
 * @author BIT Focus Development Team
 * @since v0.24.0
 */

/**
 * Timer Mode Enumeration
 * Defines the available timer operation modes
 */
export type TimerMode = "standard" | "pomodoro";

/**
 * Pomodoro Phase Enumeration
 * Defines the current phase when in Pomodoro mode
 */
export type PomodoroPhase = "focus" | "break";

/**
 * Pomodoro Settings Interface
 * Configuration for Pomodoro timer durations
 */
export interface PomodoroSettings {
  /** Focus duration in minutes */
  focusDuration: number;
  /** Break duration in minutes */
  breakDuration: number;
  /** Long break duration in minutes */
  longBreakDuration: number;
  /** A long break replaces the short one after this many focus blocks */
  longBreakInterval: number;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
};

/** Seconds added by one press of "+5 min" */
export const EXTEND_STEP_SECONDS = 5 * 60;

/**
 * Pauses shorter than this stay inside one saved session. Longer pauses end
 * one session and start the next, so the calendar never shows a break as
 * focus time.
 */
export const SHORT_PAUSE_MS = 5 * 60 * 1000;

/** One uninterrupted stretch of a session, in wall-clock milliseconds */
export interface FocusSegment {
  start: number;
  end: number;
}

/**
 * Enhanced Timer State Interface
 * Manages both standard and Pomodoro timer functionality
 */
export interface PomoState {
  task?: { uid: string; projectUid?: string; title: string; tag: string } | null;
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Start timestamp for the current session */
  startTime: number | null;
  /** Total elapsed seconds from start (always counts up) */
  elapsedSeconds: number;
  /** Current timer mode */
  mode: TimerMode;
  /** Current Pomodoro phase (only relevant in Pomodoro mode) */
  phase: PomodoroPhase;
  /** Whether the current break is the long one */
  isLongBreak: boolean;
  /** Focus blocks completed in the current cycle */
  completedPomodoros: number;
  /** Seconds added to the current phase with "+5 min" */
  extensionSeconds: number;
  /** Pomodoro configuration settings */
  pomodoroSettings: PomodoroSettings;
  /** Finished stretches of the current session, each one actually running */
  segments: FocusSegment[];
  /** Wall-clock start of the stretch running now (null while paused) */
  segmentStart: number | null;
}

export const INITIAL_STATE: PomoState = {
  isRunning: false,
  startTime: null,
  elapsedSeconds: 0,
  mode: "standard",
  phase: "focus",
  isLongBreak: false,
  completedPomodoros: 0,
  extensionSeconds: 0,
  pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
  segments: [],
  segmentStart: null,
};

/**
 * The stretches a session should be saved as.
 *
 * Stretches separated by a short pause are joined into one record so the
 * calendar is not shredded by every quick interruption — but the joined
 * record is only as long as the time actually spent running. It ends where
 * the last stretch ended and starts early enough to hold the active time,
 * never the pauses in between. When some records are a minute or longer,
 * shorter ones are dropped as noise.
 *
 * @param state - Timer state at the end of the session.
 * @param endTime - When the session ends (ms).
 */
export function sessionSegments(state: PomoState, endTime: number): FocusSegment[] {
  const raw = [...state.segments];
  if (state.segmentStart !== null) raw.push({ start: state.segmentStart, end: endTime });
  // State restored from before segments existed: one stretch ending now.
  if (raw.length === 0 && state.elapsedSeconds > 0) {
    raw.push({ start: endTime - state.elapsedSeconds * 1000, end: endTime });
  }

  const groups: { end: number; active: number }[] = [];
  for (const seg of raw.sort((a, b) => a.start - b.start)) {
    if (!(seg.end > seg.start)) continue;
    const last = groups[groups.length - 1];
    if (last && seg.start - last.end < SHORT_PAUSE_MS) {
      // Overlap (clock skew, odd restores) must not count twice.
      last.active += Math.max(0, seg.end - Math.max(seg.start, last.end));
      last.end = Math.max(last.end, seg.end);
    } else {
      groups.push({ end: seg.end, active: seg.end - seg.start });
    }
  }

  const merged = groups
    .filter((g) => g.active > 0)
    .map((g) => ({ start: g.end - g.active, end: g.end }));
  const substantial = merged.filter((seg) => seg.end - seg.start >= 60_000);
  return substantial.length > 0 ? substantial : merged;
}

/** Whole focused seconds held by a list of stretches. */
export function segmentsSeconds(segments: FocusSegment[]): number {
  return Math.floor(segments.reduce((sum, seg) => sum + Math.max(0, seg.end - seg.start), 0) / 1000);
}

/** Whether the clock is measuring focus (anything but a Pomodoro break). */
export function isFocusTime(state: PomoState): boolean {
  return state.mode === "standard" || state.phase === "focus";
}

/**
 * Length of the current Pomodoro phase in seconds, including any extension.
 *
 * @param state - Timer state.
 * @returns Phase length in seconds (0 in standard mode).
 */
export function phaseTargetSeconds(state: PomoState): number {
  if (state.mode !== "pomodoro") return 0;
  const { focusDuration, breakDuration, longBreakDuration } = state.pomodoroSettings;
  const minutes =
    state.phase === "focus"
      ? focusDuration
      : state.isLongBreak
      ? longBreakDuration
      : breakDuration;
  return minutes * 60 + state.extensionSeconds;
}

/**
 * Seconds to show on a clock: remaining time in Pomodoro, elapsed otherwise.
 *
 * @param state - Timer state.
 */
export function displaySeconds(state: PomoState): number {
  if (state.mode !== "pomodoro") return state.elapsedSeconds;
  return Math.max(0, phaseTargetSeconds(state) - state.elapsedSeconds);
}

/**
 * Where the current phase sits in the long-break cycle, e.g. 2 of 4.
 *
 * During focus this is the block being worked on; during a break it is the
 * block that was just finished.
 *
 * @param state - Timer state.
 */
export function cyclePosition(state: PomoState): { current: number; total: number } {
  const total = Math.max(1, state.pomodoroSettings.longBreakInterval);
  const done = state.completedPomodoros;
  const current =
    state.phase === "focus" ? (done % total) + 1 : done % total || total;
  return { current, total };
}

/** Human label for the current Pomodoro phase. */
export function phaseLabel(state: PomoState): string {
  if (state.phase === "focus") return "Focus";
  return state.isLongBreak ? "Long break" : "Break";
}

/** Fill in fields missing from settings saved by older versions. */
export function normalizeSettings(raw: Partial<PomodoroSettings> | null | undefined): PomodoroSettings {
  const merged = { ...DEFAULT_POMODORO_SETTINGS, ...(raw ?? {}) };
  return {
    focusDuration: Math.max(1, Number(merged.focusDuration) || DEFAULT_POMODORO_SETTINGS.focusDuration),
    breakDuration: Math.max(1, Number(merged.breakDuration) || DEFAULT_POMODORO_SETTINGS.breakDuration),
    longBreakDuration: Math.max(1, Number(merged.longBreakDuration) || DEFAULT_POMODORO_SETTINGS.longBreakDuration),
    longBreakInterval: Math.max(1, Number(merged.longBreakInterval) || DEFAULT_POMODORO_SETTINGS.longBreakInterval),
  };
}

/**
 * Focused seconds right now. While running this is computed from the clock,
 * since the per-second tick is a transition and may not have landed yet.
 */
export function liveElapsed(s: PomoState, now: number): number {
  return s.isRunning && s.startTime
    ? Math.max(0, Math.floor((now - s.startTime) / 1000))
    : s.elapsedSeconds;
}

/**
 * Timer Action Types
 * Defines all possible state mutations for the timer
 */
export type PomoAction =
  | { type: "START"; payload: { startTime: number; now: number; task?: PomoState["task"] } }
  | { type: "PAUSE"; payload: { elapsedSeconds: number; now: number } }
  | { type: "RESET" }
  | { type: "UPDATE"; payload: { elapsedSeconds: number } }
  | { type: "SET_MODE"; payload: { mode: TimerMode; startAt: number | null } }
  | { type: "SET_POMODORO_SETTINGS"; payload: PomodoroSettings }
  | { type: "ADVANCE_PHASE"; payload: { completedFocus: boolean; autoStartAt: number | null } }
  | { type: "EXTEND"; payload: { seconds: number } }
  | { type: "RESET_CYCLE" }
  | { type: "RESTORE_STATE"; payload: PomoState };

/**
 * Timer State Reducer
 * Handles all state transitions for both standard and Pomodoro modes.
 * Pure: no saving, sounds or network calls happen here.
 *
 * @param state - Current timer state
 * @param action - Action to perform on the state
 * @returns Updated state
 */
export function pomoReducer(state: PomoState, action: PomoAction): PomoState {
  switch (action.type) {
    case "START":
      // Every run is its own stretch; sessionSegments joins short pauses
      // without counting them.
      return {
        ...state,
        isRunning: true,
        startTime: action.payload.startTime,
        task: action.payload.task === undefined ? state.task : action.payload.task,
        segmentStart: action.payload.now,
      };

    case "PAUSE":
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: action.payload.elapsedSeconds,
        // Keep startTime for resume calculations
        segments:
          state.segmentStart !== null
            ? [...state.segments, { start: state.segmentStart, end: action.payload.now }]
            : state.segments,
        segmentStart: null,
      };

    case "RESET": {
      // Resetting a break skips it. Skipping the long break closes the cycle.
      const closesCycle = state.phase === "break" && state.isLongBreak;
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: 0,
        task: null,
        startTime: null,
        phase: "focus",
        isLongBreak: false,
        extensionSeconds: 0,
        completedPomodoros: closesCycle ? 0 : state.completedPomodoros,
        segments: [],
        segmentStart: null,
      };
    }

    case "UPDATE":
      return { ...state, elapsedSeconds: action.payload.elapsedSeconds };

    case "SET_MODE": {
      // The provider has already saved any focus on the clock. The new mode
      // starts from zero, still running when the old one was.
      if (action.payload.mode === state.mode) return state;
      const { startAt } = action.payload;
      return {
        ...state,
        mode: action.payload.mode,
        elapsedSeconds: 0,
        isRunning: startAt !== null,
        startTime: startAt,
        phase: "focus",
        isLongBreak: false,
        extensionSeconds: 0,
        completedPomodoros: 0,
        segments: [],
        segmentStart: startAt,
      };
    }

    case "SET_POMODORO_SETTINGS":
      return { ...state, pomodoroSettings: normalizeSettings(action.payload) };

    case "ADVANCE_PHASE": {
      if (state.mode !== "pomodoro") return state;
      const { completedFocus, autoStartAt } = action.payload;
      const running = autoStartAt !== null;

      if (state.phase === "focus") {
        const completed = state.completedPomodoros + (completedFocus ? 1 : 0);
        const interval = Math.max(1, state.pomodoroSettings.longBreakInterval);
        return {
          ...state,
          phase: "break",
          isLongBreak: completed > 0 && completed % interval === 0,
          completedPomodoros: completed,
          elapsedSeconds: 0,
          extensionSeconds: 0,
          isRunning: running,
          startTime: autoStartAt,
          segments: [],
          segmentStart: autoStartAt,
        };
      }

      return {
        ...state,
        phase: "focus",
        isLongBreak: false,
        completedPomodoros: state.isLongBreak ? 0 : state.completedPomodoros,
        elapsedSeconds: 0,
        extensionSeconds: 0,
        isRunning: running,
        startTime: autoStartAt,
        segments: [],
        segmentStart: autoStartAt,
      };
    }

    case "EXTEND":
      if (state.mode !== "pomodoro") return state;
      return { ...state, extensionSeconds: state.extensionSeconds + action.payload.seconds };

    case "RESET_CYCLE":
      return { ...state, completedPomodoros: 0 };

    case "RESTORE_STATE":
      return { ...action.payload };

    default:
      return state;
  }
}
