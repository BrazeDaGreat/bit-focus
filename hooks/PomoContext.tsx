/**
 * PomoContext.tsx - Optimized Pomodoro Timer Context and Provider
 * 
 * This file provides a React context for managing a Pomodoro-style focus timer.
 * It handles timer state (running/paused), elapsed time tracking, and automatic
 * session saving when focus sessions are completed. The timer state persists
 * across page refreshes using localStorage.
 * 
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

/**
 * Handles the completion of a focus session by saving it to the database
 * and sending webhook notifications if configured.
 * 
 * @param addFocusSession - Function to add a focus session to the database
 * @param tag - The tag associated with this focus session
 * @param startTime - The timestamp when the session started
 * @param data - Configuration data including user name, tag, and webhook URL
 */
const handleFinish = (
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date
  ) => Promise<void>,
  tag: string,
  startTime: number,
  data: {
    name: string;
    tag: string;
    webhook: string;
  }
) => {
  const endTime = Date.now();
  const elapsedSeconds = Math.floor((endTime - startTime) / 1000);

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

  addFocusSession(tag, new Date(startTime), new Date(endTime));
  toast(`Focused for ${formatTime(elapsedSeconds / 60, 0, 1)} seconds.`, {
    icon: <IoIosTimer />,
  });
};

// Types
interface PomoState {
  isRunning: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date
  ) => Promise<void>;
  data: {
    name: string;
    tag: string;
    webhook: string;
  };
}

type Action =
  | { type: "START"; payload: { startTime: number } }
  | { type: "PAUSE"; payload: { elapsedSeconds: number } }
  | {
      type: "RESET";
      payload?: { elapsedSeconds?: number; tag?: string };
    }
  | { type: "UPDATE"; payload: { elapsedSeconds: number } }
  | {
      type: "SET_DATA";
      payload: { name: string; tag: string; webhook: string };
    };

/**
 * Reducer function for managing Pomodoro timer state transitions.
 * Handles starting, pausing, resetting, and updating the timer.
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
        
        // If startTime is null (e.g., after page refresh), calculate it backwards
        // from current time and elapsed seconds to ensure session gets saved
        if (!startTime) {
          startTime = Date.now() - (state.elapsedSeconds * 1000);
        }
        
        handleFinish(
          state.addFocusSession,
          action.payload.tag,
          startTime,
          state.data
        );
      }
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: action.payload?.elapsedSeconds ?? 0,
        startTime: null,
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
} | null>(null);

/**
 * Provider Component for the Pomodoro Timer Context
 * Manages timer state, persistence, and automatic updates.
 * Uses optimized timer approach with setInterval instead of requestAnimationFrame.
 * 
 * @param children - React children to wrap with the provider
 */
export function PomoProvider({ children }: { children: React.ReactNode }) {
  const { loadFocusSessions, addFocusSession } = useFocus();
  const { name, webhook } = useConfig();
  const { tag } = useTag();

  const [state, dispatch] = useReducer(pomoReducer, {
    isRunning: false,
    startTime: null,
    elapsedSeconds: 0,
    addFocusSession: addFocusSession,
    data: { name: "", webhook: "", tag: "" },
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const titleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTimeRef = useRef<number>(0);

  useEffect(() => {
    loadFocusSessions();
    console.log("Loaded Focus Sessions");
  }, [loadFocusSessions]);

  // Handle late-loaded config values
  useEffect(() => {
    if (name && webhook && tag) {
      dispatch({
        type: "SET_DATA",
        payload: { name, webhook, tag },
      });
    }
  }, [name, webhook, tag]);

  // Load persisted timer state from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTime = Number(localStorage.getItem("pomoTime")) || 0;
      dispatch({ type: "RESET", payload: { elapsedSeconds: savedTime } });
    }
  }, []);

  /**
   * Debounced function to save timer state to localStorage.
   * Only saves if the time has actually changed to reduce I/O operations.
   */
  const saveToLocalStorage = useCallback((elapsedSeconds: number) => {
    if (typeof window !== "undefined" && elapsedSeconds !== lastSavedTimeRef.current) {
      localStorage.setItem("pomoTime", String(elapsedSeconds));
      lastSavedTimeRef.current = elapsedSeconds;
    }
  }, []);

  // Persist timer state to localStorage whenever it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToLocalStorage(state.elapsedSeconds);
    }, 100); // Debounce saves to every 100ms

    return () => clearTimeout(timeoutId);
  }, [state.elapsedSeconds, saveToLocalStorage]);

  /**
   * Updates the document title with current timer time.
   * Runs independently of main timer updates for better performance.
   */
  const updateDocumentTitle = useCallback(() => {
    if (state.isRunning && state.startTime) {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      if (elapsed > 0) {
        document.title = `BIT Focus - ${formatTime(elapsed / 60, 0, 1)}`;
      } else {
        document.title = "BIT Focus";
      }
    } else {
      document.title = "BIT Focus";
    }
  }, [state.isRunning, state.startTime]);

  // Handle document title updates
  useEffect(() => {
    if (state.isRunning && state.startTime) {
      // Update title immediately
      updateDocumentTitle();
      
      // Set up interval for title updates (less frequent than main timer)
      titleIntervalRef.current = setInterval(updateDocumentTitle, 1000);
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
      document.title = "BIT Focus";
    };
  }, [state.isRunning, state.startTime, updateDocumentTitle]);

  /**
   * Main timer update function using setInterval for better performance.
   * Updates every 100ms for smooth UI updates without blocking navigation.
   */
  useEffect(() => {
    if (state.isRunning && state.startTime) {
      intervalRef.current = setInterval(() => {
        const currentTime = Date.now();
        const newElapsedSeconds = Math.floor(
          (currentTime - state.startTime!) / 1000
        );
        
        dispatch({
          type: "UPDATE",
          payload: { elapsedSeconds: newElapsedSeconds },
        });
      }, 100); // Update every 100ms for smooth UI without blocking navigation
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
  }, [state.isRunning, state.startTime]);

  return (
    <PomoContext.Provider
      value={{
        state,
        start: () => {
          const startTime = Date.now() - state.elapsedSeconds * 1000;
          if (
            Number(localStorage.getItem("pomoTime")) === 0 &&
            name &&
            webhook &&
            tag
          ) {
            sendMessage(
              `${name} started focusing on \`#${tag}\`.`,
              webhook
            ).then((s) => console.log("Submitted", s));
          }
          dispatch({ type: "START", payload: { startTime } });
        },
        pause: () => {
          if (state.startTime) {
            const currentTime = Date.now();
            const elapsedSeconds = Math.floor(
              (currentTime - state.startTime) / 1000
            );
            dispatch({ type: "PAUSE", payload: { elapsedSeconds } });
          }
        },
        reset: () => {
          dispatch({
            type: "RESET",
            payload: { elapsedSeconds: 0, tag: tag || "Focus" },
          });
        },
      }}
    >
      {children}
    </PomoContext.Provider>
  );
}

/**
 * Custom Hook to Use Pomodoro Timer Context
 * Provides access to timer state and control functions.
 * 
 * @returns Timer state and control functions (start, pause, reset)
 * @throws Error if used outside of PomoProvider
 */
export function usePomo() {
  const context = useContext(PomoContext);
  if (!context) {
    throw new Error("usePomo must be used within a PomoProvider");
  }
  return context;
}