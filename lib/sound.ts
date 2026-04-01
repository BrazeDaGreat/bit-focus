/**
 * sound.ts - Notification Sound Utilities
 *
 * Plays notification sounds using the Web Audio API.
 * No external audio files required - sounds are generated programmatically.
 * 
 * Events:
 * - 'notificationSoundStart': Dispatched when the notification sound begins
 * - 'notificationSoundEnd': Dispatched when the notification sound ends
 */

let audioContext: AudioContext | null = null;
let soundEndTimeoutId: number | null = null;

const CHIME_FREQUENCIES = [880, 1108.73, 1318.51] as const;
const CHIME_REPETITIONS = 2;
const CHIME_GAP_SECONDS = 0.45;
const NOTE_STAGGER_SECONDS = 0.1;
const NOTE_DURATION_SECONDS = 0.3;
const PEAK_GAIN = 0.35;

/**
 * Custom event names for notification sound lifecycle
 */
export const SOUND_EVENTS = {
  START: 'notificationSoundStart',
  END: 'notificationSoundEnd',
} as const;

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
 * Calculates the total duration of the notification sound in milliseconds.
 * Based on: repetitions * gapBetweenChimes + last note duration
 */
function calculateSoundDuration(): number {
  const lastNoteOffset = (CHIME_FREQUENCIES.length - 1) * NOTE_STAGGER_SECONDS;
  const totalSeconds =
    (CHIME_REPETITIONS - 1) * CHIME_GAP_SECONDS +
    lastNoteOffset +
    NOTE_DURATION_SECONDS;
  return Math.ceil(totalSeconds * 1000); // Convert to ms and round up
}

/**
 * Plays a prominent Pomodoro-style notification sound.
 * Uses a repeating bell chime pattern that's hard to miss.
 * 
 * Dispatches events when sound starts and ends so other components
 * (like YouTube player) can pause/resume accordingly.
 */
export function playNotificationSound(): void {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Dispatch start event
    window.dispatchEvent(new CustomEvent(SOUND_EVENTS.START));

    // Lightweight chime sequence to avoid UI lag on lower-powered devices.
    // Still uses a major triad to keep the notification recognizable.
    const bellFrequencies = CHIME_FREQUENCIES;
    const repetitions = CHIME_REPETITIONS;
    const gapBetweenChimes = CHIME_GAP_SECONDS;

    for (let rep = 0; rep < repetitions; rep++) {
      const repOffset = rep * gapBetweenChimes;

      bellFrequencies.forEach((freq, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Triangle wave for a warmer, bell-like tone
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(freq, now);

        // Stagger the notes for an arpeggio effect
        const startTime = now + repOffset + index * NOTE_STAGGER_SECONDS;
        const duration = NOTE_DURATION_SECONDS;

        // Keep a short envelope to reduce synthesis workload.
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(PEAK_GAIN, startTime + 0.01);
        gainNode.gain.setValueAtTime(PEAK_GAIN, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });
    }

    // Dispatch end event after sound completes
    const soundDuration = calculateSoundDuration();
    if (soundEndTimeoutId !== null) {
      window.clearTimeout(soundEndTimeoutId);
    }
    soundEndTimeoutId = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SOUND_EVENTS.END));
      soundEndTimeoutId = null;
    }, soundDuration);

  } catch (error) {
    console.warn("Failed to play notification sound:", error);
  }
}
