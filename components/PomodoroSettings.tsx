"use client";
import { useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { usePomo, type TimerMode, type PomodoroSettings } from "@/hooks/PomoContext";
import { FaCoffee } from "react-icons/fa";
import { GiTomato } from "react-icons/gi";
import { cn } from "@/lib/utils";

interface PomodoroPreset {
  name: string;
  description: string;
  settings: PomodoroSettings;
}

const POMODORO_PRESETS: PomodoroPreset[] = [
  {
    name: "Classic",
    description: "25 / 5",
    settings: { focusDuration: 25, breakDuration: 5 },
  },
  {
    name: "Short",
    description: "15 / 3",
    settings: { focusDuration: 15, breakDuration: 3 },
  },
  {
    name: "Long",
    description: "50 / 10",
    settings: { focusDuration: 50, breakDuration: 10 },
  },
  {
    name: "Custom",
    description: "Set your own",
    settings: { focusDuration: 25, breakDuration: 5 },
  },
];

interface PomodoroSettingsProps {
  className?: string;
  compact?: boolean;
}

export default function PomodoroSettings({ className, compact = false }: PomodoroSettingsProps): JSX.Element {
  const { state, setMode, setPomodoroSettings } = usePomo();
  const [selectedPreset, setSelectedPreset] = useState<string>("Classic");
  const [customSettings, setCustomSettings] = useState<PomodoroSettings>(state.pomodoroSettings);

  const handleModeChange = (mode: TimerMode) => {
    setMode(mode);
  };

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = POMODORO_PRESETS.find(p => p.name === presetName);
    if (preset && presetName !== "Custom") {
      setCustomSettings(preset.settings);
      setPomodoroSettings(preset.settings);
    }
  };

  const handleCustomSettingChange = (field: keyof PomodoroSettings, value: number) => {
    if (value < 1 || value > 180) return;
    const newSettings = { ...customSettings, [field]: value };
    setCustomSettings(newSettings);
    if (selectedPreset === "Custom") {
      setPomodoroSettings(newSettings);
    }
  };

  const applyCustomSettings = () => {
    setPomodoroSettings(customSettings);
    setSelectedPreset("Custom");
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className={cn("px-2 py-0.5 rounded-md font-medium", state.mode === "standard" ? "bg-accent text-foreground" : "text-muted-foreground")}>Standard</span>
          <span className={cn("px-2 py-0.5 rounded-md font-medium", state.mode === "pomodoro" ? "bg-accent text-foreground" : "text-muted-foreground")}>Pomodoro</span>
        </div>
        {state.mode === "pomodoro" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1">
              <GiTomato className="w-3 h-3 text-red-500" />
              {state.pomodoroSettings.focusDuration}m
            </span>
            <span className="flex items-center gap-1">
              <FaCoffee className="w-3 h-3 text-amber-600" />
              {state.pomodoroSettings.breakDuration}m
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      {/* Mode selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Timer Mode</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleModeChange("standard")}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all",
              state.mode === "standard"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:bg-accent/40"
            )}
          >
            <span className="text-xl">⏱</span>
            <span className="font-semibold text-sm">Standard</span>
            <span className="text-xs text-muted-foreground">Count up stopwatch</span>
          </button>
          <button
            onClick={() => handleModeChange("pomodoro")}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all",
              state.mode === "pomodoro"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:bg-accent/40"
            )}
          >
            <GiTomato className="w-5 h-5 text-red-500" />
            <span className="font-semibold text-sm">Pomodoro</span>
            <span className="text-xs text-muted-foreground">Count down timer</span>
          </button>
        </div>
      </div>

      {state.mode === "pomodoro" && (
        <>
          <Separator />

          {/* Presets */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Preset</p>
            <div className="grid grid-cols-2 gap-2">
              {POMODORO_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetChange(preset.name)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    selectedPreset === preset.name
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/40"
                  )}
                >
                  <div className="font-semibold text-sm">{preset.name}</div>
                  {preset.name !== "Custom" ? (
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <GiTomato className="w-3 h-3 text-red-500" />
                        {preset.settings.focusDuration}m
                      </span>
                      <span className="flex items-center gap-1">
                        <FaCoffee className="w-3 h-3 text-amber-600" />
                        {preset.settings.breakDuration}m
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1.5">{preset.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom duration inputs */}
          {selectedPreset === "Custom" && (
            <div className="rounded-xl border bg-accent/10 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Custom Durations</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="focus-duration" className="text-xs flex items-center gap-1 text-muted-foreground">
                    <GiTomato className="w-3 h-3 text-red-500" /> Focus (min)
                  </Label>
                  <Input
                    id="focus-duration"
                    type="number"
                    min="1"
                    max="180"
                    value={customSettings.focusDuration}
                    onChange={(e) => handleCustomSettingChange("focusDuration", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="break-duration" className="text-xs flex items-center gap-1 text-muted-foreground">
                    <FaCoffee className="w-3 h-3 text-amber-600" /> Break (min)
                  </Label>
                  <Input
                    id="break-duration"
                    type="number"
                    min="1"
                    max="60"
                    value={customSettings.breakDuration}
                    onChange={(e) => handleCustomSettingChange("breakDuration", Number(e.target.value))}
                  />
                </div>
              </div>
              <Button onClick={applyCustomSettings} size="sm" className="w-full">
                Apply
              </Button>
            </div>
          )}

          {/* Active config summary */}
          <div className="flex items-center justify-center gap-8 rounded-xl border bg-accent/10 p-4">
            <div className="text-center">
              <div className="text-2xl font-mono font-bold tabular-nums">
                {state.pomodoroSettings.focusDuration}
                <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-0.5">
                <GiTomato className="w-3 h-3 text-red-500" /> Focus
              </div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <div className="text-2xl font-mono font-bold tabular-nums">
                {state.pomodoroSettings.breakDuration}
                <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-0.5">
                <FaCoffee className="w-3 h-3 text-amber-600" /> Break
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
