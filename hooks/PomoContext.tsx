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
import { useFocusGoal } from "@/hooks/useFocusGoal";
import { playNotificationSound } from "@/lib/sound";
import { showSystemNotification } from "@/lib/notify";
import {
  DEFAULT_POMODORO_SETTINGS,
  EXTEND_STEP_SECONDS,
  INITIAL_STATE,
  SHORT_PAUSE_MS,
  cyclePosition,
  displaySeconds,
  isFocusTime,
  liveElapsed,
  normalizeSettings,
  phaseLabel,
  phaseTargetSeconds,
  pomoReducer,
  segmentsSeconds,
  sessionSegments,
  type FocusSegment,
  type PomoAction,
  type PomodoroPhase,
  type PomodoroSettings,
  type PomoState,
  type TimerMode,
} from "@/lib/timer-state";
import { CompletionQueue, createCompletion, type PendingCompletion } from "@/lib/timer-completion";

export {
  DEFAULT_POMODORO_SETTINGS,
  EXTEND_STEP_SECONDS,
  SHORT_PAUSE_MS,
  sessionSegments,
  phaseTargetSeconds,
  displaySeconds,
  cyclePosition,
  phaseLabel,
};
export type { TimerMode, PomodoroPhase, PomodoroSettings, FocusSegment, PomoState };

// Create Context
const PomoContext = createContext<{
  state: PomoState;
  start: () => void;
  startTask: (task: NonNullable<PomoState["task"]>) => void;
  /**
   * Start a planned timeblock: its tag, its task when it has one (otherwise
   * none), and its timer mode when set. Focus already on the clock is saved first.
   */
  startBlock: (block: { tag: string; task?: PomoState["task"]; mode?: TimerMode }) => void;
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
  task: "pomoTask",
} as const;

/** Persist control transitions before another navigation can unload the page. */
function persistTimerState(state: PomoState) {
  try {
    const values: Record<string, string> = {
      [LS.time]: String(state.elapsedSeconds),
      [LS.mode]: state.mode,
      [LS.settings]: JSON.stringify(state.pomodoroSettings),
      [LS.phase]: state.phase,
      [LS.longBreak]: state.isLongBreak ? "1" : "0",
      [LS.cycle]: String(state.completedPomodoros),
      [LS.extension]: String(state.extensionSeconds),
      [LS.running]: state.isRunning ? "1" : "0",
      [LS.segments]: JSON.stringify(state.segments),
      [LS.task]: JSON.stringify(state.task ?? null),
    };
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    if (state.startTime) localStorage.setItem(LS.startTime, String(state.startTime));
    else localStorage.removeItem(LS.startTime);
    if (state.segmentStart) localStorage.setItem(LS.segmentStart, String(state.segmentStart));
    else localStorage.removeItem(LS.segmentStart);
  } catch {
    // A blocked or full localStorage must not prevent saving to IndexedDB.
  }
}

function readTask(): PomoState["task"] {
  try {
    const task = JSON.parse(localStorage.getItem(LS.task) || "null");
    return task && typeof task.uid === "string" && typeof task.title === "string" && typeof task.tag === "string" ? task : null;
  } catch { return null; }
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
  const { tag } = useTag();
  const { name, webhook, sendWebhookUpdates } = useConfig();
  const originalTitleRef = useRef<string | null>(null);
  // Persistence waits for the restore so defaults never overwrite saved state.
  const [restored, setRestored] = useState(false);

  const [state, dispatch] = useReducer(pomoReducer, INITIAL_STATE);

  // Latest values for callbacks that outlive a render (interval ticks).
  const stateRef = useRef(state);
  stateRef.current = state;
  const envRef = useRef({ tag, name, webhook, sendWebhookUpdates });
  envRef.current = { tag, name, webhook, sendWebhookUpdates };

  /**
   * Dispatch, and move the ref to the resulting state at once. The reducer
   * is pure, so React lands on the same state; a second press before the
   * re-render then sees the first one's effect — a double-tapped Reset can
   * never save the same session twice.
   */
  const send = useCallback((action: PomoAction) => {
    stateRef.current = pomoReducer(stateRef.current, action);
    if (action.type !== "UPDATE") persistTimerState(stateRef.current);
    dispatch(action);
  }, []);

  // Guards a phase from being completed twice by overlapping ticks.
  const completingRef = useRef<number | null>(null);

  // Finished sessions waiting for a confirmed save. Created on the client.
  const queueRef = useRef<CompletionQueue | null>(null);
  const getQueue = useCallback(() => {
    if (!queueRef.current) {
      let storage: Storage | null = null;
      try { storage = window.localStorage; } catch {}
      queueRef.current = new CompletionQueue({
        storage,
        save: (rows) => useFocus.getState().addFocusSessionsOnce(rows),
        award: (points) => {
          // Re-read the stored balance first: the rewards store starts at 0
          // until its page loads, and adding to that would overwrite it.
          const rewards = useRewards.getState();
          try {
            rewards.initializePoints();
            rewards.addPoints(points);
          } catch (error) {
            toast.error(`Focus saved, but ${points} reward points could not be stored. Check browser storage.`);
            throw error;
          }
        },
        onSaved: (completion) => {
          if (completion.pomodoro) {
            usePomodoroLog.getState().record({ at: completion.createdAt,
              completed: completion.pomodoro.completed, seconds: completion.seconds });
          }
        },
      });
    }
    return queueRef.current;
  }, []);

  // Screen-reader feedback for timer events that never raise a toast
  // (start, pause, resume, break skipped, goal reached). Completed phases
  // and saved sessions already reach assistive technology through Sonner's
  // polite live region, so they are deliberately not repeated here.
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback((message: string) => {
    // Identical consecutive text is announced only once, so alternate a
    // trailing no-break space to make a repeat audible.
    setAnnouncement((prev) => (prev === message ? `${message}\u00A0` : message));
  }, []);

  // A standard-mode goal is announced once per session per goal; the key
  // changes with the session start or when the goal itself is edited.
  const goalAnnouncedRef = useRef<string | null>(null);

  /** Tell the user a session is not saved yet, with a way to try again. */
  const retryRef = useRef<() => void>(() => {});
  const reportSaveFailure = useCallback(() => {
    toast.error(getQueue().isDurable()
      ? "Could not save your focus session. It is kept on this device and will be retried."
      : "Could not save your focus session or recovery copy. Keep this tab open and retry.", {
      id: "focus-save-failed",
      action: { label: "Retry", onClick: () => retryRef.current() },
    });
  }, [getQueue]);

  /**
   * Retry every session still waiting to be saved. A failure leaves them in
   * the journal and offers another try.
   */
  const retryPending = useCallback(async () => {
    const { saved, failed } = await getQueue().flush();
    if (saved.length > 0) {
      const minutes = saved.reduce((sum, c) => sum + c.seconds, 0) / 60;
      const what = saved.length === 1 ? "a waiting focus session" : `${saved.length} waiting focus sessions`;
      toast(`Saved ${what}: ${formatTime(minutes, 0, 1)} minutes.`, {
        icon: <IoIosTimer />,
      });
    }
    if (failed.length > 0) reportSaveFailure();
  }, [getQueue, reportSaveFailure]);
  retryRef.current = () => void retryPending();

  /**
   * Save a finished focus block, then award points and report it.
   * Sessions under a minute are rejected — and not reported.
   *
   * The session is journalled synchronously, before the caller clears the
   * timer, then written to the database in one transaction. Points, the
   * success toast and the webhook wait for that write. A failed write stays
   * in the journal and is retried on request or on the next load; it can
   * never be saved or rewarded twice.
   *
   * A session paused for {@link SHORT_PAUSE_MS} or longer is saved as one
   * record per stretch, so the calendar shows when you actually focused.
   * Only time the clock was running counts — toast, points and records agree.
   *
   * @param s - Timer state at the end of the session.
   * @param endTime - When the session ended (ms).
   * @param kind - Wording for the completion toast.
   * @param completed - True only when the session ended on its own terms
   *   (a phase ran its full length); false when the user stopped it early.
   * @returns Focused seconds saved, or 0 when the session was too short.
   */
  const finishSession = useCallback(
    (
      s: PomoState,
      endTime: number,
      kind: "Focus session" | "Pomodoro session",
      completed: boolean
    ): number => {
      const env = { ...envRef.current };
      const segments = sessionSegments(s, endTime);
      const seconds = segmentsSeconds(segments);

      if (seconds < 60) {
        toast("You need to focus for at least 1 minute.", {
          icon: <IoIosTimer />,
        });
        return 0;
      }

      const completion: PendingCompletion = createCompletion({
        tag: s.task?.tag || env.tag || "Focus",
        segments,
        seconds,
        taskUid: s.task?.uid,
        projectUid: s.task?.projectUid,
        createdAt: endTime,
        ...(s.mode === "pomodoro" ? { pomodoro: { completed } } : {}),
      });

      void getQueue().submit(completion).then((outcome) => {
        if (outcome === "failed") {
          reportSaveFailure();
          return;
        }
        if (outcome !== "saved") return;

        toast(`${kind} completed: ${formatTime(seconds / 60, 0, 1)} minutes.`, {
          icon: <IoIosTimer />,
        });

        if (env.name && env.webhook && env.tag && env.sendWebhookUpdates) {
          const formattedTime = formatTimeNew(durationFromSeconds(seconds), "H:M:S", "text");
          const headline = completed
            ? `🎉 **Focus Session Completed!**`
            : `⏹️ **Focus Session Ended**`;
          const message = [
            headline,
            `👤 **User:** ${env.name}`,
            `🏷️ **Tag:** \`#${env.tag}\``,
            `⏱️ **Duration:** \`${formattedTime}\``
          ].join("\n");

          sendMessage(message, env.webhook).then((s) => console.log("Submitted", s));
        }
      });
      return seconds;
    },
    [getQueue, reportSaveFailure]
  );

  // Sessions a previous visit could not save (or did not get to) go in now.
  useEffect(() => {
    if (!restored) return;
    if (getQueue().list().length > 0) void retryPending();
  }, [restored, getQueue, retryPending]);

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

    send({
      type: "RESTORE_STATE",
      payload: {
        task: readTask(),
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
  }, [send]);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(LS.task, JSON.stringify(state.task ?? null)); } catch {}
  }, [restored, state.task]);

  // Persist timer state
  useEffect(() => {
    if (!restored) return;
    const timeoutId = setTimeout(() => {
      try { localStorage.setItem(LS.time, String(stateRef.current.elapsedSeconds)); } catch {}
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [restored, state.elapsedSeconds]);

  useEffect(() => {
    if (!restored) return;
    persistTimerState(state);
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

  // Keep a running timer visible on phones. Browsers release screen wake
  // locks when a page becomes hidden, so request a new one when it returns.
  useEffect(() => {
    if (!state.isRunning || !/Mobi|iPhone|iPod/i.test(navigator.userAgent) || !("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let requestId = 0;

    const release = () => {
      requestId++;
      if (lock) {
        void lock.release();
        lock = null;
      }
    };

    const acquire = async () => {
      if (document.hidden) return;
      const id = ++requestId;
      try {
        const requested = await navigator.wakeLock.request("screen");
        if (id !== requestId || document.hidden) {
          void requested.release();
        } else {
          lock = requested;
        }
      } catch {
        // Unsupported permissions, low battery, or browser policy can deny it.
      }
    };

    const onVisibilityChange = () => {
      release();
      if (!document.hidden) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [state.isRunning]);

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
        finishSession(s, endTime, "Pomodoro session", true);
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
      send({
        type: "ADVANCE_PHASE",
        payload: { completedFocus: wasFocus && completed, autoStartAt: completed && autoStart ? Date.now() : null },
      });
    },
    [finishSession, send]
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

      // Reaching a standard-mode goal only changes the ring — say it out
      // loud once per session per goal.
      if (s.mode === "standard" && !document.hidden) {
        const goal = useFocusGoal.getState().goalMinutes;
        if (goal !== null && newElapsedSeconds >= goal * 60) {
          const key = `${startTime}:${goal}`;
          if (goalAnnouncedRef.current !== key) {
            goalAnnouncedRef.current = key;
            announce(`Session goal reached: ${goal} minutes.`);
          }
        }
      }

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
        send({ type: "UPDATE", payload: { elapsedSeconds: newElapsedSeconds } });
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
  }, [state.isRunning, state.startTime, state.mode, state.phase, advancePhase, announce, send]);

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
    startTask: (task: NonNullable<PomoState["task"]>) => {
      const s = stateRef.current;
      if (s.task?.uid === task.uid && s.isRunning) return;
      const now = Date.now();
      if (isFocusTime(s) && liveElapsed(s, now) >= 60) {
        finishSession(s, now, s.mode === "pomodoro" ? "Pomodoro session" : "Focus session", false);
      }
      useTag.getState().setTag(task.tag);
      send({ type: "RESET" });
      send({ type: "START", payload: { startTime: now, now, task } });
      announce(`Started focusing on ${task.title}.`);
    },
    startBlock: ({ tag, task = null, mode }: { tag: string; task?: PomoState["task"]; mode?: TimerMode }) => {
      const s = stateRef.current;
      const sameMode = !mode || mode === s.mode;
      if (s.isRunning && sameMode && (s.task?.uid ?? null) === (task?.uid ?? null) && useTag.getState().tag === tag) return;
      const now = Date.now();
      if (isFocusTime(s) && liveElapsed(s, now) >= 60) {
        finishSession(s, now, s.mode === "pomodoro" ? "Pomodoro session" : "Focus session", false);
      }
      useTag.getState().setTag(tag);
      send({ type: "RESET" });
      if (!sameMode) send({ type: "SET_MODE", payload: { mode: mode!, startAt: null } });
      send({ type: "START", payload: { startTime: now, now, task } });
      announce(`Started focusing on ${task?.title ?? tag}.`);
    },
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

      send({ type: "START", payload: { startTime, now } });
      announce(s.elapsedSeconds === 0 ? "Session started." : "Timer resumed.");
    },
    pause: () => {
      const s = stateRef.current;
      if (s.isRunning) {
        const now = Date.now();
        send({ type: "PAUSE", payload: { elapsedSeconds: liveElapsed(s, now), now } });
        announce("Timer paused.");
      }
    },
    reset: () => {
      const s = stateRef.current;
      // Breaks are never saved; any focus time is.
      const endTime = Date.now();
      if (isFocusTime(s) && liveElapsed(s, endTime) > 0) {
        finishSession(
          s,
          endTime,
          s.mode === "pomodoro" ? "Pomodoro session" : "Focus session",
          false
        );
      } else if (s.phase === "break") {
        announce("Break skipped.");
      } else {
        announce("Timer reset.");
      }
      send({ type: "RESET" });
    },
    /**
     * Switch modes. Focus on the clock is finished and saved first — never
     * carried into the other mode, where a Pomodoro could cut it short — and
     * break time is dropped. A running timer keeps running, from zero.
     */
    setMode: (mode: TimerMode) => {
      const s = stateRef.current;
      if (s.mode === mode) return;
      const now = Date.now();
      if (isFocusTime(s) && liveElapsed(s, now) >= 60) {
        finishSession(
          s,
          now,
          s.mode === "pomodoro" ? "Pomodoro session" : "Focus session",
          false
        );
      }
      send({ type: "SET_MODE", payload: { mode, startAt: s.isRunning ? now : null } });
    },
    setPomodoroSettings: (settings: PomodoroSettings) => {
      send({ type: "SET_POMODORO_SETTINGS", payload: settings });
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
      let saved = 0;
      if (s.phase === "focus" && liveElapsed(s, endTime) > 0) {
        saved = finishSession(s, endTime, "Pomodoro session", false);
      }
      const prefs = usePreferences.getState();
      const autoStart = s.phase === "focus" ? prefs.autoStartBreaks : prefs.autoStartFocus;
      send({
        type: "ADVANCE_PHASE",
        payload: {
          completedFocus: s.phase === "focus" && saved >= 60,
          autoStartAt: autoStart ? Date.now() : null,
        },
      });
    },
    extend: (seconds: number = EXTEND_STEP_SECONDS) => {
      send({ type: "EXTEND", payload: { seconds } });
    },
    resetCycle: () => {
      send({ type: "RESET_CYCLE" });
    },
  }), [state, finishSession, advancePhase, announce, send]);

  return (
    <PomoContext.Provider value={contextValue}>
      {children}
      {/* Live region for the timer events Sonner's toasts never cover. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
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
