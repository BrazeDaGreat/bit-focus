"use client";

import { useRouter } from "next/navigation";
import { addDays, format, startOfDay } from "date-fns";
import { FaPlay } from "react-icons/fa6";
import { useCurrentBlock } from "@/hooks/useCurrentBlock";
import { useTag } from "@/hooks/useTag";
import type { TimeblockOccurrence } from "@/lib/timeblocks";
import { getTagColor } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { durationLabel } from "@/components/calendar/calendar-shared";

export default function NowCard() {
  const {
    today, current, next, freeUntil, now, loading, titleOf,
    startOccurrence, isRunningOn, minutesLeft,
  } = useCurrentBlock();
  const savedTags = useTag((s) => s.savedTags);

  if (loading) {
    return (
      <Skeleton
        className="mt-3 h-24 w-full rounded-xl bg-muted/40 animate-none motion-safe:animate-pulse"
        aria-label="Loading today's time blocks"
        aria-busy="true"
      />
    );
  }
  if (today.length === 0) return null;

  const running = current ? isRunningOn(current) : false;
  const planned = plannedMinutes(today, startOfDay(now), addDays(startOfDay(now), 1));

  return (
    <div className="mt-3 min-w-0 rounded-xl bg-muted/40 px-4 py-3" role="group" aria-label="Now">
      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>Now</span>
        <span>
          <span className="font-mono tabular-nums text-foreground">{durationLabel(planned)}</span> planned today
        </span>
      </p>
      {current ? (
        <div className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: getTagColor(savedTags, current.block.tag)[0] }}
                aria-hidden="true"
              />
              <p className="truncate text-sm font-medium" title={titleOf(current)}>{titleOf(current)}</p>
            </div>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {running ? `${minutesLeft} min left` : `until ${format(current.end, "h:mm a")}`}
            </span>
          </div>
          {running ? (
            <span className="text-xs text-muted-foreground">In progress</span>
          ) : (
            <button
              type="button"
              onClick={() => startOccurrence(current)}
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FaPlay className="size-2.5" aria-hidden="true" />
              Start block
            </button>
          )}
        </div>
      ) : (
        <p className="flex min-h-7 items-center gap-1 text-sm font-medium">
          {freeUntil ? <>Free until <span className="font-mono tabular-nums">{format(freeUntil, "h:mm a")}</span></> : "Nothing else planned today"}
        </p>
      )}

      {next && (
        <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={`Next · ${titleOf(next)} · at ${format(next.start, "h:mm a")}`}>
          <span className="shrink-0">Next ·</span>
          <span className="truncate">{titleOf(next)}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0 font-mono tabular-nums">at {format(next.start, "h:mm a")}</span>
        </p>
      )}

      <DayStrip occurrences={today} now={now} titleOf={titleOf} />
    </div>
  );
}

/** Minutes of the day covered by blocks; overlapping blocks count once. */
function plannedMinutes(occurrences: TimeblockOccurrence[], dayStart: Date, dayEnd: Date) {
  const spans = occurrences
    .map((o) => [Math.max(+o.start, +dayStart), Math.min(+o.end, +dayEnd)] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let reach = -Infinity;
  for (const [start, end] of spans) {
    if (end <= reach) continue;
    total += end - Math.max(start, reach);
    reach = end;
  }
  return Math.round(total / 60_000);
}

/** A compact day range; elapsed segment fills and the marker share one track. */
function DayStrip({ occurrences, now, titleOf }: {
  occurrences: TimeblockOccurrence[];
  now: Date;
  titleOf: (occurrence: TimeblockOccurrence) => string;
}) {
  const router = useRouter();
  const savedTags = useTag((s) => s.savedTags);
  const hour = 3_600_000;
  const dayStart = startOfDay(now).getTime();
  const dayEnd = addDays(startOfDay(now), 1).getTime();
  const firstStart = Math.max(dayStart, Math.min(...occurrences.map((o) => o.start.getTime())));
  const lastEnd = Math.min(dayEnd, Math.max(...occurrences.map((o) => o.end.getTime())));
  const rangeStart = Math.max(dayStart, firstStart - hour / 2);
  const rangeEnd = Math.min(dayEnd, lastEnd + hour / 2);
  const span = Math.min(dayEnd - dayStart, Math.max(3 * hour, rangeEnd - rangeStart));
  const start = Math.max(dayStart, Math.min(dayEnd - span, (rangeStart + rangeEnd - span) / 2));
  const end = start + span;
  const position = (time: number) => Math.max(0, Math.min(100, (time - start) / span * 100));
  const stepHours = Math.max(1, Math.ceil(span / hour / 3));
  const tick = new Date(start);
  tick.setMinutes(0, 0, 0);
  if (tick.getTime() < start) tick.setHours(tick.getHours() + 1);
  const ticks: Date[] = [];
  while (tick.getTime() < end) {
    if (position(tick.getTime()) >= 5 && position(tick.getTime()) <= 95) ticks.push(new Date(tick));
    tick.setHours(tick.getHours() + stepHours);
  }
  // Keep the range close to the plan even when now is many hours away.
  const markerLabel = `Now, ${format(now, "h:mm a")}${now.getTime() < start ? ", before shown range" : now.getTime() > end ? ", after shown range" : ""}`;

  return (
    <div className="mt-1" role="group" aria-label="Today's time blocks; filled segments show elapsed time">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-[9px] h-1.5 rounded-full bg-muted/60" aria-hidden="true" />
        {occurrences.map((occurrence) => {
          const visibleStart = Math.max(start, occurrence.start.getTime());
          const visibleEnd = Math.min(end, occurrence.end.getTime());
          const elapsed = Math.max(0, Math.min(1, (now.getTime() - visibleStart) / Math.max(1, visibleEnd - visibleStart)));
          const color = getTagColor(savedTags, occurrence.block.tag)[0];
          const label = `${titleOf(occurrence)}, ${format(occurrence.start, "h:mm a")} to ${format(occurrence.end, "h:mm a")}`;
          return (
            <button
              key={occurrence.key}
              type="button"
              aria-label={`View ${label} in Calendar`}
              title={label}
              onClick={() => router.push(`/calendar?date=${format(now, "yyyy-MM-dd")}&view=day&block=${encodeURIComponent(occurrence.key)}`)}
              className="absolute top-0 flex h-6 items-center rounded-lg transition-colors duration-150 hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: `${position(occurrence.start.getTime())}%`, width: `${position(occurrence.end.getTime()) - position(occurrence.start.getTime())}%` }}
            >
              <span className="relative h-1.5 w-full overflow-hidden rounded-full" aria-hidden="true">
                <span className="absolute inset-0 opacity-40" style={{ backgroundColor: color }} />
                <span className="absolute inset-y-0 left-0 rounded-full motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${elapsed * 100}%`, backgroundColor: color }} />
              </span>
            </button>
          );
        })}
        <span
          className="pointer-events-none absolute top-1.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${position(now.getTime())}%` }}
          title={markerLabel}
        ><span className="sr-only">{markerLabel}</span></span>
      </div>
      <div className="relative h-4 font-mono text-[10px] leading-none tabular-nums text-muted-foreground" aria-hidden="true">
        {ticks.map((time) => (
          <span key={time.getTime()} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${position(time.getTime())}%` }}>
            <span className="mx-auto mb-0.5 block h-1 w-px bg-border" />
            {format(time, "ha")}
          </span>
        ))}
      </div>
    </div>
  );
}
