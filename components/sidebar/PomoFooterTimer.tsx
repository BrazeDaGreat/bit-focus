// import { useStopwatch } from "react-timer-hook"
import { Card, CardFooter, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { usePomo } from "@/hooks/PomoContext";
import { FaCoffee, FaPause, FaPlay } from "react-icons/fa";
import { FaForwardFast, FaX } from "react-icons/fa6";
import { cn, formatTime } from "@/lib/utils";
import { useState } from "react";
import TagSelector from "../TagSelector";
import { RiFocus2Line } from "react-icons/ri";
import { GiTomato } from "react-icons/gi";

/**
 * Focus Mode Overlay Props Interface
 * Configuration for the fullscreen focus mode overlay
 */
interface FocusModeProps {
  /** Function to close focus mode */
  setFocusMode: (focusMode: boolean) => void;
  /** Current minutes displayed */
  minutes: number;
  /** Current seconds displayed */
  seconds: number;
  /** Function to start timer */
  start: () => void;
  /** Function to pause timer */
  pause: () => void;
  /** Function to reset timer */
  reset: () => void;
  /** Whether timer is currently running */
  isRunning: boolean;
  /** Current timer mode */
  mode: "standard" | "pomodoro";
  /** Current Pomodoro phase (if applicable) */
  phase?: "focus" | "break";
}

/**
 * Fullscreen Focus Mode Overlay Component
 * 
 * Provides a distraction-free fullscreen timer interface with large display
 * and minimal controls. Adapts appearance based on timer mode and phase.
 * 
 * @param props - Focus mode configuration and controls
 * @returns JSX element containing the fullscreen overlay
 */
const FocusMode = ({ 
  setFocusMode, 
  start, 
  pause, 
  reset, 
  isRunning, 
  minutes, 
  seconds,
  mode,
  phase
}: FocusModeProps) => {
  // Dynamic styling based on mode and phase
  const isBreak = mode === "pomodoro" && phase === "break";
  const bgColor = isBreak ? "bg-gradient-to-br from-amber-950 to-orange-950" : "bg-black";
  const textColor = isBreak ? "text-amber-100" : "text-white";
  
  return (
    <div className={cn(
      "fixed w-screen h-screen top-0 left-0 z-50 flex flex-col items-center justify-center gap-12 _animate_in",
      bgColor
    )}>
      {/* Close Button */}
      <div className="absolute top-4 right-4">
        <Button
          size={"icon"}
          className="bg-white/10 hover:bg-white/20 border-white/20"
          variant={"outline"}
          onClick={() => setFocusMode(false)}
        >
          <FaX className={textColor} />
        </Button>
      </div>

      {/* Mode and Phase Indicator */}
      {mode === "pomodoro" && (
        <div className={cn("flex items-center gap-3 text-xl", textColor)}>
          {isBreak ? (
            <>
              <FaCoffee className="w-6 h-6 text-amber-400" />
              <span>Break Time</span>
            </>
          ) : (
            <>
              <GiTomato className="w-6 h-6 text-red-400" />
              <span>Focus Time</span>
            </>
          )}
        </div>
      )}

      {/* Large Timer Display */}
      <div className={cn("text-8xl font-bold", textColor)}>
        {formatTime(minutes, seconds)}
      </div>

      {/* Tag Selector */}
      <TagSelector noHover />

      {/* Timer Controls */}
      <div className={cn("w-80 h-16", "flex", "gap-2")}>
        <Button
          size={"icon"}
          className="flex-2/3 h-full bg-white/10 hover:bg-white/20 border-white/20"
          variant={"outline"}
          onClick={isRunning ? pause : start}
        >
          {isRunning ? <FaPause className={textColor} /> : <FaPlay className={textColor} />}
        </Button>
        <Button
          size={"icon"}
          className="flex-1/3 h-full bg-red-500/20 hover:bg-red-500/30 border-red-500/30"
          variant={"outline"}
          onClick={reset}
        >
          <FaForwardFast className="text-red-300" />
        </Button>
      </div>
    </div>
  );
};

/**
 * Enhanced Sidebar Timer Component
 * 
 * Displays a compact timer in the sidebar with mode-appropriate styling
 * and controls. Shows Pomodoro phase information when applicable and
 * provides quick access to focus mode overlay.
 * 
 * @returns JSX element containing the sidebar timer interface
 */
export default function PomoFooterTimer() {
  const { state, start, pause, reset } = usePomo();
  const [focusMode, setFocusMode] = useState<boolean>(false);
  
  // Calculate display values
  const minutes = state.mode === "pomodoro" && state.phase === "focus"
    ? Math.floor(Math.max(0, (state.pomodoroSettings.focusDuration * 60) - state.elapsedSeconds) / 60)
    : state.mode === "pomodoro" && state.phase === "break"
      ? Math.floor(Math.max(0, (state.pomodoroSettings.breakDuration * 60) - state.elapsedSeconds) / 60)
      : Math.floor(state.elapsedSeconds / 60);

  const seconds = state.mode === "pomodoro" && state.phase === "focus"
    ? Math.max(0, (state.pomodoroSettings.focusDuration * 60) - state.elapsedSeconds) % 60
    : state.mode === "pomodoro" && state.phase === "break"
      ? Math.max(0, (state.pomodoroSettings.breakDuration * 60) - state.elapsedSeconds) % 60
      : state.elapsedSeconds % 60;
  
  // Determine styling based on mode and phase
  const isBreak = state.mode === "pomodoro" && state.phase === "break";
  const cardClassName = cn("min-w-60 transition-colors relative");
  const timerClassName = cn("text-3xl text-center transition-colors");

  return (
    <>
      {/* Focus Mode Overlay */}
      {focusMode && (
        <FocusMode 
          setFocusMode={setFocusMode} 
          start={start} 
          pause={pause} 
          reset={reset} 
          isRunning={state.isRunning} 
          minutes={minutes} 
          seconds={seconds}
          mode={state.mode}
          phase={state.phase}
        />
      )}

      {/* Compact Sidebar Timer */}
      <Card className={cardClassName}>
        {isBreak && <div className="absolute top-2 right-2 bg-secondary-foreground text-secondary p-1 rounded-full shadow-lg animate-pulse flex text-xs items-center gap-1">
          <FaCoffee />
          Break
        </div>}
        {/* Main Timer Display */}
        <CardTitle className={timerClassName}>
          {formatTime(minutes, seconds)}
        </CardTitle>

        {/* Control Buttons */}
        <CardFooter className="flex items-center justify-center gap-2">
          <Button
            size={"icon"}
            className="w-1/3"
            variant={"secondary"}
            onClick={state.isRunning ? pause : start}
          >
            {state.isRunning ? <FaPause /> : <FaPlay />}
          </Button>
          
          <Button 
            size={"icon"} 
            variant={"destructive"} 
            onClick={reset}
          >
            <FaForwardFast />
          </Button>
          
          <Button 
            size={"icon"} 
            variant={"default"} 
            onClick={() => setFocusMode(true)}
          >
            <RiFocus2Line />
          </Button>
        </CardFooter>

        {/* Progress Indicator for Pomodoro Mode */}
        {state.mode === "pomodoro" && (
          <div className="px-4 pb-3">
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  "bg-accent-foreground"
                )}
                style={{
                  width: `${
                    state.phase === "focus"
                      ? (state.elapsedSeconds / (state.pomodoroSettings.focusDuration * 60)) * 100
                      : (state.elapsedSeconds / (state.pomodoroSettings.breakDuration * 60)) * 100
                  }%`
                }}
              />
            </div>
          </div>
        )}
      </Card>
    </>
  );
}