/**
 * AI Tools
 *
 * Tool definitions shared by the chat route and the browser.
 *
 * Every tool runs **in the browser**, never on the server: your focus sessions,
 * projects, and settings live in IndexedDB on this device and are never uploaded
 * to run a chat. The route declares the schemas so the model knows what it can
 * ask for; the client executes the call and streams the result back.
 *
 * Tools split into two kinds:
 * - **Read** tools answer questions and run immediately.
 * - **Write** tools change something, and are held for confirmation. The model
 *   proposes, you approve, and only then does anything happen.
 */

import { tool } from "ai";
import { z } from "zod";

/** Tools that change data. These wait for explicit approval in the thread. */
export const CONFIRM_TOOLS = [
  "startTimer",
  "stopTimer",
  "logSession",
  "createIssue",
  "closeIssue",
  "sendWebhookMessage",
  "appendToNotepad",
] as const;

export type ConfirmToolName = (typeof CONFIRM_TOOLS)[number];

export function needsConfirmation(name: string): name is ConfirmToolName {
  return (CONFIRM_TOOLS as readonly string[]).includes(name);
}

/** What the model is told a rejected call returned. */
export const DECLINED_RESULT = {
  ok: false,
  message: "The user declined this action. Do not retry it.",
};

export const AI_TOOLS = {
  // ── Read ──────────────────────────────────────────────────────────────────

  getFocusSummary: tool({
    description:
      "Total focus time, session count, and daily average over the last N days. Use this before making any claim about how much the user has focused.",
    inputSchema: z.object({
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .describe("How many days back to include, counting today."),
    }),
  }),

  getTagBreakdown: tool({
    description:
      "Focus time grouped by tag over the last N days, so you can say what the user actually spent time on.",
    inputSchema: z.object({
      days: z.number().int().min(1).max(365),
    }),
  }),

  listSessions: tool({
    description:
      "Individual focus sessions, newest first. Use when the user asks about specific sessions, times of day, or a particular tag.",
    inputSchema: z.object({
      days: z.number().int().min(1).max(365),
      tag: z.string().optional().describe("Only sessions with this tag."),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  }),

  getProjectsOverview: tool({
    description:
      "All projects with their milestones, issue counts, open/closed status, budget, and version.",
    inputSchema: z.object({}),
  }),

  getUpcomingIssues: tool({
    description:
      "Issues that are overdue or due today, tomorrow, or in the next seven days.",
    inputSchema: z.object({}),
  }),

  getTimerState: tool({
    description:
      "What the timer is doing right now: mode, phase, whether it is running, elapsed time, and the active tag.",
    inputSchema: z.object({}),
  }),

  // ── Write — every one of these is confirmed by the user first ─────────────

  startTimer: tool({
    description:
      "Start a focus session. Ask before assuming a tag; the user confirms this before it runs.",
    inputSchema: z.object({
      mode: z.enum(["standard", "pomodoro"]).default("standard"),
      tag: z.string().optional().describe("Tag to attach to the session."),
    }),
  }),

  stopTimer: tool({
    description: "Pause the running timer.",
    inputSchema: z.object({}),
  }),

  logSession: tool({
    description:
      "Record a focus session that happened away from the timer. Times are ISO 8601 strings.",
    inputSchema: z.object({
      tag: z.string(),
      startISO: z.string().describe("Session start, ISO 8601."),
      endISO: z.string().describe("Session end, ISO 8601."),
    }),
  }),

  createIssue: tool({
    description:
      "Add an issue to a milestone. Call getProjectsOverview first to find the milestone id.",
    inputSchema: z.object({
      milestoneId: z.number().int(),
      title: z.string(),
      label: z.string().default("Task"),
      description: z.string().default(""),
      dueDateISO: z.string().optional(),
    }),
  }),

  closeIssue: tool({
    description:
      "Mark an issue as done. Call getUpcomingIssues or getProjectsOverview first to find the issue id.",
    inputSchema: z.object({
      issueId: z.number().int(),
    }),
  }),

  sendWebhookMessage: tool({
    description:
      "Send a message to the user's configured Discord webhook. Use when they ask to send, post, or share something.",
    inputSchema: z.object({
      message: z.string().max(1800),
    }),
  }),

  appendToNotepad: tool({
    description:
      "Append text to the user's notepad. Use when they ask to save, note, or keep something.",
    inputSchema: z.object({
      text: z.string(),
    }),
  }),
};

export type AIToolName = keyof typeof AI_TOOLS;

/** Human-readable summary of a pending write, shown on the confirmation card. */
export function describeToolCall(name: string, input: unknown): string {
  const value = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "startTimer":
      return `Start a ${value.mode ?? "standard"} session${
        value.tag ? ` tagged #${value.tag}` : ""
      }.`;
    case "stopTimer":
      return "Pause the running timer.";
    case "logSession":
      return `Log a session tagged #${value.tag} from ${value.startISO} to ${value.endISO}.`;
    case "createIssue":
      return `Create the issue "${value.title}"${
        value.dueDateISO ? `, due ${value.dueDateISO}` : ""
      }.`;
    case "closeIssue":
      return `Mark issue #${value.issueId} as done.`;
    case "sendWebhookMessage":
      return `Send this to your webhook:\n\n${value.message}`;
    case "appendToNotepad":
      return `Add this to your notepad:\n\n${value.text}`;
    default:
      return `Run ${name}.`;
  }
}

/** Short label for the tool chip shown while a read tool runs. */
export const TOOL_LABELS: Record<string, string> = {
  getFocusSummary: "Reading focus totals",
  getTagBreakdown: "Reading tag breakdown",
  listSessions: "Reading sessions",
  getProjectsOverview: "Reading projects",
  getUpcomingIssues: "Reading due issues",
  getTimerState: "Checking the timer",
  startTimer: "Start timer",
  stopTimer: "Pause timer",
  logSession: "Log session",
  createIssue: "Create issue",
  closeIssue: "Close issue",
  sendWebhookMessage: "Send webhook message",
  appendToNotepad: "Save to notepad",
};
