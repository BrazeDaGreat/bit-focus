"use client";
import { PipFunctionProps, usePipSpace } from "@/hooks/usePip";
import { formatTimeNew } from "@/lib/utils";
import { FaPause, FaPlay, FaCoffee } from "react-icons/fa";
import { GiTomato } from "react-icons/gi";
// import { useEffect, useState } from "react";

// const FETCH_RATE = 1; // Fetch Rate in seconds

export interface PipTimer {
  /** Current timer value in seconds */
  time: number;
  /** Whether timer is currently running */
  running: boolean;
  /** Current timer mode */
  mode: "standard" | "pomodoro";
  /** Current Pomodoro phase (if applicable) */
  phase: "focus" | "break";
  /** Pomodoro configuration settings */
  pomodoroSettings: {
    focusDuration: number;
    breakDuration: number;
  };
  /** Control increment flags for communication */
  inc: {
    pause: number;
    resume: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PipTimer(props: PipFunctionProps) {
  // Sync with enhanced timer state
  const { data, update } = usePipSpace("piptimer", {
    time: 0,
    running: false,
    mode: "standard" as "standard" | "pomodoro",
    phase: "focus" as "focus" | "break",
    pomodoroSettings: {
      focusDuration: 25,
      breakDuration: 5,
    },
    inc: {
      pause: 0,
      resume: 0,
    },
  });

  // Determine display styling based on mode and phase
  const isPomodoro = data.mode === "pomodoro";
  const isBreak = isPomodoro && data.phase === "break";
  
  // Phase-specific styling
  const phaseColor = isBreak ? "#f59e0b" : "#ef4444"; // amber-500 : red-500
  const phaseIcon = isBreak ? <FaCoffee /> : <GiTomato />;
  const phaseText = isBreak ? "Break" : "Focus";

  /**
   * Handle pause action
   * Sends pause command to main timer through shared state
   */
  const handlePause = () => {
    update({ inc: { pause: 1, resume: 0 } });
  };

  /**
   * Handle resume action  
   * Sends resume command to main timer through shared state
   */
  const handleResume = () => {
    update({ inc: { pause: 0, resume: 1 } });
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center",
      height: "100vh",
      gap: "0.25rem",
      padding: "0.5rem"
    }}>
      {/* Mode and Phase Indicator */}
      {isPomodoro && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          fontSize: "0.75rem",
          color: phaseColor,
          fontWeight: "600",
          marginBottom: "0.1rem"
        }}>
          {phaseIcon}
          <span>{phaseText}</span>
        </div>
      )}

      {/* Main Timer Display */}
      <h1 style={{
        fontSize: "2rem",
        fontWeight: "800",
        color: isBreak ? "#f59e0b" : "#ffffff",
        margin: 0,
        textAlign: "center",
        fontFamily: "JetBrains Mono, monospace",
        lineHeight: "1"
      }}>
        {formatTimeNew(
          { 
            minutes: data.mode === "pomodoro" && data.phase === "focus"
              ? Math.floor(Math.max(0, (data.pomodoroSettings.focusDuration * 60) - data.time) / 60)
              : data.mode === "pomodoro" && data.phase === "break"
                ? Math.floor(Math.max(0, (data.pomodoroSettings.breakDuration * 60) - data.time) / 60)
                : Math.floor(data.time / 60),
            seconds: data.mode === "pomodoro" && data.phase === "focus"
              ? Math.max(0, (data.pomodoroSettings.focusDuration * 60) - data.time) % 60
              : data.mode === "pomodoro" && data.phase === "break"
                ? Math.max(0, (data.pomodoroSettings.breakDuration * 60) - data.time) % 60
                : data.time % 60
          },
          "M:S",
          "digital"
        )}
      </h1>

      {/* Control Buttons */}
      <div style={{ 
        display: "flex", 
        gap: "0.5rem",
        marginTop: "0.5rem"
      }}>
        {data.running ? (
          <button 
            className="button primary" 
            onClick={handlePause}
            style={{
              backgroundColor: isBreak ? "#f59e0b" : "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
              transition: "all 0.2s ease"
            }}
          >
            <FaPause />
          </button>
        ) : (
          <button 
            className="button primary" 
            onClick={handleResume}
            style={{
              backgroundColor: isBreak ? "#f59e0b" : "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
              transition: "all 0.2s ease"
            }}
          >
            <FaPlay />
          </button>
        )}
      </div>
    </div>
  );
}