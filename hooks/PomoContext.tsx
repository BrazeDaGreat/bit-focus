/**
 * PomoContext.tsx - Enhanced Pomodoro Timer Context with Multiple Modes
 *
 * This file provides a React context for managing both standard and Pomodoro-style focus timers.
 * It handles timer state (running/paused), elapsed time tracking, countdown functionality, and
 * automatic session saving when focus sessions are completed. The timer state persists
 * across page refreshes using localStorage.
 *
 * Features:
 * - Standard timer mode (counts up from 0)
 * - Pomodoro mode (counts down from set duration)
 * - Configurable focus, break and long break durations
 * - Long break every N focus blocks, with a cycle counter
 * - Optional auto-start of breaks and focus blocks
 * - "+5 min" extension of the current phase
 * - Optional resume of a running timer after a reload
 * - Optional system notifications when a phase ends
 * - Sessions split at long pauses, so the calendar shows real focus blocks
 * - Session saving compatible with existing system
 * - Persistent settings across browser sessions
 *
 * The reducer is pure. Saving sessions, awarding points, webhooks, sounds and
 * notifications all happen in the provider's action functions, so a reducer
 * that runs twice (React StrictMode) can never save a session twice.
 *
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 * @updated v0.23.0-beta
 */

"use client";
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
  startTransition,
} from "react";
import { IoIosTimer } from "react-icons/io";
import { toast } from "sonner";
import { useFocus } from "@/hooks/useFocus";
import { durationFromSeconds, formatTime, formatTimeNew } from "@/lib/utils";
import { useTag } from "@/hooks/useTag";
import { sendMessage } from "@/lib/webhook";
import { useConfig } from "./useConfig";
import { useRewards } from "@/hooks/useRewards";
import { usePreferences } from "@/hooks/usePreferences";
import { usePomodoroLog } from "@/hooks/usePomodoroLog";
import { playNotificationSound } from "@/lib/sound";
import { showSystemNotification } from "@/lib/notify";

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
  /** Finished stretches of the current session, split at long pauses */
  segments: FocusSegment[];
  /** Wall-clock start of the stretch running now (null while paused) */
  segmentStart: number | null;
}

/**
 * The stretches a session should be saved as.
 *
 * Adjacent stretches separated by a short pause are joined into one. When
 * some stretches are a minute or longer, shorter ones are dropped as noise.
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

  const merged: FocusSegment[] = [];
  for (const seg of raw.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && seg.start - last.end < SHORT_PAUSE_MS) {
      last.end = Math.max(last.end, seg.end);
    } else if (seg.end > seg.start) {
      merged.push({ ...seg });
    }
  }

  const substantial = merged.filter((seg) => seg.end - seg.start >= 60_000);
  return substantial.length > 0 ? substantial : merged;
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
function normalizeSettings(raw: Partial<PomodoroSettings> | null | undefined): PomodoroSettings {
  const merged = { ...DEFAULT_POMODORO_SETTINGS, ...(raw ?? {}) };
  return {
    focusDuration: Math.max(1, Number(merged.focusDuration) || DEFAULT_POMODORO_SETTINGS.focusDuration),
    breakDuration: Math.max(1, Number(merged.breakDuration) || DEFAULT_POMODORO_SETTINGS.breakDuration),
    longBreakDuration: Math.max(1, Number(merged.longBreakDuration) || DEFAULT_POMODORO_SETTINGS.longBreakDuration),
    longBreakInterval: Math.max(1, Number(merged.longBreakInterval) || DEFAULT_POMODORO_SETTINGS.longBreakInterval),
  };
}

/**
 * Timer Action Types
 * Defines all possible state mutations for the timer
 */
type Action =
  | { type: "START"; payload: { startTime: number; now: number } }
  | { type: "PAUSE"; payload: { elapsedSeconds: number; now: number } }
  | { type: "RESET" }
  | { type: "UPDATE"; payload: { elapsedSeconds: number } }
  | { type: "SET_MODE"; payload: { mode: TimerMode } }
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
function pomoReducer(state: PomoState, action: Action): PomoState {
  switch (action.type) {
    case "START": {
      // Resuming after a short pause continues the previous stretch.
      const { now } = action.payload;
      const last = state.segments[state.segments.length - 1];
      const continues = !!last && now - last.end < SHORT_PAUSE_MS;
      return {
        ...state,
        isRunning: true,
        startTime: action.payload.startTime,
        segments: continues ? state.segments.slice(0, -1) : state.segments,
        segmentStart: continues ? last.start : now,
      };
    }

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
      if (action.payload.mode === state.mode) return state;
      // When switching modes, preserve elapsed time if timer is running
      const shouldPreserveTime = state.isRunning && state.elapsedSeconds > 0;
      return {
        ...state,
        mode: action.payload.mode,
        elapsedSeconds: shouldPreserveTime ? state.elapsedSeconds : 0,
        isRunning: shouldPreserveTime ? state.isRunning : false,
        startTime: shouldPreserveTime ? state.startTime : null,
        phase: "focus",
        isLongBreak: false,
        extensionSeconds: 0,
        completedPomodoros: 0,
        segments: shouldPreserveTime ? state.segments : [],
        segmentStart: shouldPreserveTime ? state.segmentStart : null,
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

// Create Context
const PomoContext = createContext<{
  state: PomoState;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setMode: (mode: TimerMode) => void;
  setPomodoroSettings: (settings: PomodoroSettings) => void;
  nextPhase: () => void;
  completePomodoro: () => void;
  extend: (seconds?: number) => void;
  resetCycle: () => void;
} | null>(null);

/** localStorage keys for timer persistence (all device-local, never synced) */
const LS = {
  time: "pomoTime",
  mode: "timerMode",
  settings: "pomodoroSettings",
  phase: "pomoPhase",
  startTime: "pomoStartTime",
  running: "pomoRunning",
  longBreak: "pomoLongBreak",
  cycle: "pomoCycle",
  extension: "pomoExtension",
  segments: "pomoSegments",
  segmentStart: "pomoSegmentStart",
} as const;

const INITIAL_STATE: PomoState = {
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
 * Focused seconds right now. While running this is computed from the clock,
 * since the per-second tick is a transition and may not have landed yet.
 */
function liveElapsed(s: PomoState, now: number): number {
  return s.isRunning && s.startTime
    ? Math.max(0, Math.floor((now - s.startTime) / 1000))
    : s.elapsedSeconds;
}

/** Read saved segments, ignoring anything malformed. */
function readSegments(): FocusSegment[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS.segments) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (seg): seg is FocusSegment =>
        typeof seg?.start === "number" && typeof seg?.end === "number" && seg.end >= seg.start
    );
  } catch {
    return [];
  }
}

/**
 * Enhanced Pomodoro Timer Provider Component
 * Manages timer state, persistence, and automatic updates for both timer modes.
 *
 * @param children - Child components that need access to timer context
 * @returns Provider component with timer state and controls
 */
export function PomoProvider({ children }: { children: React.ReactNode }) {
  const { addFocusSession } = useFocus();
  const { tag } = useTag();
  const { name, webhook, sendWebhookUpdates } = useConfig();
  const { addPoints } = useRewards();
  const originalTitleRef = useRef<string | null>(null);
  // Persistence waits for the restore so defaults never overwrite saved state.
  const [restored, setRestored] = useState(false);

  const [state, dispatch] = useReducer(pomoReducer, INITIAL_STATE);

  // Latest values for callbacks that outlive a render (interval ticks).
  const stateRef = useRef(state);
  stateRef.current = state;
  const envRef = useRef({ addFocusSession, addPoints, tag, name, webhook, sendWebhookUpdates });
  envRef.current = { addFocusSession, addPoints, tag, name, webhook, sendWebhookUpdates };

  // Guards a phase from being completed twice by overlapping ticks.
  const completingRef = useRef<number | null>(null);

  /**
   * Save a finished focus block, award points, and report it to the webhook.
   * Sessions under a minute are rejected — and not reported.
   *
   * A session paused for {@link SHORT_PAUSE_MS} or longer is saved as one
   * record per stretch, so the calendar shows when you actually focused.
   * Everything the user sees — toast, points, webhook — still describes the
   * session as a whole.
   *
   * @param s - Timer state at the end of the session.
   * @param endTime - When the session ended (ms).
   * @param elapsedSeconds - Focused seconds, used for points and the toast.
   * @param kind - Wording for the completion toast.
   */
  const finishSession = useCallback(
    (s: PomoState, endTime: number, elapsedSeconds: number, kind: "Focus session" | "Pomodoro session") => {
      const env = envRef.current;

      if (elapsedSeconds < 60) {
        toast("You need to focus for at least 1 minute.", {
          icon: <IoIosTimer />,
        });
        return;
      }

      const sessionTag = env.tag || "Focus";
      env.addPoints(Math.floor(elapsedSeconds / 60));
      for (const seg of sessionSegments(s, endTime)) {
        void env.addFocusSession(sessionTag, new Date(seg.start), new Date(seg.end));
      }

      toast(`${kind} completed: ${formatTime(elapsedSeconds / 60, 0, 1)} minutes.`, {
        icon: <IoIosTimer />,
      });

      if (env.name && env.webhook && env.tag && env.sendWebhookUpdates) {
        const formattedTime = formatTimeNew(durationFromSeconds(elapsedSeconds), "H:M:S", "text");
        const message = [
          `🎉 **Focus Session Completed!**`,
          `👤 **User:** ${env.name}`,
          `🏷️ **Tag:** \`#${env.tag}\``,
          `⏱️ **Duration:** \`${formattedTime}\``
        ].join("\n");

        sendMessage(message, env.webhook).then((s) => console.log("Submitted", s));
      }
    },
    []
  );

  /**
   * Initialize state from localStorage on component mount
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let pomodoroSettings = DEFAULT_POMODORO_SETTINGS;
    const savedSettings = localStorage.getItem(LS.settings);
    if (savedSettings) {
      try {
        pomodoroSettings = normalizeSettings(JSON.parse(savedSettings));
      } catch {
        console.warn("Failed to parse pomodoro settings from localStorage");
      }
    }

    const mode: TimerMode = localStorage.getItem(LS.mode) === "pomodoro" ? "pomodoro" : "standard";
    const phase: PomodoroPhase = localStorage.getItem(LS.phase) === "break" ? "break" : "focus";
    const savedStart = Number(localStorage.getItem(LS.startTime));
    const wasRunning = localStorage.getItem(LS.running) === "1";
    let elapsedSeconds = parseInt(localStorage.getItem(LS.time) ?? "0", 10) || 0;

    // A running timer keeps running only when the user asked for it.
    const resume =
      usePreferences.getState().resumeTimerOnReload && wasRunning && savedStart > 0;
    if (resume) {
      elapsedSeconds = Math.max(0, Math.floor((Date.now() - savedStart) / 1000));
    }

    // The stretch that was running when the page closed. Resuming keeps it
    // open; otherwise it ends at the last saved tick (start + elapsed).
    const segments = readSegments();
    const savedSegmentStart = Number(localStorage.getItem(LS.segmentStart)) || null;
    let segmentStart: number | null = null;
    if (resume) {
      segmentStart = savedSegmentStart ?? savedStart;
    } else if (wasRunning && savedSegmentStart) {
      if (savedStart > 0) {
        segments.push({
          start: savedSegmentStart,
          end: Math.max(savedSegmentStart, savedStart + elapsedSeconds * 1000),
        });
      }
    }
    // A paused session saved before stretches were tracked: treat the time
    // already on the clock as one stretch ending now.
    if (!resume && elapsedSeconds > 0 && segments.length === 0 && segmentStart === null) {
      const now = Date.now();
      segments.push({ start: now - elapsedSeconds * 1000, end: now });
    }

    dispatch({
      type: "RESTORE_STATE",
      payload: {
        elapsedSeconds,
        mode,
        pomodoroSettings,
        phase: mode === "pomodoro" ? phase : "focus",
        isLongBreak: mode === "pomodoro" && phase === "break" && localStorage.getItem(LS.longBreak) === "1",
        completedPomodoros: Math.max(0, parseInt(localStorage.getItem(LS.cycle) ?? "0", 10) || 0),
        extensionSeconds: Math.max(0, parseInt(localStorage.getItem(LS.extension) ?? "0", 10) || 0),
        isRunning: resume,
        startTime: resume ? savedStart : null,
        segments,
        segmentStart,
      },
    });
    setRestored(true);
  }, []);

  // Persist timer state
  useEffect(() => {
    if (!restored) return;
    const timeoutId = setTimeout(() => {
      localStorage.setItem(LS.time, String(state.elapsedSeconds));
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [restored, state.elapsedSeconds]);

  useEffect(() => {
    if (!restored) return;
    localStorage.setItem(LS.mode, state.mode);
    localStorage.setItem(LS.settings, JSON.stringify(state.pomodoroSettings));
    localStorage.setItem(LS.phase, state.phase);
    localStorage.setItem(LS.longBreak, state.isLongBreak ? "1" : "0");
    localStorage.setItem(LS.cycle, String(state.completedPomodoros));
    localStorage.setItem(LS.extension, String(state.extensionSeconds));
    localStorage.setItem(LS.running, state.isRunning ? "1" : "0");
    if (state.startTime) localStorage.setItem(LS.startTime, String(state.startTime));
    else localStorage.removeItem(LS.startTime);
    localStorage.setItem(LS.segments, JSON.stringify(state.segments));
    if (state.segmentStart) localStorage.setItem(LS.segmentStart, String(state.segmentStart));
    else localStorage.removeItem(LS.segmentStart);
  }, [
    restored,
    state.mode,
    state.pomodoroSettings,
    state.phase,
    state.isLongBreak,
    state.completedPomodoros,
    state.extensionSeconds,
    state.isRunning,
    state.startTime,
    state.segments,
    state.segmentStart,
  ]);

  /**
   * End the current Pomodoro phase: save a completed focus block, tell the
   * user, and move to the next phase (starting it if they asked for that).
   *
   * @param completed - True when the phase ran its full length.
   */
  const advancePhase = useCallback(
    (completed: boolean) => {
      const s = stateRef.current;
      if (s.mode !== "pomodoro") return;
      const prefs = usePreferences.getState();
      const wasFocus = s.phase === "focus";

      if (wasFocus && completed && s.startTime) {
        const target = phaseTargetSeconds(s);
        // End at the moment the phase ran out, not "now" — a tab that slept
        // through the end must not stretch the session.
        const endTime = s.startTime + target * 1000;
        finishSession(s, endTime, target, "Pomodoro session");
        usePomodoroLog.getState().record({ at: endTime, completed: true, seconds: target });
      }

      if (completed) {
        const nextIsLong =
          wasFocus &&
          (s.completedPomodoros + 1) % Math.max(1, s.pomodoroSettings.longBreakInterval) === 0;
        const title = wasFocus
          ? nextIsLong
            ? "Focus complete — long break earned"
            : "Focus complete"
          : "Break over";
        const body = wasFocus
          ? nextIsLong
            ? `Take ${s.pomodoroSettings.longBreakDuration} minutes. You've finished the cycle.`
            : "Time for a break."
          : "Ready to focus again?";

        playNotificationSound();
        toast(`${title}. ${body}`, { icon: <IoIosTimer /> });
        if (prefs.phaseNotifications && typeof document !== "undefined" && document.hidden) {
          showSystemNotification(title, body);
        }
      }

      const autoStart = wasFocus ? prefs.autoStartBreaks : prefs.autoStartFocus;
      dispatch({
        type: "ADVANCE_PHASE",
        payload: { completedFocus: wasFocus && completed, autoStartAt: completed && autoStart ? Date.now() : null },
      });
    },
    [finishSession]
  );

  /**
   * Timer update logic - elapsedSeconds always counts up from 0
   */
  useEffect(() => {
    if (!state.isRunning || !state.startTime) return;
    const startTime = state.startTime;

    const tick = () => {
      const s = stateRef.current;
      const newElapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Check for Pomodoro phase completion
      if (s.mode === "pomodoro") {
        const target = phaseTargetSeconds(s);
        if (newElapsedSeconds >= target) {
          if (completingRef.current === startTime) return;
          completingRef.current = startTime;
          advancePhase(true);
          return;
        }
      }

      // A transition, not an urgent update: Next.js navigations are
      // transitions too, and an urgent update at the root every second kept
      // interrupting and restarting them, so links seemed to do nothing while
      // the timer ran. As a transition the tick batches with the navigation.
      startTransition(() => {
        dispatch({ type: "UPDATE", payload: { elapsedSeconds: newElapsedSeconds } });
      });

      // Update document title with current timer value
      if (typeof document !== "undefined") {
        if (originalTitleRef.current === null) {
          originalTitleRef.current = document.title;
        }
        // Use H:M:S once the duration reaches an hour, otherwise M:S — without
        // the hour component the minutes wrap (100 minutes would read "40:00").
        const shown = s.mode === "pomodoro"
          ? Math.max(0, phaseTargetSeconds(s) - newElapsedSeconds)
          : newElapsedSeconds;
        const displayTime = formatTimeNew(durationFromSeconds(shown), shown >= 3600 ? "H:M:S" : "M:S", "digital");
        document.title = s.mode === "pomodoro"
          ? `${displayTime} | ${phaseLabel(s)} - BIT Focus`
          : `${displayTime} - BIT Focus`;
      }
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    // Background tabs throttle intervals; catch up the moment we're visible.
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.isRunning, state.startTime, state.mode, state.phase, advancePhase]);

  /**
   * Restore document title when timer stops or component unmounts
   */
  useEffect(() => {
    if (!state.isRunning && originalTitleRef.current && typeof document !== "undefined") {
      document.title = originalTitleRef.current;
      originalTitleRef.current = null;
    }
    return () => {
      if (originalTitleRef.current && typeof document !== "undefined") {
        document.title = originalTitleRef.current;
      }
    };
  }, [state.isRunning]);

  // Context value with all timer controls. Memoised on the timer state: the
  // controls only read refs, so consumers should re-render when the timer
  // changes, not whenever an unrelated store this provider reads updates.
  const contextValue = useMemo(() => ({
    state,
    start: () => {
      const s = stateRef.current;
      if (s.isRunning) return;
      const env = envRef.current;

      // Resume accounts for time already elapsed; a fresh start begins now.
      const now = Date.now();
      const startTime = now - s.elapsedSeconds * 1000;

      // Send webhook notification for fresh starts only
      if (s.elapsedSeconds === 0 && env.name && env.webhook && env.tag && env.sendWebhookUpdates) {
        const minutes = Math.round(phaseTargetSeconds(s) / 60);
        const modeText = s.mode === "pomodoro"
          ? `${phaseLabel(s).toLowerCase()} (${minutes}min)`
          : "standard";

        const message = [
          `🚀 **Focus Session Started!**`,
          `👤 **User:** ${env.name}`,
          `🏷️ **Tag:** \`#${env.tag}\``,
          `⚙️ **Mode:** \`${modeText}\``
        ].join("\n");

        sendMessage(message, env.webhook).then((s) => console.log("Submitted", s));
      }

      dispatch({ type: "START", payload: { startTime, now } });
    },
    pause: () => {
      const s = stateRef.current;
      if (s.isRunning) {
        const now = Date.now();
        dispatch({ type: "PAUSE", payload: { elapsedSeconds: liveElapsed(s, now), now } });
      }
    },
    reset: () => {
      const s = stateRef.current;
      // Breaks are never saved; any focus time is.
      const isFocus = s.mode === "standard" || s.phase === "focus";
      const endTime = Date.now();
      const elapsed = liveElapsed(s, endTime);
      if (isFocus && elapsed > 0) {
        finishSession(
          s,
          endTime,
          elapsed,
          s.mode === "pomodoro" ? "Pomodoro session" : "Focus session"
        );
        if (s.mode === "pomodoro" && elapsed >= 60) {
          usePomodoroLog.getState().record({ at: endTime, completed: false, seconds: elapsed });
        }
      }
      dispatch({ type: "RESET" });
    },
    setMode: (mode: TimerMode) => {
      dispatch({ type: "SET_MODE", payload: { mode } });
    },
    setPomodoroSettings: (settings: PomodoroSettings) => {
      dispatch({ type: "SET_POMODORO_SETTINGS", payload: settings });
    },
    /** Skip to the next phase without saving or counting the current one. */
    nextPhase: () => {
      advancePhase(false);
    },
    /** Finish the current phase now, as if it had run its full length. */
    completePomodoro: () => {
      const s = stateRef.current;
      if (s.mode !== "pomodoro") return;
      const endTime = Date.now();
      const elapsed = liveElapsed(s, endTime);
      if (s.phase === "focus" && elapsed > 0) {
        finishSession(s, endTime, elapsed, "Pomodoro session");
        if (elapsed >= 60) {
          usePomodoroLog.getState().record({ at: endTime, completed: false, seconds: elapsed });
        }
      }
      const prefs = usePreferences.getState();
      const autoStart = s.phase === "focus" ? prefs.autoStartBreaks : prefs.autoStartFocus;
      dispatch({
        type: "ADVANCE_PHASE",
        payload: {
          completedFocus: s.phase === "focus" && elapsed >= 60,
          autoStartAt: autoStart ? Date.now() : null,
        },
      });
    },
    extend: (seconds: number = EXTEND_STEP_SECONDS) => {
      dispatch({ type: "EXTEND", payload: { seconds } });
    },
    resetCycle: () => {
      dispatch({ type: "RESET_CYCLE" });
    },
  }), [state, finishSession, advancePhase]);

  return (
    <PomoContext.Provider value={contextValue}>
      {children}
    </PomoContext.Provider>
  );
}

/**
 * Custom Hook to Use Enhanced Pomodoro Timer Context
 * Provides access to timer state and control functions for both modes.
 *
 * @returns Timer state and control functions
 * @throws Error if used outside of PomoProvider
 */
export function usePomo() {
  const context = useContext(PomoContext);
  if (!context) {
    throw new Error("usePomo must be used within a PomoProvider");
  }
  return context;
}
