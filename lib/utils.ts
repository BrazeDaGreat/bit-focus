import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate the time difference between two dates.
 *
 * @param {Date} startTime The start time
 * @param {Date} endTime The end time
 * @param {string} [mode="H:M:S"] The format of the returned time difference
 *   - "H:M:S" returns the difference in hours, minutes and seconds
 *   - "M:S" returns the difference in minutes and seconds
 *   - "S" returns the difference in seconds
 * @returns {{ hours?: number, minutes?: number, seconds: number }} The time difference
 */
export const calculateTime = (
  startTime: Date,
  endTime: Date,
  mode: "H:M:S" | "M:S" | "S" = "H:M:S"
): { hours?: number; minutes?: number; seconds: number } => {
  const diffInMs = Math.max(endTime.getTime() - startTime.getTime(), 0); // Ensure non-negative
  const totalSeconds = Math.floor(diffInMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  switch (mode) {
    case "H:M:S":
      return { hours, minutes, seconds };
    case "M:S":
      const totalMinutes = Math.floor(totalSeconds / 60);
      return { minutes: totalMinutes, seconds };
    case "S":
      return { seconds: totalSeconds };
    default:
      throw new Error("Invalid mode");
  }
};

/**
 * Format a given time in minutes and seconds to a human-readable string.
 *
 * @param {number} minutes The number of minutes
 * @param {number} seconds The number of seconds
 * @param {number} [mode=0] The format of the returned time
 *   - 0: "MM:SS"
 *   - 1: "Xh Ym Zs"
 * @returns {string} The formatted time
 */
export const formatTime = (
  minutes: number,
  seconds: number,
  mode: number = 0
) => {
  if (mode === 0)
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

  if (mode === 1) {
    const totalSeconds = minutes * 60 + seconds;
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.round(totalSeconds % 60);

    let str = ``;
    if (hrs > 0) str += `${hrs}h `;
    if (mins > 0) str += `${mins}m `;
    if (secs > 0) str += `${secs}s`;
    if (str === "") str = `0s`;
    return str;
  }
};

type TimeObject =
  | { hours: number; minutes: number; seconds: number }
  | { minutes: number; seconds: number }
  | { seconds: number };

/**
 * Format a given time object to a human-readable string. Compatible with `calculateTime()`
 *
 * @param {TimeObject} time The time object to format
 * @param {string} [mode="H:M:S"] The format of the returned time
 *   - "H:M:S" returns the time in hours, minutes and seconds
 *   - "M:S" returns the time in minutes and seconds
 *   - "S" returns the time in seconds
 * @param {string} [style="digital"] The style of the returned time
 *   - "digital" returns a digital-style time (e.g. 12:34:56)
 *   - "text" returns a text-style time (e.g. 12h 34m 56s)
 * @returns {string} The formatted time
 */
export const formatTimeNew = (
  time: TimeObject,
  mode: "H:M:S" | "M:S" | "S" = "H:M:S",
  style: "digital" | "text" = "digital"
): string => {
  const pad = (num: number) => num.toString().padStart(2, "0");

  if (style === "digital") {
    switch (mode) {
      case "H:M:S": {
        const {
          hours = 0,
          minutes = 0,
          seconds,
        } = time as {
          hours: number;
          minutes: number;
          seconds: number;
        };
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      }
      case "M:S": {
        const { minutes = 0, seconds } = time as {
          minutes: number;
          seconds: number;
        };
        return `${pad(minutes)}:${pad(seconds)}`;
      }
      case "S": {
        const { seconds } = time as { seconds: number };
        return `${seconds}`;
      }
    }
  } else if (style === "text") {
    const parts: string[] = [];
    if ("hours" in time && time.hours > 0) parts.push(`${time.hours}h`);
    if ("minutes" in time && time.minutes > 0) parts.push(`${time.minutes}m`);
    if (time.seconds > 0) parts.push(`${time.seconds}s`);
    if (parts.length === 0) return "0s";
    return parts.join(" ");
  }

  return "";
};

/**
 * Generates a color based on the given string and optional parameters.
 *
 * The color is generated using the DJB2 hash function to map the string to a hue (0-360).
 * The saturation is fixed at 65 and the lightness is fixed at 50 unless the `lighten` parameter
 * is specified, in which case the lightness is increased by the specified amount (up to a maximum
 * of 100).
 *
 * The function returns an array with two elements: the first is the color as a CSS color string
 * (either `#RRGGBB` or `rgba(R,G,B,A)` if the `alpha` parameter is specified), and the second is
 * a boolean indicating whether the color is dark enough to use white text.
 *
 * @param {string} str The string to generate the color from
 * @param {number} [alpha] The alpha channel value to use if returning an `rgba()` color string
 * @param {number} [lighten] The amount to lighten the color by (up to a maximum of 100)
 * @returns {[string, boolean]} The color and whether to use white text or not
 */
export function stringToHexColor(
  str: string,
  alpha?: number,
  lighten?: number
): [string, boolean] {
  // DJB2 hash function
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }

  // Ensure positive hash
  hash = Math.abs(hash);

  // Map hash to hue (0-360)
  const hue = hash % 360;

  // Saturation and lightness
  const saturation = 65;
  let lightness = 50;

  // Apply lightening if requested
  if (lighten !== undefined) {
    lightness = Math.min(100, lightness + lighten);
  }

  // Convert HSL to RGB
  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [
      Math.round(255 * f(0)),
      Math.round(255 * f(8)),
      Math.round(255 * f(4)),
    ];
  }

  const [r, g, b] = hslToRgb(hue, saturation, lightness);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const useWhiteText = luminance < 0.5;

  if (alpha !== undefined) {
    return [
      `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`,
      useWhiteText,
    ];
  }

  const hex = `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();

  return [hex, useWhiteText];
}
