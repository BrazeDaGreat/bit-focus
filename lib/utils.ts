/**
 * Utilities Library - Core Helper Functions and Data Processing
 *
 * This comprehensive utility library provides essential helper functions used
 * throughout the BIT Focus application. It includes functions for class name
 * management, time calculations and formatting, color generation, and data
 * processing operations specific to focus session management.
 *
 * Categories:
 * - CSS Class Management: Utility for merging and managing Tailwind classes
 * - Time Calculations: Functions for computing time differences and durations
 * - Color Generation: Deterministic color generation from strings
 * - Data Processing: Focus session aggregation and analysis
 * - Tag Management: Color management for categorization tags
 * - Currency Management: Currency symbol management
 * - Formatting: Time, Numbers, Dates.
 *
 * Key Features:
 * - Type-safe time calculations with multiple output formats
 * - Deterministic color generation using DJB2 hash algorithm
 * - Comprehensive time formatting for various display needs
 * - Focus session data aggregation and analysis
 * - Color accessibility calculations for text contrast
 * - Integration with saved tag color preferences
 *
 * Dependencies:
 * - clsx: Class name utility library
 * - tailwind-merge: Tailwind CSS class merging
 * - Custom types from focus and tag management systems
 *
 * @fileoverview Core utility functions for time, color, and data processing
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 */

import { FocusSession } from "@/hooks/useFocus";
import { SavedTag } from "@/hooks/useTag";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class Name Utility Function
 *
 * Merges and optimizes CSS class names using clsx and tailwind-merge.
 * This function combines multiple class inputs and resolves Tailwind CSS
 * conflicts by keeping only the last conflicting class, ensuring optimal
 * and predictable styling.
 *
 * @param {...ClassValue[]} inputs - Variable number of class values to merge
 * @returns {string} Optimized and merged class name string
 *
 * @example
 * ```typescript
 * // Basic usage
 * cn("px-4", "py-2", "bg-blue-500")
 * // Returns: "px-4 py-2 bg-blue-500"
 *
 * // Conditional classes
 * cn("base-class", isActive && "active-class", "other-class")
 * // Returns: "base-class active-class other-class" (if isActive is true)
 *
 * // Tailwind conflict resolution
 * cn("px-4", "px-6")
 * // Returns: "px-6" (last px-* class wins)
 * ```
 *
 * @see {@link https://github.com/lukeed/clsx} for clsx documentation
 * @see {@link https://github.com/dcastil/tailwind-merge} for tailwind-merge documentation
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Time Object Union Type
 *
 * Represents different time object structures that can be used with
 * time formatting functions. Supports full HMS, MS, or seconds-only formats.
 */
type TimeObject =
  | { hours: number; minutes: number; seconds: number }
  | { minutes: number; seconds: number }
  | { seconds: number };

/**
 * Calculate Time Difference Between Dates
 *
 * Computes the time difference between two Date objects and returns
 * the result in the specified format. Handles edge cases like negative
 * differences and provides flexible output modes for different use cases.
 *
 * The function ensures non-negative results by using Math.max with 0,
 * preventing issues with invalid date ranges or reversed start/end times.
 *
 * @param {Date} startTime - The start time for calculation
 * @param {Date} endTime - The end time for calculation
 * @param {"H:M:S" | "M:S" | "S"} [mode="H:M:S"] - Output format mode
 * @returns {TimeObject} Time difference object in requested format
 *
 * @example
 * ```typescript
 * const start = new Date("2024-01-15T09:00:00");
 * const end = new Date("2024-01-15T10:30:45");
 *
 * // Full format with hours, minutes, seconds
 * calculateTime(start, end, "H:M:S")
 * // Returns: { hours: 1, minutes: 30, seconds: 45 }
 *
 * // Minutes and seconds only
 * calculateTime(start, end, "M:S")
 * // Returns: { minutes: 90, seconds: 45 }
 *
 * // Total seconds only
 * calculateTime(start, end, "S")
 * // Returns: { seconds: 5445 }
 * ```
 *
 * @see {@link TimeObject} for return type variations
 */
export const calculateTime = (
  startTime: Date,
  endTime: Date,
  mode: "H:M:S" | "M:S" | "S" = "H:M:S"
): TimeObject => {
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
 * Legacy Time Formatting Function
 *
 * Formats time values in minutes and seconds to human-readable strings.
 * Provides two formatting modes: digital clock format and descriptive text.
 * This function is maintained for backward compatibility with existing code.
 *
 * @deprecated Use `formatTimeNew()` for new implementations
 * @param {number} minutes - Number of minutes
 * @param {number} seconds - Number of seconds
 * @param {number} [mode=0] - Format mode (0: digital, 1: descriptive)
 * @returns {string} Formatted time string
 *
 * @example
 * ```typescript
 * // Digital format (mode 0)
 * formatTime(15, 30, 0)
 * // Returns: "15:30"
 *
 * // Descriptive format (mode 1)
 * formatTime(75, 45, 1)
 * // Returns: "1h 15m 45s"
 *
 * // Zero handling
 * formatTime(0, 0, 1)
 * // Returns: "0s"
 * ```
 *
 * @see {@link formatTimeNew} for the recommended modern alternative
 */
export const formatTime = (
  minutes: number,
  seconds: number,
  mode: number = 0
): string | undefined => {
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

/**
 * Modern Time Formatting Function
 *
 * Advanced time formatting function that works with TimeObject structures
 * returned by calculateTime(). Supports both digital clock formats and
 * human-readable text descriptions. Provides more flexibility and type
 * safety compared to the legacy formatTime function.
 *
 * @param {TimeObject} time - Time object to format
 * @param {"H:M:S" | "M:S" | "S"} [mode="H:M:S"] - Format complexity
 * @param {"digital" | "text"} [style="digital"] - Display style
 * @returns {string} Formatted time string
 *
 * @example
 * ```typescript
 * const timeObj = { hours: 2, minutes: 30, seconds: 45 };
 *
 * // Digital format with hours
 * formatTimeNew(timeObj, "H:M:S", "digital")
 * // Returns: "02:30:45"
 *
 * // Text format with hours
 * formatTimeNew(timeObj, "H:M:S", "text")
 * // Returns: "2h 30m 45s"
 *
 * // Minutes and seconds only
 * formatTimeNew({ minutes: 15, seconds: 30 }, "M:S", "digital")
 * // Returns: "15:30"
 *
 * // Seconds only
 * formatTimeNew({ seconds: 90 }, "S", "text")
 * // Returns: "90s"
 * ```
 *
 * @see {@link TimeObject} for input type structure
 * @see {@link calculateTime} for generating compatible time objects
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
 * Convert Seconds to Duration Object
 *
 * Converts a duration in seconds to a structured time object with hours,
 * minutes, and seconds. This is a convenience function that wraps
 * calculateTime() for cases where you have a raw seconds value.
 *
 * @param {number} seconds - Duration in seconds to convert
 * @returns {TimeObject} Duration object with hours, minutes, and seconds
 *
 * @example
 * ```typescript
 * // Convert 2 hours, 30 minutes, 45 seconds
 * durationFromSeconds(9045)
 * // Returns: { hours: 2, minutes: 30, seconds: 45 }
 *
 * // Convert 90 seconds
 * durationFromSeconds(90)
 * // Returns: { hours: 0, minutes: 1, seconds: 30 }
 * ```
 *
 * @see {@link calculateTime} for the underlying calculation logic
 */
export const durationFromSeconds = (seconds: number): TimeObject =>
  calculateTime(new Date(0), new Date(seconds * 1000), "H:M:S");

/**
 * Aggregate Focus Session Durations
 *
 * Calculates the total duration of multiple focus sessions by summing
 * their individual durations. Returns the result in seconds for further
 * processing or formatting.
 *
 * This function is essential for analytics and reporting features where
 * total focus time across multiple sessions needs to be computed.
 *
 * @param {FocusSession[]} sessions - Array of focus sessions to process
 * @returns {number} Total duration in seconds
 *
 * @example
 * ```typescript
 * const sessions = [
 *   {
 *     startTime: new Date("2024-01-15T09:00:00"),
 *     endTime: new Date("2024-01-15T10:00:00")
 *   },
 *   {
 *     startTime: new Date("2024-01-15T14:00:00"),
 *     endTime: new Date("2024-01-15T14:30:00")
 *   }
 * ];
 *
 * reduceSessions(sessions)
 * // Returns: 5400 (90 minutes in seconds)
 * ```
 *
 * @see {@link FocusSession} for session data structure
 * @see {@link calculateTime} for individual session calculation
 */
export const reduceSessions = (sessions: FocusSession[]): number => {
  let totalSeconds = 0;
  sessions.map(
    (session) =>
      (totalSeconds += calculateTime(
        session.startTime,
        session.endTime,
        "S"
      ).seconds)
  );
  return totalSeconds;
};

/**
 * Generate Deterministic Color from String
 *
 * Creates a consistent color based on input string using the DJB2 hash
 * algorithm. This ensures the same string always produces the same color,
 * which is useful for tag coloring and visual consistency across sessions.
 *
 * The function uses HSL color space for better color distribution and
 * includes accessibility features by calculating appropriate text contrast.
 * Optional parameters allow for color adjustments and transparency.
 *
 * @param {string} str - String to generate color from
 * @param {number} [alpha] - Optional alpha channel (0-1) for RGBA output
 * @param {number} [lighten] - Optional lightness adjustment (0-100)
 * @returns {[string, boolean]} Tuple of [color_string, use_white_text]
 *
 * @example
 * ```typescript
 * // Basic color generation
 * stringToHexColor("Work")
 * // Returns: ["#3B82F6", false] (blue color, use dark text)
 *
 * // With transparency
 * stringToHexColor("Study", 0.7)
 * // Returns: ["rgba(59, 130, 246, 0.7)", false]
 *
 * // Lightened color
 * stringToHexColor("Exercise", undefined, 20)
 * // Returns: ["#6B9BFF", false] (lighter blue)
 *
 * // Dark color requiring white text
 * stringToHexColor("Deep Work")
 * // Returns: ["#1E293B", true] (dark color, use white text)
 * ```
 *
 * @see {@link https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function} for hash algorithm reference
 */
export function stringToHexColor(
  str: string,
  alpha?: number,
  lighten?: number
): [string, boolean] {
  // DJB2 hash function for consistent color generation
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }

  // Ensure positive hash value
  hash = Math.abs(hash);

  // Map hash to hue (0-360 degrees)
  const hue = hash % 360;

  // Fixed saturation and base lightness for good color quality
  const saturation = 65;
  let lightness = 50;

  // Apply lightening adjustment if specified
  if (lighten !== undefined) {
    lightness = Math.min(100, lightness + lighten);
  }

  /**
   * Convert HSL to RGB Color Space
   *
   * Internal function to convert HSL values to RGB for final color output.
   * Uses standard HSL to RGB conversion algorithm.
   *
   * @param {number} h - Hue (0-360)
   * @param {number} s - Saturation (0-100)
   * @param {number} l - Lightness (0-100)
   * @returns {[number, number, number]} RGB values (0-255)
   */
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

  // Calculate luminance for text contrast determination
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const useWhiteText = luminance < 0.5;

  // Return RGBA format if alpha is specified
  if (alpha !== undefined) {
    return [
      `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`,
      useWhiteText,
    ];
  }

  // Return HEX format for solid colors
  const hex = `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();

  return [hex, useWhiteText];
}

/**
 * Determine Text Color for Background
 *
 * Analyzes a HEX color value to determine whether white or black text
 * would provide better contrast and readability. Uses luminance calculation
 * based on standard color perception formulas.
 *
 * @param {string} hex - HEX color string (with or without #)
 * @returns {boolean} True if white text should be used, false for black text
 *
 * @example
 * ```typescript
 * // Dark background needs white text
 * whiteText("#1E293B")
 * // Returns: true
 *
 * // Light background needs dark text
 * whiteText("#F8FAFC")
 * // Returns: false
 *
 * // Medium background
 * whiteText("#6B7280")
 * // Returns: true
 *
 * // Short HEX format
 * whiteText("#000")
 * // Returns: true
 * ```
 *
 * @see {@link https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html} for contrast guidelines
 */
export function whiteText(hex: string): boolean {
  hex = hex.replace(/^#/, "");

  // Parse RGB components from HEX
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 3) {
    // Short format: #RGB -> #RRGGBB
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    // Full format: #RRGGBB
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    // Invalid HEX format
    return false;
  }

  // Calculate relative luminance using standard formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Get Tag Color with Saved Preferences
 *
 * Retrieves the appropriate color for a tag, preferring saved custom colors
 * over generated ones. This function maintains consistency in tag coloring
 * while allowing user customization through the saved tags system.
 *
 * @param {SavedTag[]} savedTags - Array of saved tags with custom colors
 * @param {string} tag - Tag name to get color for
 * @param {number} [alpha=1] - Alpha transparency for generated colors
 * @returns {[string, boolean]} Tuple of [color_string, use_white_text]
 *
 * @example
 * ```typescript
 * const savedTags = [
 *   { t: "Work", c: "#3B82F6" },
 *   { t: "Study", c: "#10B981" }
 * ];
 *
 * // Saved tag color
 * getTagColor(savedTags, "Work")
 * // Returns: ["#3B82F6", false] (uses saved color)
 *
 * // Generated color for new tag
 * getTagColor(savedTags, "Exercise")
 * // Returns: ["#8B5CF6", false] (generates new color)
 *
 * // With transparency for new tag
 * getTagColor(savedTags, "Reading", 0.8)
 * // Returns: ["rgba(139, 92, 246, 0.8)", false]
 * ```
 *
 * @see {@link SavedTag} for saved tag data structure
 * @see {@link stringToHexColor} for color generation
 * @see {@link whiteText} for contrast calculation
 */
export function getTagColor(
  savedTags: SavedTag[],
  tag: string,
  alpha: number = 1
): [string, boolean] {
  // Check if tag has a saved custom color
  const exists = savedTags.find((n) => n.t === tag);
  if (exists) {
    return [exists.c, whiteText(exists.c)];
  }

  // Generate color for new tags
  return stringToHexColor(tag, alpha);
}

/**
 * @deprecated use `Number.toLocaleString();` instead
 *
 * Format Number with Commas
 *
 * Takes a number and returns a string with commas for better readability
 * in lists and tables. Useful for formatting numbers in the thousands
 * and beyond.
 *
 * @param {number} num - Number to format
 * @returns {string} Formatted string with commas
 *
 * @example
 * ```typescript
 * formatNumberWithCommas(1000)
 * // Returns: "1,000"
 * formatNumberWithCommas(1000000)
 * // Returns: "1,000,000"
 * ```
 *
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Gets currency symbol based on configuration
 *
 * This function takes a currency code and returns the corresponding
 * currency symbol. The function uses a switch statement to map the
 * currency code to the symbol. If no match is found, the function
 * returns the default symbol, which is the dollar sign.
 *
 * @param {string} currency - The currency code
 * @returns {string} The currency symbol
 *
 * @example
 * ```typescript
 * getCurrencySymbol("USD")
 * // Returns: "$"
 * getCurrencySymbol("AED")
 * // Returns: "د.إ"
 * getCurrencySymbol("PKR")
 * // Returns: "₨"
 * ```
 *
 * @see {@link https://en.wikipedia.org/wiki/Currency_symbol} for currency symbols
 */
export function getCurrencySymbol(currency: string): string {
  switch (currency) {
    case "USD":
      return "$";
    case "AED":
      return "Dh";
    case "PKR":
      return "₨";
    default:
      return "$";
  }
}


/**
 * Formats a JavaScript Date object into a string with the format "DDod MMM, YY".
 * Example output: "27th Jun, 25"
 *
 * - Day is zero-padded if needed (01-31)
 * - Day suffix is added (st, nd, rd, th)
 * - Month is abbreviated to 3 letters (e.g., Jan, Feb, Mar)
 * - Year is two digits
 *
 * @param {Date} date - The Date object to format.
 * @returns {string} The formatted date string.
 */
export function formatDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);

  const getDaySuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const daySuffix = getDaySuffix(day);
  const dayStr = `${day}${daySuffix}`;

  return `${dayStr} ${month}, ${year}`;
}

/**
 * Sets the clipboard to the given text.
 *
 * @param text - The text to set the clipboard to.
 * @returns A Promise that resolves to true if the text was successfully copied to the clipboard, false otherwise.
 */
export async function setClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy text: ", err);
    return false;
  }
}