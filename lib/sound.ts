/**
 * sound.ts - Notification Sound Utilities
 *
 * Plays notification sounds using the Web Audio API.
 * No external audio files required - sounds are generated programmatically.
 *
 * Each preset is a short motif of a few oscillator notes, repeated. Every
 * note is one gain envelope over one or two oscillators, so even the busiest
 * preset schedules a dozen nodes — light enough for low-powered devices.
 *
 * Events:
 * - 'notificationSoundStart': Dispatched when the notification sound begins
 * - 'notificationSoundEnd': Dispatched when the notification sound ends
 */

let audioContext: AudioContext | null = null;
let soundEndTimeoutId: number | null = null;
/** Output of the sound now playing, so a new one (or a preview) replaces it. */
let activeOutput: GainNode | null = null;

/**
 * Custom event names for notification sound lifecycle
 */
export const SOUND_EVENTS = {
  START: 'notificationSoundStart',
  END: 'notificationSoundEnd',
} as const;

export type SoundPreset = "chime" | "bell" | "marimba" | "digital" | "woodblock" | "none";

export interface SoundOptions {
  /** Master volume, 0–100. 100 is the original chime's loudness. */
  volume?: number;
  /** Fade the sound in over its first strikes instead of starting at full gain. */
  gentle?: boolean;
}

interface Note {
  freq: number;
  /** Seconds after the start of the motif. */
  at: number;
  duration: number;
  peak: number;
  type: OscillatorType;
  /** Seconds to reach peak. */
  attack: number;
  /** Seconds after start the peak holds until. */
  hold: number;
  /** Gain the exponential decay ends at. */
  floor: number;
  /** Optional overtone, as a multiple of freq at a fraction of the gain. */
  overtone?: { ratio: number; gain: number };
  /** Optional pitch the note bends down to over its length. */
  bendTo?: number;
}

interface PresetSpec {
  label: string;
  notes: Note[];
  repetitions: number;
  /** Seconds between the starts of each repetition. */
  gap: number;
}

const note = (freq: number, at: number, rest: Omit<Note, "freq" | "at">): Note => ({ freq, at, ...rest });

// The original chime: triangle major triad arpeggio, played twice.
const CHIME_NOTE = { duration: 0.3, peak: 0.35, type: "triangle", attack: 0.01, hold: 0.05, floor: 0.01 } as const;
const BELL_NOTE = { duration: 1.4, peak: 0.3, type: "sine", attack: 0.005, hold: 0.01, floor: 0.001, overtone: { ratio: 2.76, gain: 0.35 } } as const;
const MARIMBA_NOTE = { duration: 0.5, peak: 0.4, type: "sine", attack: 0.004, hold: 0.008, floor: 0.001, overtone: { ratio: 4, gain: 0.2 } } as const;
const BEEP_NOTE = { duration: 0.09, peak: 0.12, type: "square", attack: 0.004, hold: 0.07, floor: 0.001 } as const;
const WOOD_NOTE = { duration: 0.12, peak: 0.45, type: "triangle", attack: 0.002, hold: 0.004, floor: 0.001 } as const;

const PRESET_SPECS: Record<Exclude<SoundPreset, "none">, PresetSpec> = {
  chime: {
    label: "Chime",
    notes: [880, 1108.73, 1318.51].map((f, i) => note(f, i * 0.1, CHIME_NOTE)),
    repetitions: 2,
    gap: 0.45,
  },
  bell: {
    label: "Bell",
    notes: [note(659.25, 0, BELL_NOTE)],
    repetitions: 2,
    gap: 0.9,
  },
  marimba: {
    label: "Soft marimba",
    // Rising C–E–G–C, then a pause before it repeats.
    notes: [523.25, 659.25, 783.99, 1046.5].map((f, i) => note(f, i * 0.13, MARIMBA_NOTE)),
    repetitions: 2,
    gap: 0.95,
  },
  digital: {
    label: "Digital beep",
    notes: [0, 0.14, 0.28, 0.42].map((at) => note(1000, at, BEEP_NOTE)),
    repetitions: 2,
    gap: 0.9,
  },
  woodblock: {
    label: "Wood block",
    notes: [
      note(1250, 0, { ...WOOD_NOTE, bendTo: 1100 }),
      note(950, 0.16, { ...WOOD_NOTE, bendTo: 830 }),
    ],
    repetitions: 2,
    gap: 0.55,
  },
};

/** Presets in the order a picker shows them. */
export const SOUND_PRESETS: { id: SoundPreset; label: string }[] = [
  ...(Object.keys(PRESET_SPECS) as Exclude<SoundPreset, "none">[]).map((id) => ({
    id,
    label: PRESET_SPECS[id].label,
  })),
  { id: "none", label: "None" },
];

export function isSoundPreset(value: unknown): value is SoundPreset {
  return value === "none" || (typeof value === "string" && value in PRESET_SPECS);
}

/** Seconds the gentle fade takes to reach full volume. */
const GENTLE_RAMP_SECONDS = 1.2;

/**
 * Gets or creates the AudioContext singleton.
 * Creates on first use to comply with browser autoplay policies.
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Total duration of a preset in seconds.
 * Based on: repetitions * gap between motifs + the motif's last note ending
 */
function presetDuration(spec: PresetSpec, repetitions: number): number {
  const motifEnd = Math.max(...spec.notes.map((n) => n.at + n.duration));
  return (repetitions - 1) * spec.gap + motifEnd;
}

function scheduleNote(ctx: AudioContext, output: AudioNode, n: Note, startTime: number): void {
  const gainNode = ctx.createGain();
  gainNode.connect(output);

  // Keep a short envelope to reduce synthesis workload.
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(n.peak, startTime + n.attack);
  gainNode.gain.setValueAtTime(n.peak, startTime + n.hold);
  gainNode.gain.exponentialRampToValueAtTime(n.floor, startTime + n.duration);

  const oscillator = ctx.createOscillator();
  oscillator.type = n.type;
  oscillator.frequency.setValueAtTime(n.freq, startTime);
  if (n.bendTo) oscillator.frequency.exponentialRampToValueAtTime(n.bendTo, startTime + n.duration);
  oscillator.connect(gainNode);
  oscillator.start(startTime);
  oscillator.stop(startTime + n.duration);

  if (n.overtone) {
    // The overtone dies faster than the fundamental, which is what makes a
    // struck sound read as struck.
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(n.overtone.gain, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, startTime + n.duration * 0.4);
    overtoneGain.connect(gainNode);

    const partial = ctx.createOscillator();
    partial.type = "sine";
    partial.frequency.setValueAtTime(n.freq * n.overtone.ratio, startTime);
    partial.connect(overtoneGain);
    partial.start(startTime);
    partial.stop(startTime + n.duration * 0.4);
  }
}

/**
 * Plays a notification sound — the chime by default.
 *
 * Dispatches events when sound starts and ends so other components
 * (like YouTube player) can pause/resume accordingly. "None", or a volume of
 * zero, plays nothing and dispatches nothing.
 */
export function playNotificationSound(preset: SoundPreset = "chime", options: SoundOptions = {}): void {
  if (typeof window === "undefined") return;
  if (!isSoundPreset(preset) || preset === "none") return;

  const requested = Number.isFinite(options.volume) ? (options.volume as number) : 100;
  const volume = Math.min(100, Math.max(0, requested));
  if (volume === 0) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // A new sound replaces one still ringing rather than piling on top.
    if (activeOutput) {
      activeOutput.disconnect();
      activeOutput = null;
    }

    // Dispatch start event
    window.dispatchEvent(new CustomEvent(SOUND_EVENTS.START));

    const spec = PRESET_SPECS[preset];
    // Gentle plays one extra repetition so the fade-in has room to be heard.
    const repetitions = spec.repetitions + (options.gentle ? 1 : 0);

    // Squared so the slider feels even to the ear; 100% leaves gain untouched.
    const level = (volume / 100) ** 2;
    const output = ctx.createGain();
    output.connect(ctx.destination);
    if (options.gentle) {
      output.gain.setValueAtTime(0.0001, now);
      output.gain.exponentialRampToValueAtTime(level, now + GENTLE_RAMP_SECONDS);
    } else {
      output.gain.setValueAtTime(level, now);
    }
    activeOutput = output;

    for (let rep = 0; rep < repetitions; rep++) {
      const repOffset = rep * spec.gap;
      for (const n of spec.notes) {
        scheduleNote(ctx, output, n, now + repOffset + n.at);
      }
    }

    // Dispatch end event after sound completes
    const soundDuration = Math.ceil(presetDuration(spec, repetitions) * 1000);
    if (soundEndTimeoutId !== null) {
      window.clearTimeout(soundEndTimeoutId);
    }
    soundEndTimeoutId = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SOUND_EVENTS.END));
      soundEndTimeoutId = null;
      if (activeOutput === output) activeOutput = null;
    }, soundDuration);

  } catch (error) {
    console.warn("Failed to play notification sound:", error);
  }
}
