/**
 * Jot to Task
 *
 * Turns a distraction jot into a task using the same quick-add parser as
 * Projects, so `#tag`, `@Project`, `!high`, `~1h`, `by Friday` and
 * `every mon` all work. A jot stamped with a session tag keeps that tag when
 * the text names none. The jot is ticked off, and the toast offers to open
 * the task or undo both steps.
 *
 * @fileoverview Convert notepad jots into tasks with undo
 * @author BIT Focus Development Team
 */

import { toast } from "sonner";
import { FaListCheck } from "react-icons/fa6";
import { useNotepad } from "@/hooks/useNotepad";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { parseTaskInput, parsedToTaskFields } from "@/lib/task-parse";
import { JOT_REGEX, toggleJotLine } from "./jot-utils";

const UNDO_WINDOW_MS = 8000;

/** Swap the first line equal to `from` for `to`; content may have moved since. */
function replaceLine(content: string, from: string, to: string): string | null {
  const lines = content.split("\n");
  const index = lines.indexOf(from);
  if (index === -1) return null;
  lines[index] = to;
  return lines.join("\n");
}

/**
 * Create a task from a jot line, tick the jot off, and offer Open and Undo.
 *
 * @param line - The jot line as it appears in the notepad.
 * @param open - Navigates to a task by uid.
 */
export async function makeTaskFromJot(
  line: string,
  open: (taskUid: string) => void
): Promise<void> {
  const match = line.trim().match(JOT_REGEX);
  if (!match) return;
  const text = match[4].trim();
  const sessionTag = match[3]?.replace(/^#/, "");

  try {
    if (useProjects.getState().projects.length === 0) {
      await useProjects.getState().loadProjects();
    }
    const now = new Date();
    const projects = useProjects.getState().projects;
    // Time ranges plan calendar blocks in Projects; here they stay in the title
    const first = parseTaskInput(text, { now, projects });
    const ignore = first.tokens.filter((t) => t.kind === "block").map((t) => t.key);
    const parsed = ignore.length ? parseTaskInput(text, { now, projects, ignore }) : first;
    if (!parsed.title.trim()) {
      toast.error("This jot has no text to use as a task title");
      return;
    }
    if (parsed.tags.length === 0 && sessionTag) parsed.tags = [sessionTag];

    const id = await useTasks
      .getState()
      .addTask(parsed.title, { projectId: null, ...parsedToTaskFields(parsed, now) });
    const uid = useTasks.getState().tasks.find((task) => task.id === id)?.uid;

    // Tick the jot off, unless it already is
    const ticked = match[1]?.toLowerCase() === "x" ? line : toggleJotLine(line);
    if (ticked !== line) {
      const notepad = useNotepad.getState();
      const updated = replaceLine(notepad.content, line, ticked);
      if (updated !== null) notepad.setContent(updated);
    }

    toast("Task added", {
      icon: <FaListCheck />,
      description: parsed.title,
      duration: UNDO_WINDOW_MS,
      // Sonner puts cancel first, so this reads "Open  Undo"
      cancel: uid
        ? { label: "Open", onClick: () => open(uid) }
        : undefined,
      action: {
        label: "Undo",
        onClick: () => {
          useTasks
            .getState()
            .removeForever(id)
            .then(() => {
              if (ticked !== line) {
                const notepad = useNotepad.getState();
                const restored = replaceLine(notepad.content, ticked, line);
                if (restored !== null) notepad.setContent(restored);
              }
              toast("Task removed");
            })
            .catch(() => toast.error("Couldn't remove the task."));
        },
      },
    });
  } catch {
    toast.error("Could not add task");
  }
}
