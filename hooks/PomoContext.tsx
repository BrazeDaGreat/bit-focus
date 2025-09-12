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
 * - Configurable focus and break durations
 * - Auto-transitions between focus and break phases
 * - Session saving compatible with existing system
 * - Persistent settings across browser sessions
 * 
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 * @updated v0.12.0-beta
 */

"use client";
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { IoIosTimer } from "react-icons/io";
import { toast } from "sonner";
import { useFocus } from "@/hooks/useFocus";
import { durationFromSeconds, formatTime, formatTimeNew } from "@/lib/utils";
import { useTag } from "@/hooks/useTag";
import { sendMessage } from "@/lib/webhook";
import { useConfig } from "./useConfig";
import { useRewards } from "@/hooks/useRewards";

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
}

/**
 * Enhanced Timer State Interface
 * Manages both standard and Pomodoro timer functionality
 */
interface PomoState {
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Start timestamp for the current session */
  startTime: number | null;
  /** Elapsed seconds (for standard mode) or remaining seconds (for Pomodoro mode) */
  elapsedSeconds: number;
  /** Current timer mode */
  mode: TimerMode;
  /** Current Pomodoro phase (only relevant in Pomodoro mode) */
  phase: PomodoroPhase;
  /** Pomodoro configuration settings */
  pomodoroSettings: PomodoroSettings;
  /** Function to add focus sessions to database */
  addFocusSession: (tag: string, startTime: Date, endTime: Date) => Promise<void>;
  /** Configuration data for webhooks and notifications */
  data: {
    name: string;
    tag: string;
    webhook: string;
  };
  /** Function to add reward points */
  addPoints: (points: number) => void;
}

/**
 * Timer Action Types
 * Defines all possible state mutations for the timer
 */
type Action =
  | { type: "START"; payload: { startTime: number } }
  | { type: "PAUSE"; payload: { elapsedSeconds: number } }
  | { type: "RESET"; payload?: { elapsedSeconds?: number; tag?: string } }
  | { type: "UPDATE"; payload: { elapsedSeconds: number } }
  | { type: "SET_DATA"; payload: { name: string; tag: string; webhook: string } }
  | { type: "SET_MODE"; payload: { mode: TimerMode } }
  | { type: "SET_POMODORO_SETTINGS"; payload: PomodoroSettings }
  | { type: "NEXT_PHASE" }
  | { type: "COMPLETE_POMODORO" };

/**
 * Handles the completion of a focus session by saving it to the database
 * and sending webhook notifications if configured.
 * 
 * @param addFocusSession - Function to add a focus session to the database
 * @param tag - The tag associated with this focus session
 * @param startTime - The timestamp when the session started
 * @param data - Configuration data including user name, tag, and webhook URL
 * @param addPoints - Function to add reward points
 * @param actualDuration - Actual session duration in seconds (for Pomodoro mode)
 */
const handleFinish = (
  addFocusSession: (tag: string, startTime: Date, endTime: Date) => Promise<void>,
  tag: string,
  startTime: number,
  data: { name: string; tag: string; webhook: string },
  addPoints: (points: number) => void,
  actualDuration?: number
) => {
  const endTime = Date.now();
  const elapsedSeconds = actualDuration || Math.floor((endTime - startTime) / 1000);

  const timeobj = durationFromSeconds(elapsedSeconds);
  const formattedTime = formatTimeNew(timeobj, "H:M:S", "text");

  if (data.name && data.webhook && data.tag) {
    sendMessage(
      `${data.name} focused for \`${formattedTime}\` on \`#${data.tag}\``,
      data.webhook
    ).then((s) => console.log("Submitted", s));
  }

  if (elapsedSeconds < 60) {
    toast("You need to focus for at least 1 minute.", {
      icon: <IoIosTimer />,
    });
    return;
  }

  addPoints(Math.floor(elapsedSeconds / 60));
  addFocusSession(tag, new Date(startTime), new Date(endTime));
  
  const sessionType = actualDuration ? "Pomodoro session" : "Focus session";
  toast(`${sessionType} completed: ${formatTime(elapsedSeconds / 60, 0, 1)} minutes.`, {
    icon: <IoIosTimer />,
  });
};

/**
 * Timer State Reducer
 * Handles all state transitions for both standard and Pomodoro modes
 * 
 * @param state - Current timer state
 * @param action - Action to perform on the state
 * @returns Updated state
 */
function pomoReducer(state: PomoState, action: Action): PomoState {
  switch (action.type) {
    case "START":
      return { ...state, isRunning: true, startTime: action.payload.startTime };

    case "PAUSE":
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: action.payload.elapsedSeconds,
      };

    case "RESET":
      // Handle session completion and saving
      if (state.elapsedSeconds > 0 && action.payload?.tag) {
        let startTime = state.startTime;
        
        // Calculate actual duration for Pomodoro mode
        let actualDuration: number | undefined;
        if (state.mode === "pomodoro" && state.phase === "focus") {
          const totalDuration = state.pomodoroSettings.focusDuration * 60;
          actualDuration = totalDuration - state.elapsedSeconds;
        }
        
        // If startTime is null, calculate it backwards
        if (!startTime) {
          const duration = actualDuration || state.elapsedSeconds;
          startTime = Date.now() - (duration * 1000);
        }
        
        // Only save focus sessions (not break periods)
        if (state.mode === "standard" || state.phase === "focus") {
          handleFinish(
            state.addFocusSession,
            action.payload.tag,
            startTime,
            state.data,
            state.addPoints,
            actualDuration
          );
        }
      }
      
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: action.payload?.elapsedSeconds ?? 0,
        startTime: null,
        phase: "focus", // Reset to focus phase
      };

    case "UPDATE":
      return {
        ...state,
        elapsedSeconds: action.payload.elapsedSeconds,
      };

    case "SET_DATA":
      return {
        ...state,
        data: action.payload,
      };

    case "SET_MODE":
      // When switching modes, reset timer and adjust elapsedSeconds
      const newElapsedSeconds = action.payload.mode === "pomodoro" 
        ? state.pomodoroSettings.focusDuration * 60 
        : 0;
      
      return {
        ...state,
        mode: action.payload.mode,
        elapsedSeconds: newElapsedSeconds,
        isRunning: false,
        startTime: null,
        phase: "focus",
      };

    case "SET_POMODORO_SETTINGS":
      // Update settings and adjust current timer if in focus phase
      const shouldUpdateTimer = state.mode === "pomodoro" && state.phase === "focus" && !state.isRunning;
      
      return {
        ...state,
        pomodoroSettings: action.payload,
        elapsedSeconds: shouldUpdateTimer ? action.payload.focusDuration * 60 : state.elapsedSeconds,
      };

    case "NEXT_PHASE":
      if (state.mode !== "pomodoro") return state;
      
      const nextPhase: PomodoroPhase = state.phase === "focus" ? "break" : "focus";
      const nextDuration = nextPhase === "focus" 
        ? state.pomodoroSettings.focusDuration * 60
        : state.pomodoroSettings.breakDuration * 60;
      
      return {
        ...state,
        phase: nextPhase,
        elapsedSeconds: nextDuration,
        isRunning: false,
        startTime: null,
      };

    case "COMPLETE_POMODORO":
      // Complete the current Pomodoro session and reset
      if (state.mode === "pomodoro" && state.phase === "focus") {
        const actualDuration = (state.pomodoroSettings.focusDuration * 60) - state.elapsedSeconds;
        if (actualDuration > 0 && state.startTime && state.data.tag) {
          handleFinish(
            state.addFocusSession,
            state.data.tag,
            state.startTime,
            state.data,
            state.addPoints,
            actualDuration
          );
        }
      }
      
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: state.pomodoroSettings.focusDuration * 60,
        startTime: null,
        phase: "focus",
      };

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
} | null>(null);

/**
 * Enhanced Pomodoro Timer Provider Component
 * Manages timer state, persistence, and automatic updates for both timer modes.
 * 
 * @param children - React children to wrap with the provider
 */
export function PomoProvider({ children }: { children: React.ReactNode }) {
  const { loadFocusSessions, addFocusSession } = useFocus();
  const { name, webhook } = useConfig();
  const { tag } = useTag();
  const { addPoints, loadRewards } = useRewards();

  // Default Pomodoro settings (25 minutes focus, 5 minutes break)
  const defaultPomodoroSettings: PomodoroSettings = {
    focusDuration: 25,
    breakDuration: 5,
  };

  const [state, dispatch] = useReducer(pomoReducer, {
    isRunning: false,
    startTime: null,
    elapsedSeconds: 0,
    mode: "standard",
    phase: "focus",
    pomodoroSettings: defaultPomodoroSettings,
    addFocusSession: addFocusSession,
    data: { name: "", webhook: "", tag: "" },
    addPoints: addPoints,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const titleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTimeRef = useRef<number>(0);

  // Load persisted data on mount
  useEffect(() => {
    loadFocusSessions();
    loadRewards();
    
    if (typeof window !== "undefined") {
      // Load timer mode
      const savedMode = localStorage.getItem("timerMode") as TimerMode;
      if (savedMode && (savedMode === "standard" || savedMode === "pomodoro")) {
        dispatch({ type: "SET_MODE", payload: { mode: savedMode } });
      }

      // Load Pomodoro settings
      const savedPomodoroSettings = localStorage.getItem("pomodoroSettings");
      if (savedPomodoroSettings) {
        try {
          const settings = JSON.parse(savedPomodoroSettings);
          dispatch({ type: "SET_POMODORO_SETTINGS", payload: settings });
        } catch (error) {
          console.error("Failed to parse saved Pomodoro settings:", error);
        }
      }

      // Load saved time based on mode
      const savedTime = Number(localStorage.getItem("pomoTime")) || 0;
      if (savedTime > 0) {
        dispatch({ type: "RESET", payload: { elapsedSeconds: savedTime } });
      }
    }
  }, [loadFocusSessions, loadRewards]);

  // Handle late-loaded config values
  useEffect(() => {
    if (name && webhook && tag) {
      dispatch({
        type: "SET_DATA",
        payload: { name, webhook, tag },
      });
    }
  }, [name, webhook, tag]);

  /**
   * Debounced function to save timer state to localStorage.
   */
  const saveToLocalStorage = useCallback((elapsedSeconds: number) => {
    if (typeof window !== "undefined" && elapsedSeconds !== lastSavedTimeRef.current) {
      localStorage.setItem("pomoTime", String(elapsedSeconds));
      lastSavedTimeRef.current = elapsedSeconds;
    }
  }, []);

  // Persist timer state
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToLocalStorage(state.elapsedSeconds);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [state.elapsedSeconds, saveToLocalStorage]);

  // Persist mode selection
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("timerMode", state.mode);
    }
  }, [state.mode]);

  // Persist Pomodoro settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pomodoroSettings", JSON.stringify(state.pomodoroSettings));
    }
  }, [state.pomodoroSettings]);

  /**
   * Timer update logic - handles both count-up and count-down modes
   */
  useEffect(() => {
    if (state.isRunning && state.startTime) {
      intervalRef.current = setInterval(() => {
        const currentTime = Date.now();
        const timeDiff = Math.floor((currentTime - state.startTime!) / 1000);
        
        let newElapsedSeconds: number;
        
        if (state.mode === "standard") {
          // Standard mode: count up
          newElapsedSeconds = timeDiff;
        } else {
          // Pomodoro mode: count down
          const initialDuration = state.phase === "focus" 
            ? state.pomodoroSettings.focusDuration * 60
            : state.pomodoroSettings.breakDuration * 60;
          
          newElapsedSeconds = Math.max(0, initialDuration - timeDiff);
          
          // Auto-transition when timer reaches zero
          if (newElapsedSeconds === 0 && state.isRunning) {
            if (state.phase === "focus") {
              // Focus completed - save session and move to break
              const actualDuration = state.pomodoroSettings.focusDuration * 60;
              if (state.startTime && state.data.tag) {
                handleFinish(
                  state.addFocusSession,
                  state.data.tag,
                  state.startTime,
                  state.data,
                  state.addPoints,
                  actualDuration
                );
              }
              
              toast("Focus session complete! Time for a break.", {
                icon: <IoIosTimer />,
              });
              
              dispatch({ type: "NEXT_PHASE" });
            } else {
              // Break completed - back to focus
              toast("Break time over! Ready to focus again?", {
                icon: <IoIosTimer />,
              });
              
              dispatch({ type: "NEXT_PHASE" });
            }
            return;
          }
        }
        
        dispatch({
          type: "UPDATE",
          payload: { elapsedSeconds: newElapsedSeconds },
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning, state.startTime, state.mode, state.phase, state.pomodoroSettings, state.addFocusSession, state.data, state.addPoints]);

  /**
   * Document title updates with current timer
   */
  useEffect(() => {
    if (state.isRunning) {
      titleIntervalRef.current = setInterval(() => {
        const minutes = Math.floor(state.elapsedSeconds / 60);
        const seconds = state.elapsedSeconds % 60;
        const timeDisplay = formatTime(minutes, seconds);
        const modePrefix = state.mode === "pomodoro" 
          ? `${state.phase === "focus" ? "🍅 Focus" : "☕ Break"}` 
          : "⏱️ Timer";
        
        document.title = `${modePrefix} - ${timeDisplay} | BIT Focus`;
      }, 1000);
    } else {
      document.title = "BIT Focus";
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
    }

    return () => {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
    };
  }, [state.isRunning, state.elapsedSeconds, state.mode, state.phase]);

  // Context value
  const contextValue = {
    state,
    start: () => {
      const startTime = state.mode === "standard" 
        ? Date.now() - state.elapsedSeconds * 1000
        : Date.now();
      
      if (Number(localStorage.getItem("pomoTime")) === 0 && name && webhook && tag) {
        const modeText = state.mode === "pomodoro" 
          ? `${state.phase} (${state.phase === "focus" ? state.pomodoroSettings.focusDuration : state.pomodoroSettings.breakDuration}min)`
          : "standard";
        
        sendMessage(
          `${name} started ${modeText} timer on \`#${tag}\`.`,
          webhook
        ).then((s) => console.log("Submitted", s));
      }
      
      dispatch({ type: "START", payload: { startTime } });
    },
    pause: () => {
      if (state.startTime) {
        dispatch({ type: "PAUSE", payload: { elapsedSeconds: state.elapsedSeconds } });
      }
    },
    reset: () => {
      const resetSeconds = state.mode === "pomodoro" 
        ? state.pomodoroSettings.focusDuration * 60 
        : 0;
      
      dispatch({
        type: "RESET",
        payload: { elapsedSeconds: resetSeconds, tag: tag || "Focus" },
      });
    },
    setMode: (mode: TimerMode) => {
      dispatch({ type: "SET_MODE", payload: { mode } });
    },
    setPomodoroSettings: (settings: PomodoroSettings) => {
      dispatch({ type: "SET_POMODORO_SETTINGS", payload: settings });
    },
    nextPhase: () => {
      dispatch({ type: "NEXT_PHASE" });
    },
    completePomodoro: () => {
      dispatch({ type: "COMPLETE_POMODORO" });
    },
  };

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