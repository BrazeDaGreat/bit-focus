import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
