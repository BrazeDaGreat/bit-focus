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
import { formatTime } from "@/lib/utils";
import { useTag } from "@/hooks/useTag";

// Function to handle the end of a focus session
const handleFinish = (
  addFocusSession: (
    tag: string,
    startTime: Date,
    endTime: Date
  ) => Promise<void>,
  tag: string,
  startTime: number
) => {
  const endTime = Date.now();
  const elapsedSeconds = Math.floor((endTime - startTime) / 1000);
  addFocusSession(tag, new Date(startTime), new Date(endTime));
  toast(`Focused for ${formatTime(elapsedSeconds/60, 0, 1)} seconds.`, {
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
}

type Action =
  | { type: "START"; payload: { startTime: number } }
  | { type: "PAUSE"; payload: { elapsedSeconds: number } }
  | { type: "RESET"; payload?: { elapsedSeconds?: number; tag?: string } }
  | { type: "UPDATE"; payload: { elapsedSeconds: number } };

function pomoReducer(state: PomoState, action: Action): PomoState {
  switch (action.type) {
    case "START":
      return { ...state, isRunning: true, startTime: action.payload.startTime };
    case "PAUSE":
      console.log("Pause");
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: action.payload.elapsedSeconds,
      };
    case "RESET":
      console.log("Reset", state.elapsedSeconds > 0 && action.payload?.tag && state.startTime);
      if (state.elapsedSeconds > 0 && action.payload?.tag && state.startTime) {
        handleFinish(
          state.addFocusSession,
          action.payload.tag,
          state.startTime
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
  const { loadFocusSessions, addFocusSession } = useFocus();
  const { tag } = useTag();
  const [state, dispatch] = useReducer(pomoReducer, {
    isRunning: false,
    startTime: null,
    elapsedSeconds: 0,
    addFocusSession: addFocusSession,
  });

  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    loadFocusSessions();
    console.log("Loaded Focus Sessions");
  }, [loadFocusSessions]);

  // Load saved time from localStorage
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
      if (state.elapsedSeconds > 0) {
        document.title = `BIT Focus - ${formatTime(state.elapsedSeconds/60, 0, 1)}`;
      } else document.title = `BIT Focus`;
    }
  }, [state.elapsedSeconds]);

  // Function to update elapsed time
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

  // Start the animation frame loop when the timer is running
  useEffect(() => {
    if (state.isRunning) {
      requestRef.current = requestAnimationFrame(updateElapsedTime);
      // document.title = `BIT Focus - ${formatTime(state.elapsedSeconds/60, 0, 1)}`;
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRunning]);

  return (
    <PomoContext.Provider
      value={{
        state,
        start: () => {
          const startTime = Date.now() - state.elapsedSeconds * 1000;
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

// Custom Hook to Use Pomodoro Timer
export function usePomo() {
  const context = useContext(PomoContext);
  if (!context) {
    throw new Error("usePomo must be used within a PomoProvider");
  }
  return context;
}
