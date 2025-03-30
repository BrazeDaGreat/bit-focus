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
    return str;
  }
};

export function stringToHexColor(
  str: string,
  alpha?: number,
  lighten?: number
): [string, boolean] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate a hex color
  const color = (hash & 0xffffff).toString(16).toUpperCase();
  const hexColor = "#" + "000000".substring(0, 6 - color.length) + color;

  // Convert hex to RGB
  let r = parseInt(hexColor.substring(1, 3), 16);
  let g = parseInt(hexColor.substring(3, 5), 16);
  let b = parseInt(hexColor.substring(5, 7), 16);

  // Apply lightening if provided
  if (lighten !== undefined) {
    const factor = Math.min(100, Math.max(0, lighten)) / 100;
    r = Math.round(r + (255 - r) * factor);
    g = Math.round(g + (255 - g) * factor);
    b = Math.round(b + (255 - b) * factor);
  }

  // Calculate luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const useWhiteText = luminance < 0.5;

  // If alpha is provided, return RGBA
  if (alpha !== undefined) {
    const rgbaColor = `rgba(${r}, ${g}, ${b}, ${Math.max(
      0,
      Math.min(1, alpha)
    )})`;
    return [rgbaColor, useWhiteText];
  }

  // Convert lightened RGB back to hex
  const finalHex = `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();

  return [finalHex, useWhiteText];
}
