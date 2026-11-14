"use client";

/**
 * Sound Settings
 *
 * Which sound plays when a Pomodoro focus block ends and when a break ends,
 * how loud, and whether it fades in. Each picker has a preview button that
 * plays the choice at the current volume. Dragging the volume plays the
 * focus-end sound on release so the level can be judged by ear.
 *
 * Renders its rows in a well but no panel or title — the Settings page owns
 * the framing.
 */

import { useRef, useState, type JSX } from "react";
import { FaPlay } from "react-icons/fa6";
import { Label } from "@/components/ui/label";
import { Row, Well } from "@/components/settings/parts";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePreferences } from "@/hooks/usePreferences";
import { isSoundPreset, playNotificationSound, SOUND_PRESETS, type SoundPreset } from "@/lib/sound";
import { cn } from "@/lib/utils";

const VOLUME_STEP = 5;

export default function SoundSettings(): JSX.Element {
  const focusEndSound = usePreferences((s) => s.focusEndSound);
  const breakEndSound = usePreferences((s) => s.breakEndSound);
  const soundVolume = usePreferences((s) => s.soundVolume);
  const gentleSound = usePreferences((s) => s.gentleSound);
  const setPreference = usePreferences((s) => s.setPreference);

  const preview = (preset: SoundPreset, volume = soundVolume) =>
    playNotificationSound(preset, { volume, gentle: gentleSound });

  return (
    <Well>
      <SoundRow
        id="sound-focus-end"
        label="Focus ends"
        color="var(--primary)"
        value={focusEndSound}
        volume={soundVolume}
        onChange={(v) => setPreference("focusEndSound", v)}
        onPreview={() => preview(focusEndSound)}
      />
      <SoundRow
        id="sound-break-end"
        label="Break ends"
        color="var(--chart-2)"
        value={breakEndSound}
        volume={soundVolume}
        onChange={(v) => setPreference("breakEndSound", v)}
        onPreview={() => preview(breakEndSound)}
      />
      <div className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-1.5">
        <span id="sound-volume-label" className="w-24 shrink-0 text-sm font-medium">
          Volume
        </span>
        <VolumeSlider
          value={soundVolume}
          onCommit={(v) => setPreference("soundVolume", v)}
          onRelease={(v) => {
            const audible = focusEndSound !== "none" ? focusEndSound : breakEndSound;
            preview(audible, v);
          }}
        />
      </div>
      <Row id="sound-gentle" label="Fade in gently" hint="Starts quiet and rises over a second, with one extra strike.">
        <Switch
          id="sound-gentle"
          checked={gentleSound}
          onCheckedChange={(v) => setPreference("gentleSound", v)}
        />
      </Row>
    </Well>
  );
}

function SoundRow({
  id,
  label,
  color,
  value,
  volume,
  onChange,
  onPreview,
}: {
  id: string;
  label: string;
  /** Phase colour of the phase that is ending. */
  color: string;
  value: SoundPreset;
  volume: number;
  onChange: (value: SoundPreset) => void;
  onPreview: () => void;
}): JSX.Element {
  const silent = value === "none" || volume === 0;
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-1.5">
      <Label htmlFor={id} className="flex w-24 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => isSoundPreset(v) && onChange(v)}>
        <SelectTrigger id={id} className="h-9 min-w-0 flex-1 rounded-lg bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOUND_PRESETS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={onPreview}
        disabled={silent}
        title={silent ? "Nothing to play" : `Play the ${label.toLowerCase()} sound`}
        aria-label={`Play the ${label.toLowerCase()} sound`}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs outline-none transition-colors duration-150 hover:bg-background/70 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
      >
        <FaPlay className="size-2.5" />
      </button>
    </div>
  );
}

/**
 * Pointer-draggable volume track. Shows the level while dragging and saves
 * once, on release, so a drag doesn't write the preference on every move.
 */
function VolumeSlider({
  value,
  onCommit,
  onRelease,
}: {
  value: number;
  onCommit: (value: number) => void;
  onRelease: (value: number) => void;
}): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;

  const fromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round((ratio * 100) / VOLUME_STEP) * VOLUME_STEP;
  };

  const nudge = (next: number) => onCommit(Math.min(100, Math.max(0, next)));

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div
        ref={trackRef}
        role="slider"
        aria-labelledby="sound-volume-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        aria-valuetext={`${shown}%`}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(fromClientX(e.clientX));
        }}
        onPointerMove={(e) => {
          if (drag !== null) setDrag(fromClientX(e.clientX));
        }}
        onPointerUp={(e) => {
          if (drag === null) return;
          const next = fromClientX(e.clientX);
          setDrag(null);
          onCommit(next);
          onRelease(next);
        }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") nudge(value - VOLUME_STEP);
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") nudge(value + VOLUME_STEP);
          else if (e.key === "Home") nudge(0);
          else if (e.key === "End") nudge(100);
          else return;
          e.preventDefault();
        }}
        className="group relative h-9 flex-1 cursor-pointer touch-none select-none rounded-full outline-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-background" />
        <div
          className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ width: `${shown}%` }}
        />
        <div
          className={cn(
            "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-xs ring-2 ring-background transition-[box-shadow] duration-150",
            "group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50"
          )}
          style={{ left: `${shown}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {shown}%
      </span>
    </div>
  );
}
