/**
 * Undoable Focus Session Actions
 *
 * Deletes and bulk re-tags that show a toast with an Undo button. The store
 * returns what each action replaced, and Undo writes it straight back.
 *
 * @fileoverview Focus session actions with undo toasts
 * @author BIT Focus Development Team
 * @since v0.23.0-beta
 */

import { toast } from "sonner";
import { FaTrash, FaTag } from "react-icons/fa6";
import { useFocus } from "@/hooks/useFocus";

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
