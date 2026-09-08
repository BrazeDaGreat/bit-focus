/**
 * AI Context Sources
 *
 * What gets attached to a chat, chosen per conversation rather than by one
 * global switch. Each source renders a compact plain-text block and reports its
 * own token estimate, so the cost of attaching something is visible before you
 * send.
 *
 * Attaching is optional even with tools available: a source puts data in the
 * prompt up front, while a tool lets the model fetch it when needed. Small,
 * always-relevant facts (who you are, what the timer is doing) are cheap to
 * attach; long histories are better left to tools.
 */

import dayjs from "dayjs";
import type { FocusSession } from "@/hooks/useFocus";
import type { Issue, Milestone, Project } from "@/hooks/useProjects";
import { reduceSessions } from "@/lib/utils";

export type ContextSourceId =
  | "profile"
  | "timer"
  | "focus7"
  | "focus30"
  | "tags"
  | "projects"
  | "rewards";

export interface ContextSourceMeta {
  id: ContextSourceId;
  label: string;
  description: string;
}

export const CONTEXT_SOURCES: ContextSourceMeta[] = [
  { id: "profile", label: "Profile", description: "Name and age" },
  { id: "timer", label: "Timer", description: "What the timer is doing now" },
  { id: "focus7", label: "Last 7 days", description: "Daily focus totals" },
  { id: "focus30", label: "Last 30 days", description: "Weekly focus totals" },
  { id: "tags", label: "Tags", description: "Time per tag, last 30 days" },
  { id: "projects", label: "Projects", description: "Open issues and due dates" },
  { id: "rewards", label: "Points", description: "Reward point balance" },
];

/** Everything a source might need. Missing pieces simply produce no block. */
export interface ContextInput {
  name?: string;
  dob?: Date | string | null;
  rewardPoints?: number;
  focusSessions: FocusSession[];
  projects?: Project[];
  milestones?: Milestone[];
  issues?: Issue[];
  timer?: {
    mode: string;
    phase: string;
    isRunning: boolean;
    elapsedSeconds: number;
    currentTag?: string;
  };
}

/** Roughly four characters per token — enough to size a budget, not a bill. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function minutesBetween(session: FocusSession): number {
  return Math.round(reduceSessions([session]) / 60);
}

function dailyTotals(sessions: FocusSession[], days: number): string {
  const lines: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayjs().subtract(i, "day");
    const key = day.format("YYYY-MM-DD");
    const minutes = sessions
      .filter((s) => dayjs(s.startTime).format("YYYY-MM-DD") === key)
      .reduce((sum, s) => sum + minutesBetween(s), 0);
    if (minutes > 0) lines.push(`${day.format("ddd D MMM")}: ${minutes}m`);
  }
  return lines.length ? lines.join("\n") : "No sessions recorded.";
}

function weeklyTotals(sessions: FocusSession[], weeks: number): string {
  const lines: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = dayjs().subtract(i * 7, "day");
    const start = end.subtract(7, "day");
    const minutes = sessions
      .filter((s) => {
        const at = dayjs(s.startTime);
        return at.isAfter(start) && !at.isAfter(end);
      })
      .reduce((sum, s) => sum + minutesBetween(s), 0);
    lines.push(
      `${start.format("D MMM")}–${end.format("D MMM")}: ${Math.round(
        minutes / 60
      )}h ${minutes % 60}m`
    );
  }
  return lines.join("\n");
}

/** Build one source's text block, or null when there is nothing to say. */
export function buildContextBlock(
  id: ContextSourceId,
  input: ContextInput
): string | null {
  switch (id) {
    case "profile": {
      const parts: string[] = [];
      if (input.name && input.name !== "NULL") parts.push(`Name: ${input.name}`);
      if (input.dob) {
        parts.push(`Age: ${dayjs().diff(dayjs(input.dob), "year")}`);
      }
      return parts.length ? `## Profile\n${parts.join("\n")}` : null;
    }

    case "timer": {
      if (!input.timer) return null;
      const t = input.timer;
      return [
        "## Timer",
        `Mode: ${t.mode}${t.mode === "pomodoro" ? ` (${t.phase})` : ""}`,
        `Running: ${t.isRunning ? "yes" : "no"}`,
        `Elapsed: ${Math.round(t.elapsedSeconds / 60)}m`,
        t.currentTag ? `Tag: #${t.currentTag}` : "Tag: none",
      ].join("\n");
    }

    case "focus7":
      return `## Focus, last 7 days\n${dailyTotals(input.focusSessions, 7)}`;

    case "focus30":
      return `## Focus, last 30 days (weekly)\n${weeklyTotals(
        input.focusSessions,
        4
      )}`;

    case "tags": {
      const since = dayjs().subtract(30, "day");
      const totals = new Map<string, number>();
      for (const session of input.focusSessions) {
        if (!dayjs(session.startTime).isAfter(since)) continue;
        const key = session.tag?.trim() || "Untagged";
        totals.set(key, (totals.get(key) ?? 0) + minutesBetween(session));
      }
      if (totals.size === 0) return null;
      const lines = [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, minutes]) => `${tag}: ${minutes}m`);
      return `## Time per tag, last 30 days\n${lines.join("\n")}`;
    }

    case "projects": {
      const projects = input.projects ?? [];
      const milestones = input.milestones ?? [];
      const issues = input.issues ?? [];
      if (projects.length === 0) return null;
      const lines = projects.map((project) => {
        const ms = milestones.filter((m) => m.projectId === project.id);
        const open = issues.filter(
          (i) =>
            i.status === "Open" && ms.some((m) => m.id === i.milestoneId)
        ).length;
        return `${project.title} (${project.status}) — ${ms.length} milestones, ${open} open issues`;
      });
      return `## Projects\n${lines.join("\n")}`;
    }

    case "rewards":
      return typeof input.rewardPoints === "number"
        ? `## Reward points\nBalance: ${(input.rewardPoints / 100).toFixed(2)}`
        : null;

    default:
      return null;
  }
}

/** Join the selected sources into one attachment block. */
export function buildContext(
  selected: ContextSourceId[],
  input: ContextInput
): string {
  const blocks = selected
    .map((id) => buildContextBlock(id, input))
    .filter((block): block is string => Boolean(block));
  if (blocks.length === 0) return "";
  return `The following is the user's own data, attached from BIT Focus. Treat it as fact.\n\n${blocks.join(
    "\n\n"
  )}`;
}
