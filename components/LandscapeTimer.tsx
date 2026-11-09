/**
 * Landscape Timer
 *
 * A phone-sized bedside clock for the running session: pure black, the clock
 * and its phase label. Nothing else is lit, so on AMOLED screens the rest of
 * the panel stays off.
 *
 * Double-tap anywhere to bring up the controls: play/pause, reset or skip,
 * +5 min, and the display settings (brightness, ink colour, clock size, and
 * the phase label). Every lit pixel, controls included, goes through one
 * brightness setting, so the whole screen dims together and can be taken
 * down to a faint glow. Settings stay on this device.
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

import {
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { displaySeconds, usePomo } from "@/hooks/PomoContext";
import { useFocusGoal } from "@/hooks/useFocusGoal";
import { describeRing } from "@/lib/timerRing";
import { cn, formatClock } from "@/lib/utils";
import {
  FaForwardFast,
  FaMinus,
  FaPause,
  FaPlay,
  FaPlus,
  FaRotateLeft,
  FaXmark,
} from "react-icons/fa6";

/** How far, in pixels, the clock may drift from centre. */
const DRIFT_PX = 6;
/** How often the clock moves to a new spot. */
const DRIFT_INTERVAL_MS = 60_000;
/** Two taps closer together than this (and this close) count as a double-tap. */
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_SLOP_PX = 40;
/** The controls tuck themselves away after this long untouched. */
const PANEL_IDLE_MS = 8_000;
/** How long the "double-tap" hint shows after opening. */
const HINT_MS = 4_000;
/**
 * The controls never fall below this ink level, so they can always be found
 * to turn the brightness back up. Still a faint grey on black.
 */
const PANEL_MIN_INK = 0.22;

const PREFS_KEY = "landscapeTimerPrefs";

const TINTS = {
  white: { label: "White", color: "#ffffff" },
  amber: { label: "Amber", color: "#ffad33" },
  red: { label: "Red", color: "#ff2b1c" },
  phase: { label: "Phase", color: null },
} as const;
type Tint = keyof typeof TINTS;

/** Clock font size per setting: [long clock (h:mm:ss), short clock (mm:ss)]. */
const SIZES = {
  s: { label: "S", font: ["min(13cqw, 34cqh)", "min(18cqw, 40cqh)"] },
  m: { label: "M", font: ["min(17cqw, 44cqh)", "min(24cqw, 52cqh)"] },
  l: { label: "L", font: ["min(21cqw, 52cqh)", "min(30cqw, 62cqh)"] },
} as const;
type Size = keyof typeof SIZES;

interface Prefs {
  /** Brightness, 1–100. */
  level: number;
  tint: Tint;
  size: Size;
  showLabel: boolean;
}

const DEFAULT_PREFS: Prefs = { level: 90, tint: "white", size: "l", showLabel: true };

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return {
      level:
        typeof raw.level === "number" && raw.level >= 1 && raw.level <= 100
          ? Math.round(raw.level)
          : DEFAULT_PREFS.level,
      tint: raw.tint in TINTS ? raw.tint : DEFAULT_PREFS.tint,
      size: raw.size in SIZES ? raw.size : DEFAULT_PREFS.size,
      showLabel:
        typeof raw.showLabel === "boolean" ? raw.showLabel : DEFAULT_PREFS.showLabel,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Brightness level → ink opacity. Squared so the low end, where OLED dimming
 * matters most, gets most of the slider's travel: 10% is about 3% ink.
 */
function inkFor(level: number): number {
  const t = level / 100;
  return 0.02 + 0.98 * t * t;
}

/** Brightness steps finer near the bottom, where small changes show most. */
function stepLevel(level: number, direction: 1 | -1): number {
  const step = level + direction <= 10 ? 1 : 5;
  const next = direction > 0 ? Math.floor(level / step) * step + step : Math.ceil(level / step) * step - step;
  return Math.min(100, Math.max(1, next));
}

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export default function LandscapeTimer({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element | null {
  const { state, start, pause, reset, extend } = usePomo();
  const { goalMinutes } = useFocusGoal();
  const [mounted, setMounted] = useState(false);
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hint, setHint] = useState(true);
  // Bumped on every interaction with the controls to restart the idle timer.
  const [activity, setActivity] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstControlRef = useRef<HTMLButtonElement>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const focusPanelOnOpen = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  // Fullscreen + landscape lock, both best effort. Leaving fullscreen through
  // the system back gesture closes the timer too.
  useEffect(() => {
    setMounted(true);
    setPrefs(readPrefs());
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

  // Persist display settings on this device.
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [mounted, prefs]);

  useEffect(() => {
    if (!mounted) return;
    rootRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (panelOpenRef.current) setPanelOpen(false);
      else onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDrift({
        x: Math.round((Math.random() * 2 - 1) * DRIFT_PX),
        y: Math.round((Math.random() * 2 - 1) * DRIFT_PX),
      });
    }, DRIFT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setHint(false), HINT_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Controls hide themselves once left alone, returning the screen to black.
  useEffect(() => {
    if (!panelOpen) return;
    const id = window.setTimeout(() => setPanelOpen(false), PANEL_IDLE_MS);
    return () => window.clearTimeout(id);
  }, [panelOpen, activity]);

  useEffect(() => {
    if (!panelOpen) {
      // Keep keyboard focus inside the dialog once the controls disappear.
      if (!rootRef.current?.contains(document.activeElement)) rootRef.current?.focus();
      return;
    }
    setHint(false);
    if (focusPanelOnOpen.current) firstControlRef.current?.focus();
    focusPanelOnOpen.current = false;
  }, [panelOpen]);

  if (!mounted) return null;

  const hasElapsed = state.startTime !== null || state.elapsedSeconds > 0;
  const isBreak = state.mode === "pomodoro" && state.phase === "break";
  const ring = describeRing(state, goalMinutes, hasElapsed);
  const clock = formatClock(displaySeconds(state));
  const label = state.isRunning ? ring.label : hasElapsed ? "Paused" : ring.label;
  const ink = inkFor(prefs.level);
  const inkColor = TINTS[prefs.tint].color ?? ring.color;
  const update = (patch: Partial<Prefs>) => setPrefs((current) => ({ ...current, ...patch }));
  const touch = () => setActivity((n) => n + 1);

  const onPointerUp = (event: ReactPointerEvent) => {
    if (panelRef.current?.contains(event.target as Node)) return;
    if (panelOpenRef.current) {
      // A tap on the clock while the controls are up puts them away.
      setPanelOpen(false);
      lastTap.current = null;
      return;
    }
    const prev = lastTap.current;
    if (
      prev &&
      event.timeStamp - prev.t < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < DOUBLE_TAP_SLOP_PX
    ) {
      lastTap.current = null;
      setPanelOpen(true);
    } else {
      lastTap.current = { t: event.timeStamp, x: event.clientX, y: event.clientY };
    }
  };

  const onRootKeyDown = (event: ReactKeyboardEvent) => {
    if (event.target !== rootRef.current) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusPanelOnOpen.current = true;
      setPanelOpen(true);
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Landscape timer"
      aria-describedby="landscape-timer-help"
      tabIndex={-1}
      onPointerUp={onPointerUp}
      onKeyDown={onRootKeyDown}
      className="fixed inset-0 z-[100] touch-manipulation overflow-hidden bg-black text-white outline-none select-none"
    >
      <p id="landscape-timer-help" className="sr-only">
        Double-tap or press Enter for controls. Press Escape to close.
      </p>
      {/* The landscape frame. Held upright, it turns a quarter so its top
          edge runs along the phone's right side. */}
      <div className="absolute top-1/2 left-1/2 flex h-dvh w-dvw -translate-x-1/2 -translate-y-1/2 flex-col portrait:h-dvw portrait:w-dvh portrait:rotate-90">
        {/* The clock gets whatever height the controls leave free. */}
        <div className="relative min-h-0 flex-1" style={{ containerType: "size" }}>
          <div
            className="flex size-full flex-col items-center justify-center transition-transform duration-[2000ms] ease-in-out motion-reduce:transition-none"
            style={{
              transform: `translate(${drift.x}px, ${drift.y}px)`,
              opacity: ink,
              color: inkColor,
            }}
          >
            {prefs.showLabel && (
              <span
                className="flex items-center gap-2 text-[max(11px,2.6cqh)] font-medium uppercase tracking-[0.24em] transition-opacity duration-700"
                style={{ opacity: state.isRunning ? 0.75 : 0.45 }}
              >
                {state.isRunning && (
                  <span className="size-[0.55em] rounded-full bg-current motion-safe:animate-pulse" />
                )}
                {label}
              </span>
            )}

            <span
              role="timer"
              aria-live="off"
              className={cn(
                "font-mono font-semibold leading-none tracking-tighter tabular-nums transition-opacity duration-500",
                prefs.showLabel && "mt-[1.5cqh]",
                !state.isRunning && "opacity-40"
              )}
              style={{ fontSize: SIZES[prefs.size].font[clock.length > 5 ? 0 : 1] }}
            >
              {clock}
            </span>
          </div>

          {hint && !panelOpen && (
            <p
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs tracking-wide text-white motion-safe:animate-in motion-safe:fade-in"
              style={{ opacity: Math.max(ink, PANEL_MIN_INK) * 0.6 }}
            >
              Double-tap for controls
            </p>
          )}
        </div>

        {panelOpen && (
          <div
            ref={panelRef}
            role="group"
            aria-label="Timer controls"
            onPointerDown={touch}
            onInput={touch}
            onKeyDown={touch}
            className="shrink-0 border-t border-white/20 bg-black px-[max(1rem,env(safe-area-inset-left))] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            style={{ opacity: Math.max(ink, PANEL_MIN_INK) }}
          >
            {/* Session controls */}
            <div className="flex items-center gap-2">
              <OledButton
                ref={firstControlRef}
                onClick={state.isRunning ? pause : start}
                label={state.isRunning ? "Pause" : hasElapsed ? "Resume" : "Start"}
                icon={state.isRunning ? <FaPause /> : <FaPlay />}
                className="min-w-28"
                strong
              />
              {(hasElapsed || isBreak) && (
                <OledButton
                  onClick={reset}
                  label={isBreak ? "Skip" : "Reset"}
                  title={isBreak ? "Skip the break" : "Reset the timer"}
                  icon={isBreak ? <FaForwardFast /> : <FaRotateLeft />}
                />
              )}
              {state.mode === "pomodoro" && hasElapsed && (
                <OledButton
                  onClick={() => extend()}
                  label="5 min"
                  title={`Add 5 minutes to this ${isBreak ? "break" : "focus block"}`}
                  icon={<FaPlus />}
                />
              )}
              <OledButton
                onClick={onClose}
                label="Exit"
                title="Close landscape timer"
                icon={<FaXmark />}
                className="ml-auto"
              />
            </div>

            {/* Display settings */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2.5">
              <div className="flex min-w-56 flex-1 items-center gap-2">
                <OledIconButton
                  label="Dimmer"
                  disabled={prefs.level <= 1}
                  onClick={() => update({ level: stepLevel(prefs.level, -1) })}
                >
                  <FaMinus />
                </OledIconButton>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={prefs.level}
                  aria-label="Brightness"
                  aria-valuetext={`${prefs.level}%`}
                  onChange={(event) => update({ level: Number(event.target.value) })}
                  className="h-10 min-w-0 flex-1 cursor-pointer"
                  style={{ accentColor: "#ffffff" }}
                />
                <OledIconButton
                  label="Brighter"
                  disabled={prefs.level >= 100}
                  onClick={() => update({ level: stepLevel(prefs.level, 1) })}
                >
                  <FaPlus />
                </OledIconButton>
                <span className="w-10 text-right font-mono text-xs tabular-nums text-white/70">
                  {prefs.level}%
                </span>
              </div>

              <Segmented label="Colour">
                {(Object.keys(TINTS) as Tint[]).map((tint) => (
                  <SegmentButton
                    key={tint}
                    active={prefs.tint === tint}
                    onClick={() => update({ tint })}
                    title={`${TINTS[tint].label} digits`}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: TINTS[tint].color ?? ring.color }}
                    />
                    {TINTS[tint].label}
                  </SegmentButton>
                ))}
              </Segmented>

              <Segmented label="Size">
                {(Object.keys(SIZES) as Size[]).map((size) => (
                  <SegmentButton
                    key={size}
                    active={prefs.size === size}
                    onClick={() => update({ size })}
                    title={`${{ s: "Small", m: "Medium", l: "Large" }[size]} clock`}
                  >
                    {SIZES[size].label}
                  </SegmentButton>
                ))}
              </Segmented>

              <SegmentButton
                active={prefs.showLabel}
                onClick={() => update({ showLabel: !prefs.showLabel })}
                title={prefs.showLabel ? "Hide the phase label" : "Show the phase label"}
              >
                Label
              </SegmentButton>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── OLED controls ─────────────────────────────────────────────────────────────
// Outlines only, no filled surfaces: on black, a lit fill is the brightest
// thing on screen. Active states use a thin brighter border and a faint wash.

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

function OledButton({
  ref,
  onClick,
  label,
  title,
  icon,
  strong,
  className,
}: {
  ref?: Ref<HTMLButtonElement>;
  onClick: () => void;
  label: string;
  title?: string;
  icon: ReactNode;
  strong?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors active:bg-white/10 [&>svg]:size-3.5",
        strong ? "border-white/70 text-white" : "border-white/25 text-white/80",
        focusRing,
        className
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function OledIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border border-white/25 text-white/80 active:bg-white/10 disabled:opacity-30 [&>svg]:size-3",
        focusRing
      )}
    >
      {children}
    </button>
  );
}

function Segmented({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {children}
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors active:bg-white/10",
        active ? "border-white/70 bg-white/[0.07] text-white" : "border-white/15 text-white/60",
        focusRing
      )}
    >
      {children}
    </button>
  );
}
