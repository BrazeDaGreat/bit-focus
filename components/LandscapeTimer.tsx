/**
 * Landscape Timer
 *
 * A phone-sized bedside clock for the running session: pure black, the clock
 * and its phase label, and a close button. Nothing else is lit, so on AMOLED
 * screens the rest of the panel stays off.
 *
 * Opening it asks the browser for fullscreen and a landscape orientation lock.
 * Where either is refused (iOS Safari, desktop browsers), the frame rotates
 * itself while the phone is held upright, so the clock always reads sideways.
 *
 * The clock drifts a few pixels every minute so the digits never sit on the
 * same pixels for a whole session.
 *
 * @fileoverview Fullscreen AMOLED landscape timer for mobile
 * @author BIT Focus Development Team
 */

"use client";

import { type JSX, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { displaySeconds, usePomo } from "@/hooks/PomoContext";
import { useFocusGoal } from "@/hooks/useFocusGoal";
import { describeRing } from "@/lib/timerRing";
import { cn, formatClock } from "@/lib/utils";
import { FaXmark } from "react-icons/fa6";

/** How far, in pixels, the clock may drift from centre. */
const DRIFT_PX = 6;
/** How often the clock moves to a new spot. */
const DRIFT_INTERVAL_MS = 60_000;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export default function LandscapeTimer({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element | null {
  const { state } = usePomo();
  const { goalMinutes } = useFocusGoal();
  const [mounted, setMounted] = useState(false);
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Fullscreen + landscape lock, both best effort. Leaving fullscreen through
  // the system back gesture closes the timer too.
  useEffect(() => {
    setMounted(true);
    let enteredFullscreen = false;

    const onFullscreenChange = () => {
      if (enteredFullscreen && !document.fullscreenElement) onCloseRef.current();
    };

    const enter = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: "hide" });
          enteredFullscreen = true;
          document.addEventListener("fullscreenchange", onFullscreenChange);
        }
        await (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape");
      } catch {
        // Unsupported or refused — the portrait rotation below takes over.
      }
    };
    void enter();

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      try {
        screen.orientation?.unlock?.();
      } catch {}
      if (enteredFullscreen && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDrift({
        x: Math.round((Math.random() * 2 - 1) * DRIFT_PX),
        y: Math.round((Math.random() * 2 - 1) * DRIFT_PX),
      });
    }, DRIFT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!mounted) return null;

  const hasElapsed = state.startTime !== null || state.elapsedSeconds > 0;
  const ring = describeRing(state, goalMinutes, hasElapsed);
  const clock = formatClock(displaySeconds(state));
  const label = state.isRunning ? ring.label : hasElapsed ? "Paused" : ring.label;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Landscape timer"
      className="fixed inset-0 z-[100] overflow-hidden bg-black text-neutral-300"
    >
      {/* The landscape frame. Held upright, it turns a quarter so its top
          edge runs along the phone's right side. */}
      <div
        className="absolute top-1/2 left-1/2 h-dvh w-dvw -translate-x-1/2 -translate-y-1/2 portrait:h-dvw portrait:w-dvh portrait:rotate-90"
        style={{ containerType: "size" }}
      >
        <div
          className="flex size-full flex-col items-center justify-center transition-transform duration-[2000ms] ease-in-out motion-reduce:transition-none"
          style={{ transform: `translate(${drift.x}px, ${drift.y}px)` }}
        >
          <span
            className="flex items-center gap-2 text-[max(11px,2.2cqh)] font-medium uppercase tracking-[0.24em] transition-colors duration-700"
            style={{ color: ring.color, opacity: state.isRunning ? 0.8 : 0.45 }}
          >
            {state.isRunning && (
              <span
                className="size-[0.55em] rounded-full motion-safe:animate-pulse"
                style={{ backgroundColor: ring.color }}
              />
            )}
            {label}
          </span>

          <span
            role="timer"
            aria-live="off"
            className={cn(
              "mt-[1.5cqh] select-none font-mono font-semibold leading-none tracking-tighter tabular-nums transition-opacity duration-500",
              !state.isRunning && "opacity-40"
            )}
            style={{
              fontSize: clock.length > 5 ? "min(21cqw, 52cqh)" : "min(30cqw, 62cqh)",
            }}
          >
            {clock}
          </span>
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          title="Close landscape timer"
          aria-label="Close landscape timer"
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:bg-white/10"
        >
          <FaXmark className="size-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
