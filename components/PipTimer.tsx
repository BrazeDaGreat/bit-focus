"use client";
import { PipFunctionProps, usePipSpace } from "@/hooks/usePip";
import { formatTimeNew } from "@/lib/utils";
import { FaPause, FaPlay, FaCoffee } from "react-icons/fa";
import { GiTomato } from "react-icons/gi";

export interface PipTimer {
  time: number;
  running: boolean;
  mode: "standard" | "pomodoro";
  phase: "focus" | "break";
  pomodoroSettings: {
    focusDuration: number;
    breakDuration: number;
  };
  inc: {
    pause: number;
    resume: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PipTimer(props: PipFunctionProps) {
  const { data, update } = usePipSpace("piptimer", {
    time: 0,
    running: false,
    mode: "standard" as "standard" | "pomodoro",
    phase: "focus" as "focus" | "break",
    pomodoroSettings: { focusDuration: 25, breakDuration: 5 },
    inc: { pause: 0, resume: 0 },
  });

  const isPomodoro = data.mode === "pomodoro";
  const isBreak = isPomodoro && data.phase === "break";

  const accentColor = isBreak ? "#f59e0b" : "#f87171";
  const accentGlow  = isBreak ? "rgba(245,158,11,0.25)" : "rgba(248,113,113,0.25)";
  const accentDim   = isBreak ? "rgba(245,158,11,0.12)" : "rgba(248,113,113,0.12)";
  const accentBorder = isBreak ? "rgba(245,158,11,0.35)" : "rgba(248,113,113,0.35)";

  const getDisplayTime = () => {
    if (data.mode === "pomodoro") {
      const total = data.phase === "focus"
        ? data.pomodoroSettings.focusDuration * 60
        : data.pomodoroSettings.breakDuration * 60;
      const remaining = Math.max(0, total - data.time);
      return { minutes: Math.floor(remaining / 60), seconds: remaining % 60 };
    }
    return { minutes: Math.floor(data.time / 60), seconds: data.time % 60 };
  };

  const getProgress = () => {
    if (!isPomodoro) return 0;
    const total = data.phase === "focus"
      ? data.pomodoroSettings.focusDuration * 60
      : data.pomodoroSettings.breakDuration * 60;
    return Math.min(1, data.time / total);
  };

  const displayTime = getDisplayTime();
  const progress = getProgress();

  const handlePause  = () => update({ inc: { pause: 1, resume: 0 } });
  const handleResume = () => update({ inc: { pause: 0, resume: 1 } });

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "linear-gradient(160deg, #0c0c0e 0%, #111115 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: isPomodoro ? "7px" : "10px",
      position: "relative",
      overflow: "hidden",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute",
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        background: `radial-gradient(circle, ${accentGlow} 0%, transparent 70%)`,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }} />

      {/* Subtle grid overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
        `,
        backgroundSize: "16px 16px",
        pointerEvents: "none",
      }} />

      {/* Phase badge — pomodoro only */}
      {isPomodoro && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 9px 2px 7px",
          borderRadius: "999px",
          backgroundColor: accentDim,
          border: `1px solid ${accentBorder}`,
          fontSize: "9px",
          fontWeight: "700",
          color: accentColor,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          position: "relative",
          zIndex: 1,
        }}>
          {isBreak
            ? <FaCoffee style={{ fontSize: "8px", flexShrink: 0 }} />
            : <GiTomato style={{ fontSize: "9px", flexShrink: 0 }} />
          }
          {isBreak ? "Break" : "Focus"}
        </div>
      )}

      {/* Time display */}
      <div style={{
        fontSize: isPomodoro ? "2.1rem" : "2.6rem",
        fontWeight: "800",
        color: "#f1f1f3",
        letterSpacing: "-0.04em",
        lineHeight: 1,
        position: "relative",
        zIndex: 1,
        textShadow: `0 0 24px ${accentGlow}`,
      }}>
        {formatTimeNew(displayTime, "M:S", "digital")}
      </div>

      {/* Progress bar — pomodoro only */}
      {isPomodoro && (
        <div style={{
          width: "88px",
          height: "2px",
          backgroundColor: "rgba(255,255,255,0.07)",
          borderRadius: "2px",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}>
          <div style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${accentColor}99, ${accentColor})`,
            borderRadius: "2px",
            boxShadow: `0 0 6px ${accentColor}`,
            transition: "width 1s linear",
          }} />
        </div>
      )}

      {/* Control button */}
      <button
        onClick={data.running ? handlePause : handleResume}
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          border: `1.5px solid ${accentBorder}`,
          backgroundColor: accentDim,
          color: accentColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: "11px",
          boxShadow: `0 0 14px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          outline: "none",
          position: "relative",
          zIndex: 1,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.12)`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 14px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.08)`;
        }}
      >
        {data.running
          ? <FaPause style={{ fontSize: "9px" }} />
          : <FaPlay  style={{ fontSize: "9px", marginLeft: "1px" }} />
        }
      </button>

      {/* Mode label — standard only, subtle */}
      {!isPomodoro && (
        <div style={{
          fontSize: "8px",
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: "600",
          position: "relative",
          zIndex: 1,
        }}>
          Standard
        </div>
      )}
    </div>
  );
}
