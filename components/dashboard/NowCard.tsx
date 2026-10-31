"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format, startOfDay } from "date-fns";
import { FaPlay } from "react-icons/fa6";
import { usePomo } from "@/hooks/PomoContext";
import { useCurrentBlock } from "@/hooks/useCurrentBlock";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useTag } from "@/hooks/useTag";
import { pomodoroHint, type TimeblockOccurrence } from "@/lib/timeblocks";
import { getTagColor } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const PANEL_CLASS = "rounded-2xl border bg-card p-5 shadow-xs";
const LINK_CLASS = "rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function NowCard() {
  const {
    today, current, next, freeUntil, progress, now, loading, titleOf,
    startOccurrence, isRunningOn, minutesLeft, minutesUntilNext, durationOf,
  } = useCurrentBlock();
  const { state } = usePomo();
  const savedTags = useTag((s) => s.savedTags);
  const tasks = useTasks((s) => s.tasks);
  const projects = useProjects((s) => s.projects);

  if (loading) return <NowCardSkeleton />;

  const task = current?.block.taskUid
    ? tasks.find((t) => t.uid === current.block.taskUid && !t.deletedAt)
    : undefined;
  const project = projects.find((p) =>
    (current?.block.projectUid && p.uid === current.block.projectUid) ||
    (task?.projectId != null && p.id === task.projectId)
  );
  const color = current ? getTagColor(savedTags, current.block.tag)[0] : undefined;
  const hint = current ? pomodoroHint(durationOf(current), state.pomodoroSettings) : null;

  return (
    <section className={PANEL_CLASS} aria-labelledby="now-card-title">
      <h2 id="now-card-title" className="text-sm font-semibold tracking-tight">Now</h2>

      {current ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                <p className="truncate text-base font-medium" title={titleOf(current)}>{titleOf(current)}</p>
              </div>
              {(project || task) && (
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  {project && <Link className={LINK_CLASS} href={`/projects?project=${project.id}`}>{project.title}</Link>}
                  {project && task?.uid && <span aria-hidden="true">·</span>}
                  {task?.uid && <Link className={LINK_CLASS} href={`/projects?task=${encodeURIComponent(task.uid)}`}>View task</Link>}
                </p>
              )}
              <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                {format(current.start, "h:mm a")} – {format(current.end, "h:mm a")}
              </p>
            </div>
            {isRunningOn(current) ? (
              <span className="text-xs text-muted-foreground">In progress</span>
            ) : (
              <button
                type="button"
                onClick={() => startOccurrence(current)}
                className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <FaPlay className="size-3" aria-hidden="true" />
                Start block
              </button>
            )}
          </div>
          <div>
            <div
              role="progressbar"
              aria-label="Time block elapsed"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-valuetext={`${minutesLeft} min left`}
              className="h-1.5 overflow-hidden rounded-full bg-muted/60"
            >
              <div className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${progress * 100}%`, backgroundColor: color }} />
            </div>
            <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{minutesLeft} min left</span>
              {hint && <span className="font-mono tabular-nums" title="Focus and break minutes per Pomodoro">{hint.label}</span>}
            </div>
          </div>
        </div>
      ) : today.length === 0 ? (
        <div className="mt-3 rounded-xl bg-muted/40 px-3 py-3">
          <p className="text-sm font-medium">No time blocks today</p>
          <p className="mt-1 text-xs text-muted-foreground">Drag across the <Link href="/calendar" className={LINK_CLASS}>Calendar</Link> to plan your day.</p>
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium">
          {freeUntil ? <>Free until <span className="font-mono tabular-nums">{format(freeUntil, "h:mm a")}</span></> : "Nothing else planned today"}
        </p>
      )}

      {next && (
        <p className="mt-3 break-words text-xs text-muted-foreground">
          Next · {titleOf(next)} · <span className="font-mono tabular-nums">{minutesUntilNext <= 60 ? `in ${minutesUntilNext} min` : `at ${format(next.start, "h:mm a")}`}</span>
        </p>
      )}

      {today.length > 0 && <DayStrip occurrences={today} now={now} titleOf={titleOf} />}
    </section>
  );
}

function NowCardSkeleton() {
  return (
    <section className={PANEL_CLASS} aria-label="Loading today's time blocks" aria-busy="true">
      <Skeleton className="h-4 w-10 animate-none motion-safe:animate-pulse" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40 max-w-full animate-none motion-safe:animate-pulse" />
          <Skeleton className="h-3 w-28 animate-none motion-safe:animate-pulse" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg animate-none motion-safe:animate-pulse" />
      </div>
      <Skeleton className="mt-3 h-1.5 w-full rounded-full animate-none motion-safe:animate-pulse" />
      <Skeleton className="mt-3 h-3 w-40 animate-none motion-safe:animate-pulse" />
      <Skeleton className="mt-4 h-8 w-full rounded-xl animate-none motion-safe:animate-pulse" />
    </section>
  );
}

/** A quiet, clickable outline of the day; the current time stays on the track. */
function DayStrip({ occurrences, now, titleOf }: {
  occurrences: TimeblockOccurrence[];
  now: Date;
  titleOf: (occurrence: TimeblockOccurrence) => string;
}) {
  const router = useRouter();
  const savedTags = useTag((s) => s.savedTags);
  const hour = 3_600_000;
  const start = Math.max(startOfDay(now).getTime(), Math.min(now.getTime(), ...occurrences.map((o) => o.start.getTime())) - hour);
  const end = Math.min(addDays(startOfDay(now), 1).getTime(), Math.max(now.getTime(), ...occurrences.map((o) => o.end.getTime())) + hour);
  const span = Math.max(1, end - start);
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

  return (
    <div className="mt-4" role="group" aria-label="Today's time blocks">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-muted/60" aria-hidden="true" />
        {occurrences.map((occurrence) => {
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
              <span className="h-2 w-full rounded-full" style={{ backgroundColor: getTagColor(savedTags, occurrence.block.tag)[0] }} />
            </button>
          );
        })}
        <span
          className="pointer-events-none absolute top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${position(now.getTime())}%` }}
          title={`Now, ${format(now, "h:mm a")}`}
        ><span className="sr-only">Now, {format(now, "h:mm a")}</span></span>
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
