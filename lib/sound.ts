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
  const repetitions = 6;
  const gapBetweenChimes = 0.5;
  const lastNoteOffset = 2 * 0.12; // 3rd note (index 2) offset
  const noteDuration = 0.5;
  
  // Total duration = (repetitions - 1) * gap + last note start offset + note duration
  const totalSeconds = (repetitions - 1) * gapBetweenChimes + lastNoteOffset + noteDuration;
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

    // Bell-like frequencies for a classic timer sound
    const bellFrequencies = [880, 1108.73, 1318.51]; // A5, C#6, E6 (A major, higher pitch for attention)
    const repetitions = 6; // Play the chime 6 times
    const gapBetweenChimes = 0.5; // Gap between each chime repetition

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
        const startTime = now + repOffset + index * 0.12;
        const duration = 0.5;

        // Higher gain for better audibility
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.01);
        gainNode.gain.setValueAtTime(0.5, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });

      // Add a low undertone for richness on each repetition
      const bassOscillator = ctx.createOscillator();
      const bassGain = ctx.createGain();

      bassOscillator.connect(bassGain);
      bassGain.connect(ctx.destination);

      bassOscillator.type = "sine";
      bassOscillator.frequency.setValueAtTime(220, now); // A3 bass note

      const bassStart = now + repOffset;
      const bassDuration = 0.4;

      bassGain.gain.setValueAtTime(0, bassStart);
      bassGain.gain.linearRampToValueAtTime(0.3, bassStart + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.01, bassStart + bassDuration);

      bassOscillator.start(bassStart);
      bassOscillator.stop(bassStart + bassDuration);
    }

    // Dispatch end event after sound completes
    const soundDuration = calculateSoundDuration();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SOUND_EVENTS.END));
    }, soundDuration);

  } catch (error) {
    console.warn("Failed to play notification sound:", error);
  }
}
