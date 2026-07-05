"use client";

/**
 * Ambience Mixer
 *
 * A compact soundscape panel for the sidebar. Each ambience is an icon toggle;
 * enabling one starts a looping track and unfurls its volume bar to the right —
 * the bar grows in length as it appears, the panel's signature motion. State
 * lives in {@link useAmbience}; this component owns the audio elements and keeps
 * them in sync with that store.
 */

import { useEffect, useRef, type JSX } from "react";
import { FaWind } from "react-icons/fa6";
import { AMBIENCES } from "@/lib/ambiences";
import { useAmbience } from "@/hooks/useAmbience";
import { cn } from "@/lib/utils";

export function AmbienceMixer(): JSX.Element {
  const tracks = useAmbience((s) => s.tracks);
  const toggle = useAmbience((s) => s.toggle);
  const setVolume = useAmbience((s) => s.setVolume);

  // One <audio> per track, created lazily and reused across renders.
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Sync audio playback to mixer state: play/pause + live volume.
  useEffect(() => {
    for (const ambience of AMBIENCES) {
      const state = tracks[ambience.id];
      let audio = audioRefs.current[ambience.id];

      if (!audio) {
        if (!state?.enabled) continue; // Don't fetch until first enable.
        audio = new Audio(ambience.url);
        audio.loop = true;
        audio.preload = "none";
        audioRefs.current[ambience.id] = audio;
      }

      audio.volume = state?.volume ?? 0;
      if (state?.enabled) {
        if (audio.paused) audio.play().catch(() => {});
      } else if (!audio.paused) {
        audio.pause();
      }
    }
  }, [tracks]);

  // Tear down all audio on unmount.
  useEffect(() => {
    const refs = audioRefs.current;
    return () => {
      for (const audio of Object.values(refs)) {
        audio.pause();
        audio.src = "";
      }
    };
  }, []);

  const activeCount = Object.values(tracks).filter((t) => t.enabled).length;

  return (
    <div className="rounded-lg border bg-card/40 p-2.5">
      {/* Panel header */}
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <FaWind className="size-3 text-muted-foreground" />
        <span className="text-xs font-semibold tracking-wide text-foreground/80">
          Ambience
        </span>
        {activeCount > 0 && (
          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold tabular-nums text-primary">
            {activeCount}
          </span>
        )}
      </div>

      {/* Track rows */}
      <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1">
        {AMBIENCES.map((ambience) => {
          const state = tracks[ambience.id];
          const enabled = !!state?.enabled;
          const volume = state?.volume ?? 0;
          const Icon = ambience.icon;

          return (
            <div
              key={ambience.id}
              role="button"
              tabIndex={0}
              onClick={() => toggle(ambience.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(ambience.id);
                }
              }}
              aria-pressed={enabled}
              aria-label={`${enabled ? "Stop" : "Play"} ${ambience.label}`}
              className={cn(
                "group/row flex cursor-pointer items-center rounded-md border p-1 text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring",
                enabled
                  ? "border-primary/30 bg-primary/10"
                  : "border-transparent hover:bg-accent/50"
              )}
            >
              <span
                className={cn(
                  "relative grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-200",
                  enabled
                    ? "bg-primary/20 text-primary shadow-[0_0_0_3px] shadow-primary/5"
                    : "bg-accent/60 text-muted-foreground group-hover/row:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {enabled && (
                  <span className="pointer-events-none absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                )}
              </span>

              {/* Right region: label (off) crossfades with volume bar (on) */}
              <span className="relative ml-2.5 flex h-7 min-w-0 flex-1 items-center">
                {/* Label — shown when the track is off */}
                <span
                  className={cn(
                    "absolute inset-0 flex items-center truncate text-xs transition-opacity duration-300",
                    enabled
                      ? "pointer-events-none opacity-0"
                      : "text-muted-foreground opacity-100 group-hover/row:text-foreground"
                  )}
                >
                  {ambience.label}
                </span>

                {/* Volume bar — unfurls in as the track turns on */}
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-2 overflow-hidden transition-all duration-500 ease-out",
                    enabled
                      ? "w-full opacity-100"
                      : "pointer-events-none max-w-0 opacity-0"
                  )}
                >
                  <VolumeSlider
                    value={volume}
                    label={ambience.label}
                    disabled={!enabled}
                    onChange={(v) => setVolume(ambience.id, v)}
                  />
                  <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-primary/70">
                    {Math.round(volume * 100)}
                  </span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Theme-aware volume control: pointer-draggable track with a fill + thumb. */
function VolumeSlider({
  value,
  label,
  disabled,
  onChange,
}: {
  value: number;
  label: string;
  disabled: boolean;
  onChange: (value: number) => void;
}): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onChange((clientX - rect.left) / rect.width);
  };

  const pct = Math.round(value * 100);

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={`${label} volume`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      tabIndex={disabled ? -1 : 0}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) setFromClientX(e.clientX);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(value - 0.05);
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(value + 0.05);
        }
      }}
      className="group relative h-4 flex-1 cursor-pointer touch-none select-none outline-none"
    >
      {/* Track */}
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border/70" />
      {/* Fill */}
      <div
        className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-primary transition-[width] duration-75"
        style={{ width: `${pct}%` }}
      />
      {/* Thumb */}
      <div
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow ring-2 ring-background transition-transform duration-75 group-hover:scale-110 group-focus-visible:scale-110"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
