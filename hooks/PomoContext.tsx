"use client";
import { createContext, useContext, useReducer, useEffect } from "react";
import { IoIosTimer } from "react-icons/io";
import { toast } from "sonner";
import { useFocus } from "@/hooks/useFocus";
import { formatTime } from "@/lib/utils";
import { useTag } from "@/hooks/useTag"; // Adjust the import path

// Updated handleFinish to use the tag from useTag
const handleFinish = (
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date
  ) => Promise<void>,
  tag: string // Add tag as an argument
) => {
  const seconds = Number(localStorage.getItem("pomoTime") ?? 0);
  console.log("Focused for", seconds);
  addFocusSession(
    tag, // Use the passed tag
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
  | { type: "RESET"; payload?: { elapsedSeconds?: number; tag?: string } } // Add tag to payload
  | { type: "TICK" };

function pomoReducer(state: PomoState, action: Action): PomoState {
  switch (action.type) {
    case "START":
      return { ...state, isRunning: true };
    case "PAUSE":
      return { ...state, isRunning: false };
    case "RESET":
      if (state.elapsedSeconds > 0 && action.payload?.tag) {
        handleFinish(state.addFocusSession, action.payload.tag); // Pass tag to handleFinish
      }
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: action.payload?.elapsedSeconds ?? 0,
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
  const { tag } = useTag(); // Get the current tag
  const [state, dispatch] = useReducer(pomoReducer, {
    isRunning: false,
    elapsedSeconds: 0,
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
      dispatch({ type: "RESET", payload: { elapsedSeconds: savedTime } });
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
        reset: () => {
          console.log("Resetting with tag:", tag);
          dispatch({
            type: "RESET",
            payload: { elapsedSeconds: 0, tag: tag ? tag : "Focus" }, // Pass the tag here
          })
        }
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
