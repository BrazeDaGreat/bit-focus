/**
 * CSV Export Helper for Focus Sessions
 *
 * Serializes a list of focus sessions to CSV and triggers a browser
 * download. Used by the Focus Table page to export the filtered set.
 *
 * @fileoverview Client-side CSV download for focus sessions
 * @author BIT Focus Development Team
 * @since v0.18.11
 */

import type { FocusSession } from "@/hooks/useFocus";
import dayjs from "dayjs";

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Downloads the given sessions as `focus-sessions-YYYY-MM-DD.csv`.
 *
 * Columns: id, tag, startTime (ISO), endTime (ISO), durationMinutes.
 */
export function exportSessionsCsv(sessions: FocusSession[]): void {
  const header = "id,tag,startTime,endTime,durationMinutes";
  const rows = sessions.map((s) => {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    return [
      String(s.id ?? ""),
      escapeCsvField(s.tag),
      start.toISOString(),
      end.toISOString(),
      minutes.toFixed(2),
    ].join(",");
  });

  const blob = new Blob([[header, ...rows].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `focus-sessions-${dayjs().format("YYYY-MM-DD")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
