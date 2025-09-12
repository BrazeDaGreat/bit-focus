/**
 * Pomodoro Settings Component - Timer Mode Selection and Configuration
 * 
 * This component provides an interface for selecting between standard and Pomodoro
 * timer modes, and configuring Pomodoro-specific settings like focus and break
 * durations. It includes preset options for common Pomodoro configurations and
 * allows for custom duration settings.
 * 
 * Features:
 * - Timer mode selection (Standard vs Pomodoro)
 * - Configurable focus and break durations
 * - Preset Pomodoro configurations (Classic, Short, Long)
 * - Real-time settings updates
 * - Accessible form controls with proper labels
 * - Responsive design for mobile and desktop
 * 
 * Dependencies:
 * - Enhanced PomoContext for timer state management
 * - shadcn/ui components for consistent styling
 * - Form validation and user input handling
 * 
 * @fileoverview Pomodoro timer configuration interface
 * @author BIT Focus Development Team
 * @since v0.12.0-beta
 */

"use client";
import { useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { usePomo, type TimerMode, type PomodoroSettings } from "@/hooks/PomoContext";
import { FaCoffee } from "react-icons/fa";
import { GiTomato } from "react-icons/gi";
import { cn } from "@/lib/utils";

/**
 * Pomodoro Preset Configuration Interface
 * Defines common Pomodoro timer configurations
 */
interface PomodoroPreset {
  /** Display name for the preset */
  name: string;
  /** Description of the preset */
  description: string;
  /** Preset configuration values */
  settings: PomodoroSettings;
}

/**
 * Common Pomodoro Presets
 * Pre-configured timer durations for different use cases
 */
const POMODORO_PRESETS: PomodoroPreset[] = [
  {
    name: "Classic",
    description: "Traditional 25/5 minute cycle",
    settings: { focusDuration: 25, breakDuration: 5 },
  },
  {
    name: "Short",
    description: "Quick 15/3 minute sessions",
    settings: { focusDuration: 15, breakDuration: 3 },
  },
  {
    name: "Long",
    description: "Deep focus 50/10 minute cycle",
    settings: { focusDuration: 50, breakDuration: 10 },
  },
  {
    name: "Custom",
    description: "Set your own durations",
    settings: { focusDuration: 25, breakDuration: 5 },
  },
];

/**
 * Pomodoro Settings Component Props
 * Configuration options for the settings component
 */
interface PomodoroSettingsProps {
  /** Additional CSS classes for styling */
  className?: string;
  /** Whether to show the component in compact mode */
  compact?: boolean;
}

/**
 * Pomodoro Settings Component
 * 
 * Renders the complete configuration interface for timer modes and Pomodoro
 * settings. Handles mode switching, preset selection, and custom duration
 * configuration with real-time updates to the timer context.
 * 
 * @param props - Component configuration options
 * @returns JSX element containing the settings interface
 */
export default function PomodoroSettings({ className, compact = false }: PomodoroSettingsProps): JSX.Element {
  const { state, setMode, setPomodoroSettings } = usePomo();
  const [selectedPreset, setSelectedPreset] = useState<string>("Classic");
  const [customSettings, setCustomSettings] = useState<PomodoroSettings>(state.pomodoroSettings);

  /**
   * Handles timer mode changes
   * Updates the timer context with the selected mode
   * 
   * @param mode - The selected timer mode
   */
  const handleModeChange = (mode: TimerMode) => {
    setMode(mode);
  };

  /**
   * Handles preset selection
   * Updates both local state and timer context with preset values
   * 
   * @param presetName - Name of the selected preset
   */
  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = POMODORO_PRESETS.find(p => p.name === presetName);
    if (preset && presetName !== "Custom") {
      setCustomSettings(preset.settings);
      setPomodoroSettings(preset.settings);
    }
  };

  /**
   * Handles custom duration updates
   * Validates input and updates timer settings
   * 
   * @param field - The setting field to update
   * @param value - The new duration value in minutes
   */
  const handleCustomSettingChange = (field: keyof PomodoroSettings, value: number) => {
    if (value < 1 || value > 180) return; // Reasonable limits: 1-180 minutes
    
    const newSettings = { ...customSettings, [field]: value };
    setCustomSettings(newSettings);
    
    if (selectedPreset === "Custom") {
      setPomodoroSettings(newSettings);
    }
  };

  /**
   * Applies custom settings to timer
   * Updates the timer context with current custom values
   */
  const applyCustomSettings = () => {
    setPomodoroSettings(customSettings);
    setSelectedPreset("Custom");
  };

  if (compact) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Mode:</Label>
          <RadioGroup
            value={state.mode}
            onValueChange={handleModeChange}
            className="flex items-center gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="standard" id="standard-compact" />
              <Label htmlFor="standard-compact" className="text-sm">Standard</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pomodoro" id="pomodoro-compact" />
              <Label htmlFor="pomodoro-compact" className="text-sm">Pomodoro</Label>
            </div>
          </RadioGroup>
        </div>
        
        {state.mode === "pomodoro" && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <GiTomato className="w-3 h-3" />
              {state.pomodoroSettings.focusDuration}min
            </span>
            <span className="flex items-center gap-1">
              <FaCoffee className="w-3 h-3" />
              {state.pomodoroSettings.breakDuration}min
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardContent className="space-y-6">
        {/* Timer Mode Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Timer Mode</Label>
            <div className={cn("flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 transition-all cursor-pointer", state.mode === "standard" ? "shadow-lg bg-white/20 hover:bg-white/30" : "")} onClick={() => handleModeChange("standard")}>
              <div className="flex-1">
                <Label htmlFor="standard" className="font-semibold cursor-pointer">
                  Standard Timer
                </Label>
                <p className="text-sm text-muted-foreground">
                  Traditional stopwatch mode.
                </p>
              </div>
            </div>
            
            <div className={cn("flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 transition-all cursor-pointer", state.mode !== "standard" ? "shadow-lg bg-white/20 hover:bg-white/30" : "")} onClick={() => handleModeChange("pomodoro")}>
              <div className="flex-1">
                <Label htmlFor="pomodoro" className="font-semibold cursor-pointer">
                  Pomodoro Timer
                </Label>
                <p className="text-sm text-muted-foreground">
                  Count down focus timer.
                </p>
              </div>
            </div>
        </div>

        {/* Pomodoro Configuration */}
        {(
          <>
            <Separator />
            
            <div className={cn("space-y-4 max-h-0 overflow-hidden transition-all", state.mode === "pomodoro" ? "max-h-128" : "")}>
              <Label className="text-base font-medium">Pomodoro Configuration</Label>
              
              {/* Presets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {POMODORO_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant={selectedPreset === preset.name ? "default" : "outline"}
                    className="h-auto p-3 flex flex-col items-start text-left"
                    onClick={() => handlePresetChange(preset.name)}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {preset.description}
                    </div>
                    {preset.name !== "Custom" && (
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <span className="flex items-center gap-1">
                          <GiTomato className="w-3 h-3" />
                          {preset.settings.focusDuration}m
                        </span>
                        <span className="flex items-center gap-1">
                          <FaCoffee className="w-3 h-3" />
                          {preset.settings.breakDuration}m
                        </span>
                      </div>
                    )}
                  </Button>
                ))}
              </div>

              {/* Custom Settings */}
              {(
                <div className={cn("space-y-4 border rounded-lg bg-accent/20 max-h-0 overflow-hidden transition-all", selectedPreset === "Custom" ? "p-4 max-h-64" : "")}>
                  <Label className="text-sm font-medium">Custom Durations</Label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="focus-duration" className="text-sm flex items-center gap-1">
                        <GiTomato className="w-3 h-3" />
                        Focus Duration (minutes)
                      </Label>
                      <Input
                        id="focus-duration"
                        type="number"
                        min="1"
                        max="180"
                        value={customSettings.focusDuration}
                        onChange={(e) => handleCustomSettingChange("focusDuration", Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="break-duration" className="text-sm flex items-center gap-1">
                        <FaCoffee className="w-3 h-3" />
                        Break Duration (minutes)
                      </Label>
                      <Input
                        id="break-duration"
                        type="number"
                        min="1"
                        max="60"
                        value={customSettings.breakDuration}
                        onChange={(e) => handleCustomSettingChange("breakDuration", Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <Button onClick={applyCustomSettings} className="w-full sm:w-auto">
                    Apply Custom Settings
                  </Button>
                </div>
              )}

              {/* Current Configuration Display */}
              <div className="flex items-center justify-center gap-6 p-4 bg-accent/10 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold">
                    <GiTomato className="w-4 h-4 text-red-500" />
                    {state.pomodoroSettings.focusDuration}
                  </div>
                  <div className="text-xs text-muted-foreground">Focus</div>
                </div>
                
                <div className="w-px h-8 bg-border" />
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold">
                    <FaCoffee className="w-4 h-4 text-amber-600" />
                    {state.pomodoroSettings.breakDuration}
                  </div>
                  <div className="text-xs text-muted-foreground">Break</div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}