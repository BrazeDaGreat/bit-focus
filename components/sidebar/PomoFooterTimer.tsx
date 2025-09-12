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
import { Badge } from "../ui/badge";

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
  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;
  
  // Determine styling based on mode and phase
  const isBreak = state.mode === "pomodoro" && state.phase === "break";
  const cardClassName = cn(
    "min-w-60 transition-colors",
    isBreak && "border-amber-200 dark:border-amber-800"
  );
  
  const timerClassName = cn(
    "text-3xl text-center transition-colors",
    isBreak && "text-amber-600"
  );

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
        {/* Timer Mode and Phase Indicator */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {state.mode === "pomodoro" ? (
                <div className="flex items-center gap-1">
                  {isBreak ? (
                    <>
                      <FaCoffee className="w-3 h-3" />
                      Break
                    </>
                  ) : (
                    <>
                      <GiTomato className="w-3 h-3" />
                      Focus
                    </>
                  )}
                </div>
              ) : (
                "Standard"
              )}
            </Badge>
            
            {/* Pomodoro Settings Display */}
            {state.mode === "pomodoro" && (
              <div className="text-xs text-muted-foreground">
                {state.pomodoroSettings.focusDuration}/{state.pomodoroSettings.breakDuration}min
              </div>
            )}
          </div>
        </div>

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
                  "h-1.5 rounded-full transition-all duration-300",
                  isBreak ? "bg-amber-500" : "bg-red-500"
                )}
                style={{
                  width: `${
                    state.phase === "focus"
                      ? ((state.pomodoroSettings.focusDuration * 60 - state.elapsedSeconds) / (state.pomodoroSettings.focusDuration * 60)) * 100
                      : ((state.pomodoroSettings.breakDuration * 60 - state.elapsedSeconds) / (state.pomodoroSettings.breakDuration * 60)) * 100
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