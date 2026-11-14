"use client";

/**
 * Pomodoro Settings
 *
 * Focus, break and long-break durations for Pomodoro mode, how many focus
 * blocks make a cycle, and whether phases start on their own. Presets cover
 * the common rhythms; the steppers below adjust any value directly, which
 * switches the selection to Custom. Steps move along a 5-minute grid, and
 * clicking a value lets you type any number within its limits.
 *
 * Timer mode is not set here — it lives in the focus page control dock, next to
 * the timer it changes.
 */

import { useRef, useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Group, Row, Well } from "@/components/settings/parts";
import {
  cyclePosition,
  usePomoStatus,
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
  const { state, setPomodoroSettings, resetCycle } = usePomoStatus();
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

  const set = (field: keyof PomodoroSettings, value: number) => {
    const { min, max } = LIMITS[field];
    apply({ ...draft, [field]: Math.min(max, Math.max(min, Math.round(value))) });
  };

  // Steps land on the step grid, so a typed 7 goes to 10 or 5, and the
  // minimum of 1 climbs back to 5 rather than 6.
  const step = (field: keyof PomodoroSettings, direction: 1 | -1) => {
    const size = LIMITS[field].step;
    const current = draft[field];
    set(
      field,
      direction > 0
        ? Math.floor(current / size) * size + size
        : Math.ceil(current / size) * size - size
    );
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
        <div role="group" aria-label="Preset" className="flex items-center gap-0.5 rounded-xl bg-muted/60 p-1">
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
          icon={<GiTomato className="size-3.5 text-primary" />}
          value={draft.focusDuration}
          unit="min"
          limits={LIMITS.focusDuration}
          onStep={(d) => step("focusDuration", d)}
          onSet={(v) => set("focusDuration", v)}
        />
        <Stepper
          label="Break"
          icon={<FaCoffee className="size-3.5 text-(--chart-2)" />}
          value={draft.breakDuration}
          unit="min"
          limits={LIMITS.breakDuration}
          onStep={(d) => step("breakDuration", d)}
          onSet={(v) => set("breakDuration", v)}
        />
        <Stepper
          label="Long break"
          icon={<FaMugHot className="size-3.5 text-(--chart-2)" />}
          value={draft.longBreakDuration}
          unit="min"
          limits={LIMITS.longBreakDuration}
          onStep={(d) => step("longBreakDuration", d)}
          onSet={(v) => set("longBreakDuration", v)}
        />
        <Stepper
          label="Long break after"
          icon={<FaRepeat className="size-3.5 text-muted-foreground" />}
          value={draft.longBreakInterval}
          unit="blocks"
          limits={LIMITS.longBreakInterval}
          onStep={(d) => step("longBreakInterval", d)}
          onSet={(v) => set("longBreakInterval", v)}
        />
      </div>

      {/* ── What one cycle looks like ── */}
      <div className="rounded-xl bg-muted/40 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">One cycle</p>
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
      <Group title="When a phase ends">
        <Well>
          <Row id="pomo-auto-breaks" label="Start breaks automatically">
            <Switch id="pomo-auto-breaks" checked={autoStartBreaks} onCheckedChange={(v) => setPreference("autoStartBreaks", v)} />
          </Row>
          <Row id="pomo-auto-focus" label="Start the next focus block automatically">
            <Switch id="pomo-auto-focus" checked={autoStartFocus} onCheckedChange={(v) => setPreference("autoStartFocus", v)} />
          </Row>
        </Well>
      </Group>
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

function Stepper({
  label,
  icon,
  value,
  unit,
  limits,
  onStep,
  onSet,
}: {
  label: string;
  icon: JSX.Element;
  value: number;
  unit: string;
  limits: Limits;
  onStep: (direction: 1 | -1) => void;
  onSet: (value: number) => void;
}): JSX.Element {
  const amount = limits.step === 1 ? `by 1` : `by ${limits.step} minutes`;
  const [text, setText] = useState<string | null>(null);
  // Set while an edit closes, so a blur from the input unmounting doesn't save it again.
  const closing = useRef(false);

  const startEdit = () => {
    closing.current = false;
    setText(String(value));
  };

  const commit = () => {
    if (closing.current) return;
    closing.current = true;
    const typed = Number(text);
    if (text !== null && text.trim() !== "" && Number.isFinite(typed)) onSet(typed);
    setText(null);
  };

  return (
    <div className="min-w-0 rounded-xl bg-muted/60 p-2.5 sm:p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="mt-2 flex items-center justify-between gap-1">
        <StepButton
          onClick={() => onStep(-1)}
          disabled={value <= limits.min}
          title={`Decrease ${label.toLowerCase()} ${amount}`}
        >
          <FaMinus className="size-2.5" />
        </StepButton>
        {text === null ? (
          <button
            type="button"
            onClick={startEdit}
            title={`Type a ${label.toLowerCase()} value`}
            aria-label={`${label}: ${value} ${unit}. Type a value`}
            className="min-w-0 cursor-text rounded-lg px-1.5 py-0.5 font-mono text-2xl font-semibold tabular-nums outline-none transition-colors duration-150 hover:bg-background/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {value}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {unit}
            </span>
          </button>
        ) : (
          <span className="flex min-w-0 items-baseline">
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={limits.min}
              max={limits.max}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                else if (e.key === "Escape") {
                  // Cancel the edit without closing the dialog around it.
                  e.preventDefault();
                  e.stopPropagation();
                  closing.current = true;
                  setText(null);
                }
              }}
              aria-label={`${label} in ${unit}, ${limits.min} to ${limits.max}`}
              className="w-14 min-w-0 rounded-lg bg-background px-1 py-0.5 text-center font-mono text-2xl font-semibold tabular-nums shadow-xs outline-none ring-[3px] ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="ml-1 font-mono text-sm text-muted-foreground">{unit}</span>
          </span>
        )}
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
      className="size-7 shrink-0 rounded-lg bg-background shadow-xs hover:bg-background/70 sm:size-8"
    >
      {children}
    </Button>
  );
}
