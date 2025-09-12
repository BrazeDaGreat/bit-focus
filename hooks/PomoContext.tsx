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
  /** Total elapsed seconds from start (always counts up) */
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
  | { type: "COMPLETE_POMODORO" }
  | { type: "RESTORE_STATE"; payload: { 
      elapsedSeconds: number;
      mode: TimerMode;
      pomodoroSettings: PomodoroSettings;
      isRunning: boolean;
      startTime: number | null;
      phase: PomodoroPhase;
    }};;

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
      const newStartTime = state.startTime 
        ? Date.now() - (state.elapsedSeconds * 1000) // Resume from where we left off
        : action.payload.startTime; // Fresh start
      
      return { 
        ...state, 
        isRunning: true, 
        startTime: newStartTime 
      };

    case "PAUSE":
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: action.payload.elapsedSeconds,
        // Keep startTime for resume calculations
      };
    case "RESET":
      // Handle session completion and saving
      if (state.elapsedSeconds > 0 && action.payload?.tag) {
        let startTime = state.startTime;
        let sessionDuration = state.elapsedSeconds;
        
        // For Pomodoro mode, only save if we're in focus phase and have made meaningful progress
        if (state.mode === "pomodoro" && state.phase === "focus") {
          const totalFocusDuration = state.pomodoroSettings.focusDuration * 60;
          const remainingTime = Math.max(0, totalFocusDuration - state.elapsedSeconds);
          
          // Only save if we completed the session OR skipped with >1min remaining
          if (remainingTime === 0 || remainingTime >= 60) {
            sessionDuration = state.elapsedSeconds;
          } else {
            // Don't save sessions with < 1min progress
            sessionDuration = 0;
          }
        }
        
        // If startTime is null, calculate it backwards
        if (!startTime && sessionDuration > 0) {
          startTime = Date.now() - (sessionDuration * 1000);
        }
        
        // Only save focus sessions with meaningful duration (not break periods)
        if (sessionDuration > 0 && (state.mode === "standard" || state.phase === "focus")) {
          handleFinish(
            state.addFocusSession,
            action.payload.tag,
            startTime!,
            state.data,
            state.addPoints,
            sessionDuration
          );
        }
      }
      
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: 0,
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
      // When switching modes, preserve elapsed time if timer is running
      const shouldPreserveTime = state.isRunning && state.elapsedSeconds > 0;
      const newElapsedSeconds = shouldPreserveTime 
        ? state.elapsedSeconds
        : action.payload.mode === "pomodoro" 
          ? 0  // Reset to 0 for fresh Pomodoro start
          : 0; // Reset to 0 for standard mode
      
      return {
        ...state,
        mode: action.payload.mode,
        elapsedSeconds: newElapsedSeconds,
        isRunning: shouldPreserveTime ? state.isRunning : false,
        startTime: shouldPreserveTime ? state.startTime : null,
        phase: "focus",
      };
    case "RESTORE_STATE":
      return {
        ...state,
        elapsedSeconds: action.payload.elapsedSeconds,
        mode: action.payload.mode,
        pomodoroSettings: action.payload.pomodoroSettings,
        isRunning: action.payload.isRunning,
        startTime: action.payload.startTime,
        phase: action.payload.phase,
      };

    case "SET_POMODORO_SETTINGS":
      // Update settings and adjust current timer if in focus phase
      const shouldUpdateTimer = false;
      
      return {
        ...state,
        pomodoroSettings: action.payload,
        elapsedSeconds: shouldUpdateTimer ? action.payload.focusDuration * 60 : state.elapsedSeconds,
      };

    case "NEXT_PHASE":
      if (state.mode !== "pomodoro") return state;
      
      const nextPhase: PomodoroPhase = state.phase === "focus" ? "break" : "focus";
      
      return {
        ...state,
        phase: nextPhase,
        elapsedSeconds: 0,
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
  const { name, webhook } = useConfig();
  const { addPoints } = useRewards();
  const originalTitleRef = useRef<string | null>(null);
  
  // Initialize state with localStorage restoration
  const [state, dispatch] = useReducer(pomoReducer, {
    isRunning: false,
    startTime: null,
    elapsedSeconds: 0,
    mode: "standard",
    phase: "focus",
    pomodoroSettings: {
      focusDuration: 25,
      breakDuration: 5,
    },
    addFocusSession,
    data: { name: "", tag: "", webhook: "" },
    addPoints,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTimeRef = useRef<number>(0);

  /**
   * Initialize state from localStorage on component mount
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Restore saved time
      const savedTime = localStorage.getItem("pomoTime");
      const elapsedSeconds = savedTime ? parseInt(savedTime, 10) : 0;
      
      // Restore timer mode
      const savedMode = localStorage.getItem("timerMode") as TimerMode;
      const mode = savedMode === "pomodoro" ? "pomodoro" : "standard";
      
      // Restore Pomodoro settings
      const savedSettings = localStorage.getItem("pomodoroSettings");
      let pomodoroSettings = { focusDuration: 25, breakDuration: 5 };
      if (savedSettings) {
        try {
          pomodoroSettings = JSON.parse(savedSettings);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          console.warn("Failed to parse pomodoro settings from localStorage");
        }
      }
      
      // Restore phase for Pomodoro mode
      const savedPhase = localStorage.getItem("pomoPhase") as PomodoroPhase;
      const phase = savedPhase === "break" ? "break" : "focus";
      
      // Initialize with restored values (but don't restore running state on refresh)
      if (elapsedSeconds > 0 || mode !== "standard") {
        dispatch({ 
          type: "RESTORE_STATE", 
          payload: { 
            elapsedSeconds,
            mode,
            pomodoroSettings,
            isRunning: false, // Never restore running state on refresh
            startTime: null,
            phase
          }
        });
      } else {
        // Just set the mode and settings
        dispatch({ type: "SET_MODE", payload: { mode } });
        dispatch({ type: "SET_POMODORO_SETTINGS", payload: pomodoroSettings });
      }
    }
  }, []);

  // Update configuration when external data changes
  useEffect(() => {
    dispatch({
      type: "SET_DATA",
      payload: { name: name || "", tag: tag || "", webhook: webhook || "" },
    });
  }, [name, webhook, tag]);

  /**
   * Save timer state to localStorage - simplified without dependencies
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

  // Persist phase
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pomoPhase", state.phase);
    }
  }, [state.phase]);

  /**
   * Timer update logic - elapsedSeconds always counts up from 0
   */
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (state.isRunning && state.startTime) {
      intervalRef.current = setInterval(() => {
        const currentTime = Date.now();
        const newElapsedSeconds = Math.floor((currentTime - state.startTime!) / 1000);
        
        // Check for Pomodoro phase completion
        if (state.mode === "pomodoro") {
          const targetDuration = state.phase === "focus" 
            ? state.pomodoroSettings.focusDuration * 60
            : state.pomodoroSettings.breakDuration * 60;
          
          // Auto-transition when timer reaches target duration
          if (newElapsedSeconds >= targetDuration) {
            if (state.phase === "focus") {
              // Focus completed - save session and move to break
              if (state.startTime && state.data.tag) {
                handleFinish(
                  state.addFocusSession,
                  state.data.tag,
                  state.startTime,
                  state.data,
                  state.addPoints,
                  targetDuration
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
            return; // Exit early to prevent state update after phase change
          }
        }
        
        dispatch({ type: "UPDATE", payload: { elapsedSeconds: newElapsedSeconds } });
        // Update document title with current timer value
        if (typeof document !== "undefined") {
          // Store original title on first update
          if (originalTitleRef.current === null) {
            originalTitleRef.current = document.title;
          }
          
          // Format time for display in title
          let displayTime: string;
          if (state.mode === "pomodoro") {
            const targetDuration = state.phase === "focus" 
              ? state.pomodoroSettings.focusDuration * 60
              : state.pomodoroSettings.breakDuration * 60;
            const remainingSeconds = Math.max(0, targetDuration - newElapsedSeconds);
            const timeObj = durationFromSeconds(remainingSeconds);
            displayTime = formatTimeNew(timeObj, "M:S", "digital");
            const phasePhrase = state.phase === "focus" ? "Focus" : "Break";
            document.title = `${displayTime} | ${phasePhrase} - BIT Focus`;
          } else {
            const timeObj = durationFromSeconds(newElapsedSeconds);
            displayTime = formatTimeNew(timeObj, "M:S", "digital");
            document.title = `${displayTime} - BIT Focus`;
          }
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning, state.startTime, state.mode, state.phase, state.pomodoroSettings, state.data, state.addFocusSession, state.addPoints]);

  /**
   * Restore document title when timer stops or component unmounts
   */
  useEffect(() => {
    // Restore original title when timer stops
    if (!state.isRunning && originalTitleRef.current && typeof document !== "undefined") {
      document.title = originalTitleRef.current;
      originalTitleRef.current = null;
    }
    
    // Cleanup on unmount
    return () => {
      if (originalTitleRef.current && typeof document !== "undefined") {
        document.title = originalTitleRef.current;
      }
    };
  }, [state.isRunning]);

  // Context value with all timer controls
  const contextValue = {
    state,
    start: () => {
      const { name, webhook, tag } = state.data;
      
      // Calculate startTime based on whether this is a fresh start or resume
      let startTime: number;
      
      if (state.elapsedSeconds > 0) {
        // Resume - calculate startTime to account for already elapsed time
        startTime = Date.now() - (state.elapsedSeconds * 1000);
      } else {
        // Fresh start
        startTime = Date.now();
      }
      
      // Send webhook notification for fresh starts only
      if (state.elapsedSeconds === 0 && name && webhook && tag) {
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
      if (state.isRunning) {
        dispatch({ type: "PAUSE", payload: { elapsedSeconds: state.elapsedSeconds } });
      }
    },
    reset: () => {
      dispatch({
        type: "RESET",
        payload: { elapsedSeconds: 0, tag: tag || "Focus" },
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