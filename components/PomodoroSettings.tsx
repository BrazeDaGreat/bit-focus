"use client";

/**
 * Pomodoro Settings
 *
 * Focus and break durations for Pomodoro mode. Presets cover the common
 * rhythms; the steppers below adjust either side directly, which switches the
 * selection to Custom.
 *
 * Timer mode is not set here — it lives in the focus page control dock, next to
 * the timer it changes.
 */

import { useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { usePomo, type PomodoroSettings } from "@/hooks/PomoContext";
import { FaCoffee } from "react-icons/fa";
import { FaMinus, FaPlus } from "react-icons/fa6";
import { GiTomato } from "react-icons/gi";
import { cn } from "@/lib/utils";

interface PomodoroPreset {
  name: string;
  settings: PomodoroSettings;
}

const POMODORO_PRESETS: PomodoroPreset[] = [
  { name: "Classic", settings: { focusDuration: 25, breakDuration: 5 } },
  { name: "Short", settings: { focusDuration: 15, breakDuration: 3 } },
  { name: "Long", settings: { focusDuration: 50, breakDuration: 10 } },
];

const FOCUS_LIMITS = { min: 1, max: 180 };
const BREAK_LIMITS = { min: 1, max: 60 };

interface PomodoroSettingsProps {
  className?: string;
}

export default function PomodoroSettings({
  className,
}: PomodoroSettingsProps): JSX.Element {
  const { state, setPomodoroSettings } = usePomo();
  const settings = state.pomodoroSettings;

  // Local echo of the input so typing feels immediate; the store is the source
  // of truth for what the timer actually runs.
  const [draft, setDraft] = useState<PomodoroSettings>(settings);

  const activePreset = POMODORO_PRESETS.find(
    (p) =>
      p.settings.focusDuration === draft.focusDuration &&
      p.settings.breakDuration === draft.breakDuration
  );

  const apply = (next: PomodoroSettings) => {
    setDraft(next);
    setPomodoroSettings(next);
  };

  const step = (field: keyof PomodoroSettings, delta: number) => {
    const limits = field === "focusDuration" ? FOCUS_LIMITS : BREAK_LIMITS;
    const value = Math.min(
      limits.max,
      Math.max(limits.min, draft[field] + delta)
    );
    apply({ ...draft, [field]: value });
  };

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
                onClick={() => apply(preset.settings)}
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
      <div className="grid gap-2 sm:grid-cols-2">
        <DurationStepper
          label="Focus"
          icon={<GiTomato className="size-3.5 text-red-500" />}
          value={draft.focusDuration}
          limits={FOCUS_LIMITS}
          onStep={(delta) => step("focusDuration", delta)}
        />
        <DurationStepper
          label="Break"
          icon={<FaCoffee className="size-3.5 text-amber-600" />}
          value={draft.breakDuration}
          limits={BREAK_LIMITS}
          onStep={(delta) => step("breakDuration", delta)}
        />
      </div>

      {/* ── What one cycle looks like ── */}
      <div className="rounded-xl bg-muted/40 p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          One cycle
        </p>
        <div className="mt-2.5 flex h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary transition-[flex-grow] duration-300"
            style={{ flexGrow: draft.focusDuration }}
          />
          <div className="w-0.5 shrink-0 bg-card" />
          <div
            className="transition-[flex-grow] duration-300"
            style={{
              flexGrow: draft.breakDuration,
              backgroundColor: "var(--chart-2)",
            }}
          />
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          <span className="font-mono text-foreground">
            {draft.focusDuration}m
          </span>{" "}
          focused, then{" "}
          <span className="font-mono text-foreground">
            {draft.breakDuration}m
          </span>{" "}
          off — {Math.round(draft.focusDuration + draft.breakDuration)}m per
          cycle.
        </p>
      </div>
    </div>
  );
}

function DurationStepper({
  label,
  icon,
  value,
  limits,
  onStep,
}: {
  label: string;
  icon: JSX.Element;
  value: number;
  limits: { min: number; max: number };
  onStep: (delta: number) => void;
}): JSX.Element {
  return (
    <div className="rounded-xl border p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StepButton
          onClick={() => onStep(-5)}
          disabled={value <= limits.min}
          title={`Decrease ${label.toLowerCase()} by 5 minutes`}
        >
          <FaMinus className="size-2.5" />
        </StepButton>
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {value}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            min
          </span>
        </span>
        <StepButton
          onClick={() => onStep(5)}
          disabled={value >= limits.max}
          title={`Increase ${label.toLowerCase()} by 5 minutes`}
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
