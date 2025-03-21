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
    if (Math.floor(minutes / 60) === 0) return `${minutes}s`;
    return `${Math.floor(minutes / 60)}m ${minutes % 60}s`;
  }
};

export function stringToHexColor(
  str: string,
  alpha?: number
): [string, boolean] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate a hex color
  const color = (hash & 0xffffff).toString(16).toUpperCase();
  const hexColor = "#" + "000000".substring(0, 6 - color.length) + color;

  // Convert hex to RGB
  const r = parseInt(hexColor.substring(1, 3), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);

  // Calculate luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Determine text color: if luminance is low, use white text; otherwise, use black text
  const useWhiteText = luminance < 0.5;

  // If alpha is provided, return RGBA color instead of HEX
  if (alpha !== undefined) {
    const rgbaColor = `rgba(${r}, ${g}, ${b}, ${Math.max(
      0,
      Math.min(1, alpha)
    )})`;
    return [rgbaColor, useWhiteText];
  }

  return [hexColor, useWhiteText];
}
