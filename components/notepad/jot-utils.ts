/**
 * Distraction Jot Utilities
 *
 * Helpers for formatting, parsing, detecting, toggling, and clearing
 * distraction jots in the Notepad.
 *
 * Jot format:
 *   `- 3:42 PM  call the bank`
 *   `- 3:42 PM #uni  call the bank`
 *   `- [x] 3:42 PM  call the bank` (completed)
 *
 * @fileoverview Distraction jot parsing and manipulation
 * @author BIT Focus Development Team
 */

import { format } from "date-fns";

/**
 * Matches a distraction jot line:
 * - Group 1: completion status ("x" or "X" or " " or undefined)
 * - Group 2: 12-hour timestamp (e.g. "3:42 PM")
 * - Group 3: optional tag (e.g. "#uni")
 * - Group 4: jot content
 */
export const JOT_REGEX =
  /^-\s*(?:\[([ xX])\]\s*)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))(?:\s+(#[^\s]+))?\s+(.*)$/;

/**
 * Format a stray thought into a distraction jot line.
 *
 * @param text - The raw distraction thought
 * @param options - Optional tag and timestamp override
 * @returns Formatted jot line, e.g. `- 3:42 PM #uni  call the bank`
 */
export function formatJotLine(
  text: string,
  options?: { tag?: string | null; date?: Date }
): string {
  const date = options?.date ?? new Date();
  const timeStr = format(date, "h:mm a");
  const cleanTag = options?.tag?.trim();
  const tagPart = cleanTag ? ` #${cleanTag.replace(/^#/, "")}` : "";
  return `- ${timeStr}${tagPart}  ${text.trim()}`;
}

/**
 * Whether a given line is a distraction jot (active or completed).
 */
export function isJotLine(line: string): boolean {
  return JOT_REGEX.test(line.trim());
}

/**
 * Whether a given line is a completed distraction jot.
 */
export function isCompletedJotLine(line: string): boolean {
  const match = line.trim().match(JOT_REGEX);
  if (!match) return false;
  return match[1]?.toLowerCase() === "x";
}

/**
 * Toggle the completed status of a jot line.
 * Turns `- 3:42 PM ...` into `- [x] 3:42 PM ...` and vice versa.
 */
export function toggleJotLine(line: string): string {
  const trimmed = line.trim();
  const match = trimmed.match(JOT_REGEX);
  if (!match) return line;

  const isCompleted = match[1]?.toLowerCase() === "x";
  if (isCompleted) {
    // Remove [x] or [X]
    return line.replace(/^(\s*)-\s*\[[xX]\]\s*/, "$1- ");
  }
  // Add [x]
  return line.replace(/^(\s*)-\s*(?:\[\s*\]\s*)?/, "$1- [x] ");
}

/**
 * Count total, completed, and pending jots in text.
 */
export function countJots(content: string): {
  total: number;
  completed: number;
  pending: number;
} {
  let total = 0;
  let completed = 0;
  let pending = 0;

  for (const line of content.split("\n")) {
    const match = line.trim().match(JOT_REGEX);
    if (match) {
      total++;
      if (match[1]?.toLowerCase() === "x") completed++;
      else pending++;
    }
  }

  return { total, completed, pending };
}

/**
 * Remove all completed jots (`- [x] ...`) from notepad content,
 * preserving all regular notes, calculations, and active jots.
 */
export function clearCompletedJots(content: string): string {
  const lines = content.split("\n");
  const kept = lines.filter((line) => {
    const match = line.trim().match(JOT_REGEX);
    if (!match) return true;
    return match[1]?.toLowerCase() !== "x";
  });
  return kept.join("\n");
}

/**
 * Remove all jots (both active and completed) from notepad content,
 * leaving regular text and equations untouched.
 */
export function clearAllJots(content: string): string {
  const lines = content.split("\n");
  const kept = lines.filter((line) => !JOT_REGEX.test(line.trim()));
  return kept.join("\n");
}

/**
 * Locate the line and its character offsets corresponding to a caret position.
 */
export function getLineAtCaret(
  content: string,
  caret: number
): { lineIndex: number; lineText: string; start: number; end: number } {
  const lines = content.split("\n");
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineEnd = currentOffset + line.length;
    if (caret >= currentOffset && caret <= lineEnd) {
      return {
        lineIndex: i,
        lineText: line,
        start: currentOffset,
        end: lineEnd,
      };
    }
    currentOffset = lineEnd + 1; // +1 for \n
  }

  const lastIndex = Math.max(0, lines.length - 1);
  return {
    lineIndex: lastIndex,
    lineText: lines[lastIndex] ?? "",
    start: currentOffset,
    end: currentOffset,
  };
}
