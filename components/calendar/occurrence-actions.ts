import { useTimeblocks, type SeriesScope } from "@/hooks/useTimeblocks";
import type { TimeBlock } from "@/lib/db";
import { blockKey, dayKey, type TimeblockOccurrence } from "@/lib/timeblocks";

/**
 * Keep repeat rules on the source row and apply whole-series time changes to
 * detached rows as well. The shared store deliberately treats detached times
 * separately, while the calendar's "All in series" choice includes them.
 */
export async function editCalendarOccurrence(
  occurrence: TimeblockOccurrence,
  updates: Partial<TimeBlock>,
  scope: SeriesScope,
) {
  const store = useTimeblocks.getState();
  const seriesUid = occurrence.block.recurrence
    ? occurrence.block.uid
    : occurrence.block.seriesUid;
  const source = seriesUid
    ? store.timeblocks.find((block) => block.uid === seriesUid)
    : undefined;
  if (scope !== "all" || !source?.recurrence) {
    await store.editOccurrence(occurrence, updates, scope);
    return;
  }
  const { recurrence, startTime, endTime, ...details } = updates;
  const start = startTime || occurrence.start;
  const end = endTime || occurrence.end;
  const changedTime = +start !== +occurrence.start || +end !== +occurrence.end;
  const detached = store.timeblocks.filter(
    (block) => block.seriesUid === seriesUid,
  );
  await store.editOccurrence(
    { ...occurrence, block: source },
    changedTime ? { ...details, startTime: start, endTime: end } : details,
    "all",
  );
  if (changedTime) {
    const delta = +start - +occurrence.start;
    const duration = +end - +start;
    for (const block of detached) {
      const previousStart = new Date(block.startTime);
      const shiftedStart = new Date(+previousStart + delta);
      await store.editOccurrence(
        {
          key: blockKey(block),
          block,
          start: previousStart,
          end: new Date(block.endTime),
          day: dayKey(previousStart),
          recurring: true,
        },
        {
          startTime: shiftedStart,
          endTime: new Date(+shiftedStart + duration),
        },
        "this",
      );
    }
  }
  // Passing recurrence through editOccurrence("all") would copy the rule onto
  // detached rows. Those must stay single occurrences, even after a rule edit.
  if (Object.prototype.hasOwnProperty.call(updates, "recurrence"))
    await store.editTimeblock(source.id!, { recurrence });
}
