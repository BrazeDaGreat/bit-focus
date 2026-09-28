"use client";

/**
 * Pomodoro Settings
 *
 * Focus, break and long-break durations for Pomodoro mode, how many focus
 * blocks make a cycle, and whether phases start on their own. Presets cover
 * the common rhythms; the steppers below adjust any value directly, which
 * switches the selection to Custom.
 *
 * Timer mode is not set here — it lives in the focus page control dock, next to
 * the timer it changes.
 */

import { useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  cyclePosition,
  usePomo,
  type PomodoroSettings,
} from "@/hooks/PomoContext";
import { usePreferences } from "@/hooks/usePreferences";
import { FaCoffee } from "react-icons/fa";
import { FaMinus, FaPlus, FaMugHot, FaRepeat } from "react-icons/fa6";
import { GiTomato } from "react-icons/gi";
import { cn } from "@/lib/utils";

interface PomodoroPreset {
  name: string;
  settings: Omit<PomodoroSettings, "longBreakInterval">;
}

const POMODORO_PRESETS: PomodoroPreset[] = [
  { name: "Classic", settings: { focusDuration: 25, breakDuration: 5, longBreakDuration: 15 } },
  { name: "Short", settings: { focusDuration: 15, breakDuration: 3, longBreakDuration: 10 } },
  { name: "Long", settings: { focusDuration: 50, breakDuration: 10, longBreakDuration: 30 } },
];

interface Limits {
  min: number;
  max: number;
  step: number;
}

const LIMITS: Record<keyof PomodoroSettings, Limits> = {
  focusDuration: { min: 1, max: 180, step: 5 },
  breakDuration: { min: 1, max: 60, step: 5 },
  longBreakDuration: { min: 1, max: 120, step: 5 },
  longBreakInterval: { min: 2, max: 8, step: 1 },
};

interface PomodoroSettingsProps {
  className?: string;
}

/** "90m" under two hours, "2h 10m" above. */
function humanMinutes(minutes: number): string {
  if (minutes < 120) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export default function PomodoroSettings({
  className,
}: PomodoroSettingsProps): JSX.Element {
  const { state, setPomodoroSettings, resetCycle } = usePomo();
  const settings = state.pomodoroSettings;
  const { autoStartBreaks, autoStartFocus, setPreference } = usePreferences();

  // Local echo of the input so typing feels immediate; the store is the source
  // of truth for what the timer actually runs.
  const [draft, setDraft] = useState<PomodoroSettings>(settings);

  const activePreset = POMODORO_PRESETS.find(
    (p) =>
      p.settings.focusDuration === draft.focusDuration &&
      p.settings.breakDuration === draft.breakDuration &&
      p.settings.longBreakDuration === draft.longBreakDuration
  );

  const apply = (next: PomodoroSettings) => {
    setDraft(next);
    setPomodoroSettings(next);
  };

  const step = (field: keyof PomodoroSettings, direction: 1 | -1) => {
    const limits = LIMITS[field];
    const value = Math.min(
      limits.max,
      Math.max(limits.min, draft[field] + direction * limits.step)
    );
    apply({ ...draft, [field]: value });
  };

  const interval = draft.longBreakInterval;
  const cycleMinutes =
    interval * draft.focusDuration +
    (interval - 1) * draft.breakDuration +
    draft.longBreakDuration;
  const position = cyclePosition(state);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* ── Presets ── */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Preset
        </p>
        <div className="flex items-center gap-0.5 rounded-xl bg-muted/60 p-1">
          {POMODORO_PRESETS.map((preset) => {
            const active = activePreset?.name === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => apply({ ...draft, ...preset.settings })}
                aria-pressed={active}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-2 transition-colors",
                  active
                    ? "bg-background shadow-xs"
                    : "hover:bg-background/60"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {preset.name}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {preset.settings.focusDuration}/{preset.settings.breakDuration}
                </span>
              </button>
            );
          })}
          <div
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-2",
              !activePreset && "bg-background shadow-xs"
            )}
          >
            <span
              className={cn(
                "text-xs font-medium",
                !activePreset ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Custom
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {activePreset ? "—" : `${draft.focusDuration}/${draft.breakDuration}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── Durations ── */}
      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Focus"
          icon={<GiTomato className="size-3.5 text-red-500" />}
          value={draft.focusDuration}
          unit="min"
          limits={LIMITS.focusDuration}
          onStep={(d) => step("focusDuration", d)}
        />
        <Stepper
          label="Break"
          icon={<FaCoffee className="size-3.5 text-amber-600" />}
          value={draft.breakDuration}
          unit="min"
          limits={LIMITS.breakDuration}
          onStep={(d) => step("breakDuration", d)}
        />
        <Stepper
          label="Long break"
          icon={<FaMugHot className="size-3.5 text-amber-700" />}
          value={draft.longBreakDuration}
          unit="min"
          limits={LIMITS.longBreakDuration}
          onStep={(d) => step("longBreakDuration", d)}
        />
        <Stepper
          label="Long break after"
          icon={<FaRepeat className="size-3.5 text-muted-foreground" />}
          value={draft.longBreakInterval}
          unit="blocks"
          limits={LIMITS.longBreakInterval}
          onStep={(d) => step("longBreakInterval", d)}
        />
      </div>

      {/* ── What one cycle looks like ── */}
      <div className="rounded-xl bg-muted/40 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            One cycle
          </p>
          {state.mode === "pomodoro" && state.completedPomodoros > 0 && (
            <button
              type="button"
              onClick={resetCycle}
              className="text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              title="Count the next focus block as the first of a new cycle"
            >
              On {position.current}/{position.total} · Start over
            </button>
          )}
        </div>
        <div className="mt-2.5 flex h-2 gap-0.5 overflow-hidden rounded-full">
          {Array.from({ length: interval }, (_, i) => (
            <CycleSegments
              key={i}
              focus={draft.focusDuration}
              rest={i === interval - 1 ? draft.longBreakDuration : draft.breakDuration}
              long={i === interval - 1}
            />
          ))}
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{interval}</span> ×{" "}
          <span className="font-mono text-foreground">
            {draft.focusDuration}m
          </span>{" "}
          focus with{" "}
          <span className="font-mono text-foreground">
            {draft.breakDuration}m
          </span>{" "}
          breaks, then a{" "}
          <span className="font-mono text-foreground">
            {draft.longBreakDuration}m
          </span>{" "}
          long break — {humanMinutes(cycleMinutes)} per cycle.
        </p>
      </div>

      {/* ── Auto-start ── */}
      <div className="flex flex-col gap-1">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          When a phase ends
        </p>
        <ToggleRow
          id="pomo-auto-breaks"
          label="Start breaks automatically"
          checked={autoStartBreaks}
          onChange={(v) => setPreference("autoStartBreaks", v)}
        />
        <ToggleRow
          id="pomo-auto-focus"
          label="Start the next focus block automatically"
          checked={autoStartFocus}
          onChange={(v) => setPreference("autoStartFocus", v)}
        />
      </div>
    </div>
  );
}

/** Focus then rest, sized by minutes, for one block of the cycle bar. */
function CycleSegments({
  focus,
  rest,
  long,
}: {
  focus: number;
  rest: number;
  long: boolean;
}): JSX.Element {
  return (
    <>
      <div
        className="rounded-[1px] bg-primary transition-[flex-grow] duration-300"
        style={{ flexGrow: focus }}
      />
      <div
        className="rounded-[1px] transition-[flex-grow] duration-300"
        style={{
          flexGrow: rest,
          backgroundColor: "var(--chart-2)",
          opacity: long ? 1 : 0.55,
        }}
      />
    </>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 md:min-h-9">
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal md:text-xs">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Stepper({
  label,
  icon,
  value,
  unit,
  limits,
  onStep,
}: {
  label: string;
  icon: JSX.Element;
  value: number;
  unit: string;
  limits: Limits;
  onStep: (direction: 1 | -1) => void;
}): JSX.Element {
  const amount = limits.step === 1 ? `by 1` : `by ${limits.step} minutes`;
  return (
    <div className="rounded-xl border p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StepButton
          onClick={() => onStep(-1)}
          disabled={value <= limits.min}
          title={`Decrease ${label.toLowerCase()} ${amount}`}
        >
          <FaMinus className="size-2.5" />
        </StepButton>
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {value}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {unit}
          </span>
        </span>
        <StepButton
          onClick={() => onStep(1)}
          disabled={value >= limits.max}
          title={`Increase ${label.toLowerCase()} ${amount}`}
        >
          <FaPlus className="size-2.5" />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="size-8 shrink-0 rounded-lg bg-muted/60 hover:bg-muted"
    >
      {children}
    </Button>
  );
}
