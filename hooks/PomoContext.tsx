/**
 * PomoContext.tsx - Pomodoro Timer Context and Provider
 * 
 * This file provides a React context for managing a Pomodoro-style focus timer.
 * It handles timer state (running/paused), elapsed time tracking, and automatic
 * session saving when focus sessions are completed. The timer state persists
 * across page refreshes using localStorage.
 */

/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
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

  const requestRef = useRef<number | null>(null);

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

  // Persist timer state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pomoTime", String(state.elapsedSeconds));
    }
  }, [state.elapsedSeconds]);

  // Update document title with current timer when running
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (state.isRunning && state.startTime) {
      intervalId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startTime!) / 1000);

        if (elapsed > 0) {
          document.title = `BIT Focus - ${formatTime(elapsed / 60, 0, 1)}`;
        } else {
          document.title = "BIT Focus";
        }
      }, 1000);
    } else {
      document.title = "BIT Focus";
    }

    return () => {
      clearInterval(intervalId);
      document.title = "BIT Focus";
    };
  }, [state.isRunning, state.startTime]);

  /**
   * Updates the elapsed time using requestAnimationFrame for smooth updates
   */
  const updateElapsedTime = () => {
    if (state.isRunning && state.startTime) {
      const currentTime = Date.now();
      const newElapsedSeconds = Math.floor(
        (currentTime - state.startTime) / 1000
      );
      if (newElapsedSeconds !== state.elapsedSeconds) {
        dispatch({
          type: "UPDATE",
          payload: { elapsedSeconds: newElapsedSeconds },
        });
      }
    }
    requestRef.current = requestAnimationFrame(updateElapsedTime);
  };

  // Handle requestAnimationFrame updates when timer is running
  useEffect(() => {
    if (state.isRunning) {
      requestRef.current = requestAnimationFrame(updateElapsedTime);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [state.isRunning]);

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