"use client";

/**
 * AI Tool Runner
 *
 * Executes the tools declared in {@link AI_TOOLS} against local data. Everything
 * here runs in the browser against IndexedDB and the app's stores, so a chat can
 * answer questions about your sessions without any of that data being uploaded
 * to run the request.
 *
 * Read tools run as soon as the model asks. Write tools are handed back to the
 * thread as a pending confirmation and only reach this runner once approved.
 */

import { useCallback } from "react";
import dayjs from "dayjs";
import { useFocus } from "@/hooks/useFocus";
import { useProjects } from "@/hooks/useProjects";
import { usePomo } from "@/hooks/PomoContext";
import { useTag } from "@/hooks/useTag";
import { useConfig } from "@/hooks/useConfig";
import { useNotepad } from "@/hooks/useNotepad";
import { reduceSessions } from "@/lib/utils";
import { sendMessage } from "@/lib/webhook";

type ToolInput = Record<string, unknown>;

function num(input: ToolInput, key: string, fallback: number): number {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(input: ToolInput, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function useAITools() {
  const { focusSessions, addFocusSession } = useFocus();
  const {
    projects,
    milestones,
    issues,
    addIssue,
    updateIssue,
    getUpcomingIssues,
  } = useProjects();
  const { state: timerState, start, pause, setMode } = usePomo();
  const { setTag } = useTag();
  const { webhook } = useConfig();
  const appendContent = useNotepad((s) => s.appendContent);

  return useCallback(
    async (name: string, rawInput: unknown): Promise<unknown> => {
      const input = (rawInput ?? {}) as ToolInput;

      switch (name) {
        // ── Read ────────────────────────────────────────────────────────────
        case "getFocusSummary": {
          const days = num(input, "days", 7);
          const since = dayjs().subtract(days, "day");
          const inRange = focusSessions.filter((s) =>
            dayjs(s.startTime).isAfter(since)
          );
          const seconds = reduceSessions(inRange);
          return {
            days,
            totalMinutes: Math.round(seconds / 60),
            sessionCount: inRange.length,
            dailyAverageMinutes: Math.round(seconds / 60 / days),
            longestSessionMinutes: inRange.reduce((max, s) => {
              const mins =
                (new Date(s.endTime).getTime() -
                  new Date(s.startTime).getTime()) /
                60000;
              return Math.max(max, Math.round(mins));
            }, 0),
          };
        }

        case "getTagBreakdown": {
          const days = num(input, "days", 7);
          const since = dayjs().subtract(days, "day");
          const totals = new Map<string, { minutes: number; sessions: number }>();
          for (const session of focusSessions) {
            if (!dayjs(session.startTime).isAfter(since)) continue;
            const key = session.tag?.trim() || "Untagged";
            const entry = totals.get(key) ?? { minutes: 0, sessions: 0 };
            entry.minutes += Math.round(reduceSessions([session]) / 60);
            entry.sessions += 1;
            totals.set(key, entry);
          }
          return {
            days,
            tags: [...totals.entries()]
              .map(([tag, v]) => ({ tag, ...v }))
              .sort((a, b) => b.minutes - a.minutes),
          };
        }

        case "listSessions": {
          const days = num(input, "days", 7);
          const limit = num(input, "limit", 20);
          const tag = str(input, "tag");
          const since = dayjs().subtract(days, "day");
          return {
            sessions: focusSessions
              .filter((s) => dayjs(s.startTime).isAfter(since))
              .filter((s) => (tag ? s.tag === tag : true))
              .sort(
                (a, b) =>
                  new Date(b.startTime).getTime() -
                  new Date(a.startTime).getTime()
              )
              .slice(0, limit)
              .map((s) => ({
                id: s.id,
                tag: s.tag || "Untagged",
                start: dayjs(s.startTime).format("YYYY-MM-DD HH:mm"),
                minutes: Math.round(reduceSessions([s]) / 60),
              })),
          };
        }

        case "getProjectsOverview": {
          return {
            projects: projects.map((project) => {
              const projectMilestones = milestones.filter(
                (m) => m.projectId === project.id
              );
              return {
                id: project.id,
                title: project.title,
                status: project.status,
                version: project.version,
                milestones: projectMilestones.map((milestone) => {
                  const milestoneIssues = issues.filter(
                    (i) => i.milestoneId === milestone.id
                  );
                  return {
                    id: milestone.id,
                    title: milestone.title,
                    status: milestone.status,
                    deadline: milestone.deadline
                      ? dayjs(milestone.deadline).format("YYYY-MM-DD")
                      : null,
                    openIssues: milestoneIssues.filter(
                      (i) => i.status === "Open"
                    ).length,
                    totalIssues: milestoneIssues.length,
                  };
                }),
              };
            }),
          };
        }

        case "getUpcomingIssues": {
          const groups = getUpcomingIssues();
          const shape = (
            list: ReturnType<typeof getUpcomingIssues>["today"]
          ) =>
            list.map((issue) => ({
              id: issue.id,
              title: issue.title,
              status: issue.status,
              project: issue.project?.title,
              milestone: issue.milestone?.title,
              due: issue.dueDate
                ? dayjs(issue.dueDate).format("YYYY-MM-DD")
                : null,
            }));
          return {
            overdue: shape(groups.overdue),
            today: shape(groups.today),
            tomorrow: shape(groups.tomorrow),
            next7days: shape(groups.next7days),
          };
        }

        case "getTimerState": {
          return {
            mode: timerState.mode,
            phase: timerState.phase,
            isRunning: timerState.isRunning,
            elapsedMinutes: Math.round(timerState.elapsedSeconds / 60),
            activeTag: timerState.data?.tag || null,
            pomodoro: timerState.pomodoroSettings,
          };
        }

        // ── Write — reached only after the user approves ────────────────────
        case "startTimer": {
          const tag = str(input, "tag");
          const mode = str(input, "mode") === "pomodoro" ? "pomodoro" : "standard";
          if (tag) setTag(tag);
          setMode(mode);
          start();
          return { ok: true, message: `Started a ${mode} session.` };
        }

        case "stopTimer": {
          pause();
          return { ok: true, message: "Timer paused." };
        }

        case "logSession": {
          const tag = str(input, "tag") ?? "Untagged";
          const startISO = str(input, "startISO");
          const endISO = str(input, "endISO");
          if (!startISO || !endISO) {
            return { ok: false, message: "Start and end times are required." };
          }
          const startDate = new Date(startISO);
          const endDate = new Date(endISO);
          if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime()) ||
            endDate <= startDate
          ) {
            return { ok: false, message: "Those times are not a valid range." };
          }
          await addFocusSession(tag, startDate, endDate);
          return { ok: true, message: "Session logged." };
        }

        case "createIssue": {
          const milestoneId = num(input, "milestoneId", -1);
          const title = str(input, "title");
          if (milestoneId < 0 || !title) {
            return { ok: false, message: "A milestone and a title are required." };
          }
          const dueISO = str(input, "dueDateISO");
          await addIssue(
            milestoneId,
            title,
            str(input, "label") ?? "Task",
            dueISO ? new Date(dueISO) : undefined,
            str(input, "description") ?? ""
          );
          return { ok: true, message: `Created "${title}".` };
        }

        case "closeIssue": {
          const issueId = num(input, "issueId", -1);
          if (issueId < 0) return { ok: false, message: "An issue id is required." };
          await updateIssue(issueId, { status: "Close" });
          return { ok: true, message: "Issue closed." };
        }

        case "sendWebhookMessage": {
          const message = str(input, "message");
          if (!message) return { ok: false, message: "Nothing to send." };
          if (!webhook) {
            return {
              ok: false,
              message: "No webhook URL is set in the user's profile.",
            };
          }
          const sent = await sendMessage(message, webhook);
          return sent
            ? { ok: true, message: "Sent to the webhook." }
            : { ok: false, message: "The webhook rejected the message." };
        }

        case "appendToNotepad": {
          const text = str(input, "text");
          if (!text) return { ok: false, message: "Nothing to save." };
          appendContent(text);
          return { ok: true, message: "Saved to the notepad." };
        }

        default:
          return { ok: false, message: `Unknown tool: ${name}` };
      }
    },
    [
      focusSessions,
      addFocusSession,
      projects,
      milestones,
      issues,
      addIssue,
      updateIssue,
      getUpcomingIssues,
      timerState,
      start,
      pause,
      setMode,
      setTag,
      webhook,
      appendContent,
    ]
  );
}
