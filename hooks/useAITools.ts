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
import { useTasks } from "@/hooks/useTasks";
import { isTaskOverdue, matchesTask, taskDeadline, taskMinutes, dateInput, descriptionText } from "@/lib/tasks";
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
  const { projects } = useProjects();
  const { tasks, addTask, updateTask } = useTasks();
  const { state: timerState, start, pause, setMode } = usePomo();
  const { tag: activeTag, setTag } = useTag();
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
          return { projects: projects.map((p) => ({ id: p.id, title: p.title, archived: p.status === "Closed" })),
            tasks: tasks.filter((t) => !t.deletedAt).map((t) => ({ id: t.id, projectId: t.projectId ?? null, parentId: t.parentId ?? null, description: descriptionText(t.description),
              title: t.title, completed: !!t.completedAt, tags: t.tags, deadline: taskDeadline(t)?.toISOString() ?? null,
              estimateMinutes: t.estimateMinutes, actualMinutes: taskMinutes(t, focusSessions), priority: t.priority })) };
        }
        case "getUpcomingTasks": {
          const now = new Date();
          const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
          const end = new Date(now); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999);
          const due = tasks.filter((t) => !t.deletedAt && !t.completedAt && taskDeadline(t) && !projects.some((p) => p.id === t.projectId && p.status === "Closed"));
          const shape = (list: typeof tasks) => list.map((t) => ({ id: t.id, title: t.title, parentId: t.parentId ?? null, description: descriptionText(t.description), project: projects.find((p) => p.id === t.projectId)?.title || "Inbox", due: taskDeadline(t)?.toISOString(), estimateMinutes: t.estimateMinutes }));
          return { overdue: shape(due.filter((t) => isTaskOverdue(t, now))),
            today: shape(due.filter((t) => matchesTask(t, { date: "today" }, now) && !isTaskOverdue(t, now))),
            tomorrow: shape(due.filter((t) => matchesTask(t, { date: "today" }, tomorrow))),
            next7days: shape(due.filter((t) => taskDeadline(t)! <= end && taskDeadline(t)! > tomorrow && !matchesTask(t, { date: "today" }, tomorrow))) };
        }

        case "getTimerState": {
          return {
            mode: timerState.mode,
            phase: timerState.phase,
            isRunning: timerState.isRunning,
            elapsedMinutes: Math.round(timerState.elapsedSeconds / 60),
            activeTag: timerState.task?.tag || activeTag || null,
            task: timerState.task || null,
            pomodoro: timerState.pomodoroSettings,
            completedPomodorosInCycle: timerState.completedPomodoros,
            onLongBreak: timerState.isLongBreak,
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

        case "createTask": {
          const title = str(input, "title");
          const projectId = typeof input.projectId === "number" ? input.projectId : null;
          if (!title) return { ok: false, message: "A task title is required." };
          if (projectId !== null && !projects.some((p) => p.id === projectId)) return { ok: false, message: "Project not found." };
          const dueISO = str(input, "dueDateISO");
          const dateOnly = !!dueISO && /^\d{4}-\d{2}-\d{2}$/.test(dueISO);
          const dueDate = dueISO ? new Date(dateOnly ? `${dueISO}T00:00:00` : dueISO) : null;
          if (dueDate && !Number.isFinite(dueDate.getTime())) return { ok: false, message: "Invalid deadline." };
          const tags = Array.isArray(input.tags) ? input.tags.filter((t): t is string => typeof t === "string" && useTag.getState().savedTags.some((saved) => saved.t === t)) : [];
          await addTask(title, { projectId, parentId: typeof input.parentId === "number" ? input.parentId : null, description: str(input, "description") || "", tags, primaryTag: tags[0] || null,
            dueDate, dueDay: dateOnly ? dateInput(dueDate) : null, dueTime: !!dueDate && !dateOnly,
            estimateMinutes: Math.max(0, num(input, "estimateMinutes", 0)), priority: Math.max(0, Math.min(3, num(input, "priority", 0))) });
          return { ok: true, message: `Created "${title}".` };
        }
        case "completeTask": {
          const taskId = num(input, "taskId", -1);
          if (!tasks.some((t) => t.id === taskId && !t.deletedAt)) return { ok: false, message: "Task not found." };
          await updateTask(taskId, { completedAt: new Date() });
          return { ok: true, message: "Task completed." };
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
      tasks,
      addTask,
      updateTask,
      timerState,
      activeTag,
      start,
      pause,
      setMode,
      setTag,
      webhook,
      appendContent,
    ]
  );
}
