/**
 * Undoable Focus Session Actions
 *
 * Adds, edits, deletes and bulk re-tags that show a toast with an Undo button.
 * The store returns what each action replaced, and Undo writes it straight
 * back. Sessions don't award reward points (only the live timer does), so
 * undoing never touches the points balance.
 *
 * @fileoverview Focus session actions with undo toasts
 * @author BIT Focus Development Team
 * @since v0.23.0-beta
 */

import { toast } from "sonner";
import { FaTrash, FaTag, FaPencil, FaPlus } from "react-icons/fa6";
import { useFocus, type FocusSession } from "@/hooks/useFocus";

const UNDO_WINDOW_MS = 8000;

function plural(count: number): string {
  return count === 1 ? "session" : "sessions";
}

/**
 * Delete focus sessions and offer to undo.
 *
 * @param ids - Session ids to delete.
 */
export async function deleteSessionsWithUndo(ids: number[]): Promise<void> {
  const store = useFocus.getState();
  const removed =
    ids.length === 1
      ? [await store.removeFocusSession(ids[0])].filter((s) => !!s)
      : await store.bulkRemoveFocusSessions(ids);

  if (removed.length === 0) return;

  toast(`Deleted ${removed.length} ${plural(removed.length)}`, {
    icon: <FaTrash />,
    duration: UNDO_WINDOW_MS,
    action: {
      label: "Undo",
      onClick: () => {
        useFocus
          .getState()
          .restoreFocusSessions(removed)
          .then(() => toast(`Restored ${removed.length} ${plural(removed.length)}`))
          .catch(() => toast.error("Couldn't restore the sessions."));
      },
    },
  });
}

/**
 * Re-tag focus sessions and offer to undo.
 *
 * @param ids - Session ids to re-tag.
 * @param tag - New tag.
 */
export async function retagSessionsWithUndo(ids: number[], tag: string): Promise<void> {
  const previous = await useFocus.getState().bulkUpdateTag(ids, tag);

  toast(`Tagged ${ids.length} ${plural(ids.length)} #${tag}`, {
    icon: <FaTag />,
    duration: UNDO_WINDOW_MS,
    action: {
      label: "Undo",
      onClick: () => {
        useFocus
          .getState()
          .restoreTags(previous)
          .then(() => toast("Previous tags restored"))
          .catch(() => toast.error("Couldn't restore the previous tags."));
      },
    },
  });
}

/**
 * Edit a focus session and offer to undo.
 *
 * @param id - Session id to edit.
 * @param changes - Fields to change.
 */
export async function editSessionWithUndo(
  id: number,
  changes: Partial<FocusSession>
): Promise<void> {
  const previous = await useFocus.getState().editFocusSession(id, changes);
  if (!previous) return;

  toast("Session updated", {
    icon: <FaPencil />,
    duration: UNDO_WINDOW_MS,
    action: {
      label: "Undo",
      onClick: () => {
        // Writing the whole old row back also drops any field the edit added
        useFocus
          .getState()
          .restoreFocusSessions([previous])
          .then(() => toast("Previous session restored"))
          .catch(() => toast.error("Couldn't restore the session."));
      },
    },
  });
}

/**
 * Add a focus session by hand and offer to undo.
 *
 * @param tag - Session tag.
 * @param startTime - When the session started.
 * @param endTime - When the session ended.
 */
export async function addSessionWithUndo(
  tag: string,
  startTime: Date,
  endTime: Date
): Promise<void> {
  const id = await useFocus.getState().addFocusSession(tag, startTime, endTime);

  toast("Session added", {
    icon: <FaPlus />,
    duration: UNDO_WINDOW_MS,
    action: {
      label: "Undo",
      onClick: () => {
        useFocus
          .getState()
          .removeFocusSession(id)
          .then(() => toast("Session removed"))
          .catch(() => toast.error("Couldn't remove the session."));
      },
    },
  });
}
