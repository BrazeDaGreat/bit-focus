"use client";
import { createContext, useContext, useReducer, useEffect } from "react";
import { IoIosTimer } from "react-icons/io";
import { toast } from "sonner";
import { useFocus } from "./useFocus";
import { formatTime } from "@/lib/utils";

const handleFinish = (
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date
  ) => Promise<void>
) => {
  const seconds = Number(localStorage.getItem("pomoTime") ?? 0);
  console.log("Focused for", seconds);
  addFocusSession(
    "Code",
    new Date(Date.now() - seconds * 1000),
    new Date(Date.now())
  );
  toast(`Focused for ${formatTime(seconds, -1, 1)} seconds.`, {
    icon: <IoIosTimer />,
  });
};

// Types
interface PomoState {
  isRunning: boolean;
  elapsedSeconds: number;
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date
  ) => Promise<void>;
}

type Action =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESET"; payload?: number }
  | { type: "TICK" };

// Reducer Function
function pomoReducer(state: PomoState, action: Action): PomoState {
  switch (action.type) {
    case "START":
      return { ...state, isRunning: true };
    case "PAUSE":
      return { ...state, isRunning: false };
    case "RESET":
      if (state.elapsedSeconds > 0) handleFinish(state.addFocusSession);
      return {
        isRunning: false,
        elapsedSeconds: action.payload ?? 0,
        addFocusSession: state.addFocusSession,
      };
    case "TICK":
      return state.isRunning
        ? { ...state, elapsedSeconds: state.elapsedSeconds + 1 }
        : state;
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

// Provider Component
export function PomoProvider({ children }: { children: React.ReactNode }) {
  const { loadFocusSessions, addFocusSession, focusSessions } = useFocus();
  const [state, dispatch] = useReducer(pomoReducer, {
    isRunning: false,
    elapsedSeconds: 0, // Default value
    addFocusSession: addFocusSession,
  });

  useEffect(() => {
    loadFocusSessions();
    console.log("Loaded Focus Sessions");
  }, [loadFocusSessions]);

  useEffect(() => {
    console.log("Focus Sessions initialized", focusSessions);
  }, [focusSessions]);

  // Load saved time from localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTime = Number(localStorage.getItem("pomoTime")) || 0;
      dispatch({ type: "RESET", payload: savedTime });
    }
  }, []);

  // Save timer state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pomoTime", String(state.elapsedSeconds));
    }
  }, [state.elapsedSeconds]);

  // Auto increment time when running
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (state.isRunning) {
      interval = setInterval(() => {
        dispatch({ type: "TICK" });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.isRunning]);

  return (
    <PomoContext.Provider
      value={{
        state,
        start: () => dispatch({ type: "START" }),
        pause: () => dispatch({ type: "PAUSE" }),
        reset: () => dispatch({ type: "RESET", payload: 0 }),
      }}
    >
      {children}
    </PomoContext.Provider>
  );
}

// Custom Hook to Use Pomodoro Timer
export function usePomo() {
  const context = useContext(PomoContext);
  if (!context) {
    throw new Error("usePomo must be used within a PomoProvider");
  }
  return context;
}
