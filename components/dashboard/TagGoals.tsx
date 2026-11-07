"use client";

/**
 * Weekly Tag Goals
 *
 * The quiet "Weekly goals" strip on Home and the right-click actions that set
 * goals. A goal is a target a person picks for themselves — it never looks at
 * planned timeblocks, and every minute focused on the tag counts toward it.
 *
 * There is no empty state: with no goals the strip is not rendered at all, and
 * goals are added from a context menu (on the strip, or on a tag row in "Where
 * the time went") or from the Manage tags form.
 */

import {
  type JSX,
  type MouseEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { format } from "date-fns";
import { Check, ChevronRight } from "lucide-react";
import { useFocus } from "@/hooks/useFocus";
import { useTag } from "@/hooks/useTag";
import {
  currentGoalWeek,
  formatGoalMinutes,
  parseGoalDuration,
  useTagGoals,
  weeklyTagSeconds,
} from "@/hooks/useTagGoals";
import { cn, getTagColor } from "@/lib/utils";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ── Context menu + editor ────────────────────────────────────────────────────

const SURFACE =
  "z-50 min-w-52 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xs outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";
const ITEM =
  "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40";

interface Point {
  x: number;
  y: number;
}

/**
 * Right-click actions for weekly goals.
 *
 * Call `open(event, tag)` from an `onContextMenu` (or `onClick`) handler with
 * the tag the pointer is on, or `null` when it is on no particular tag; render
 * `element` once anywhere in the tree.
 */
export function useTagGoalMenu(): {
  open: (event: MouseEvent, tag: string | null) => void;
  element: JSX.Element;
} {
  const [menu, setMenu] = useState<{ point: Point; tag: string | null } | null>(
    null,
  );
  const [editor, setEditor] = useState<{ point: Point; tag: string } | null>(
    null,
  );
  const goals = useTagGoals((s) => s.goals);
  const removeGoal = useTagGoals((s) => s.removeGoal);
  const savedTags = useTag((s) => s.savedTags);

  const open = useCallback((event: MouseEvent, tag: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setEditor(null);
    setMenu({ point: { x: event.clientX, y: event.clientY }, tag });
  }, []);

  // Defer so the menu finishes closing before the editor takes focus.
  const edit = (tag: string) => {
    const point = menu?.point ?? { x: 0, y: 0 };
    setTimeout(() => setEditor({ point, tag }), 0);
  };

  const tag = menu?.tag ?? null;
  const hasGoal = tag !== null && goals[tag] !== undefined;
  const others = savedTags.filter(
    (t) => t.t !== tag && goals[t.t] === undefined,
  );

  const element = (
    <>
      <Menu.Root
        open={!!menu}
        modal={false}
        onOpenChange={(next) => {
          if (!next) setMenu(null);
        }}
      >
        <Menu.Trigger
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none fixed size-px opacity-0"
          style={{ left: menu?.point.x ?? 0, top: menu?.point.y ?? 0 }}
        />
        <Menu.Portal>
          <Menu.Content
            align="start"
            sideOffset={2}
            collisionPadding={12}
            className={SURFACE}
            aria-label="Weekly goal actions"
            onContextMenu={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            {tag !== null && (
              <Menu.Item className={ITEM} onSelect={() => edit(tag)}>
                {hasGoal ? "Edit weekly goal" : `Set weekly goal for #${tag}`}
              </Menu.Item>
            )}
            {hasGoal && (
              <Menu.Item
                className={cn(ITEM, "text-destructive")}
                onSelect={() => removeGoal(tag!)}
              >
                Remove goal
              </Menu.Item>
            )}
            {tag !== null && (
              <Menu.Separator className="my-1.5 h-px bg-border" />
            )}
            <Menu.Sub>
              <Menu.SubTrigger className={ITEM} disabled={others.length === 0}>
                {tag === null ? "Add weekly goal" : "Add goal for another tag"}
                <ChevronRight className="ml-auto size-3.5 shrink-0" />
              </Menu.SubTrigger>
              <Menu.Portal>
                <Menu.SubContent
                  className={SURFACE}
                  sideOffset={4}
                  collisionPadding={12}
                >
                  {others.map((other) => (
                    <Menu.Item
                      key={other.t}
                      className={ITEM}
                      onSelect={() => edit(other.t)}
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: other.c }}
                      />
                      <span className="truncate">{other.t}</span>
                    </Menu.Item>
                  ))}
                </Menu.SubContent>
              </Menu.Portal>
            </Menu.Sub>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      <GoalEditor
        key={
          editor
            ? `${editor.tag}:${editor.point.x}:${editor.point.y}`
            : "closed"
        }
        target={editor}
        onClose={() => setEditor(null)}
      />
    </>
  );

  return { open, element };
}

/** Small popover with one duration field, anchored where the menu was. */
function GoalEditor({
  target,
  onClose,
}: {
  target: { point: Point; tag: string } | null;
  onClose: () => void;
}): JSX.Element {
  const goals = useTagGoals((s) => s.goals);
  const setGoal = useTagGoals((s) => s.setGoal);
  const current = target ? goals[target.tag] : undefined;
  const [text, setText] = useState(
    current !== undefined ? formatGoalMinutes(current) : "",
  );
  const [invalid, setInvalid] = useState(false);

  const save = () => {
    if (!target) return;
    const minutes = parseGoalDuration(text);
    if (minutes === null) {
      setInvalid(true);
      return;
    }
    setGoal(target.tag, minutes);
    onClose();
  };

  return (
    <Popover
      open={!!target}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <PopoverAnchor asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed size-px opacity-0"
          style={{ left: target?.point.x ?? 0, top: target?.point.y ?? 0 }}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={2}
        className="w-64 rounded-2xl p-4"
      >
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label
            htmlFor="tag-goal-input"
            className="text-sm font-semibold tracking-tight"
          >
            Weekly goal for #{target?.tag}
          </label>
          <div className="flex gap-2">
            <Input
              id="tag-goal-input"
              autoFocus
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setInvalid(false);
              }}
              placeholder="10h, 90m, 1h30"
              aria-invalid={invalid}
              aria-describedby="tag-goal-hint"
              className="h-9 flex-1 rounded-lg font-mono text-sm"
            />
            <Button type="submit" size="sm" className="h-9 rounded-lg px-3">
              Save
            </Button>
          </div>
          <p
            id="tag-goal-hint"
            className={cn(
              "text-xs",
              invalid ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {invalid
              ? "Enter a duration like 10h, 90m or 1h30."
              : "Counts all focus on this tag, Monday to Sunday."}
          </p>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// ── Home strip ───────────────────────────────────────────────────────────────

/** Human duration from seconds, e.g. "6h 20m". */
function spentLabel(seconds: number): string {
  return formatGoalMinutes(Math.floor(seconds / 60));
}

/**
 * Weekly goals with a small ring per tag. Renders nothing until focus
 * sessions load, and nothing at all when no goals are set.
 */
export function WeeklyGoals({
  className,
}: {
  className?: string;
}): JSX.Element | null {
  const { focusSessions, loadingFocusSessions } = useFocus();
  const savedTags = useTag((s) => s.savedTags);
  const goals = useTagGoals((s) => s.goals);
  const menu = useTagGoalMenu();

  const week = useMemo(() => currentGoalWeek(), []);
  const rows = useMemo(() => {
    const spent = weeklyTagSeconds(focusSessions, week.start, week.end);
    return Object.entries(goals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, minutes]) => {
        const seconds = spent.get(tag) ?? 0;
        const [color, wantsWhite] = getTagColor(savedTags, tag);
        return {
          tag,
          minutes,
          seconds,
          progress: Math.min(seconds / (minutes * 60), 1),
          reached: seconds >= minutes * 60,
          color,
          wantsWhite,
        };
      });
  }, [focusSessions, goals, savedTags, week]);

  if (loadingFocusSessions || rows.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          "min-w-0 rounded-xl bg-muted/40 px-2 pb-1.5 pt-3",
          className,
        )}
        role="group"
        aria-label="Weekly goals"
        onContextMenu={(event) => menu.open(event, null)}
      >
        <p className="mb-1 flex items-baseline justify-between gap-2 px-2 text-xs text-muted-foreground">
          <span>Weekly goals</span>
          <span>Week of {format(week.start, "MMM d")}</span>
        </p>
        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <button
              key={row.tag}
              type="button"
              onClick={(event) => menu.open(event, row.tag)}
              onContextMenu={(event) => menu.open(event, row.tag)}
              className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${row.tag}: ${spentLabel(row.seconds)} of ${formatGoalMinutes(row.minutes)} this week${row.reached ? ", goal reached" : ""}`}
            >
              <GoalRing
                progress={row.progress}
                reached={row.reached}
                color={row.color}
                wantsWhite={row.wantsWhite}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {row.tag}
                </span>
                <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">
                  <span className="text-foreground">
                    {spentLabel(row.seconds)}
                  </span>{" "}
                  of {formatGoalMinutes(row.minutes)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
      {menu.element}
    </>
  );
}

const RING_SIZE = 32;
const RING_STROKE = 3.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Progress ring in the tag's colour; fills solid with a check once reached. */
function GoalRing({
  progress,
  reached,
  color,
  wantsWhite,
}: {
  progress: number;
  reached: boolean;
  color: string;
  wantsWhite: boolean;
}): JSX.Element {
  return (
    <span
      className="relative grid size-8 shrink-0 place-items-center"
      aria-hidden
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill={reached ? color : "none"}
          strokeWidth={RING_STROKE}
          style={{
            stroke:
              "color-mix(in oklch, var(--muted-foreground) 20%, transparent)",
          }}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          opacity={progress > 0 ? 1 : 0}
        />
      </svg>
      {reached && (
        <Check
          className="absolute size-3.5"
          strokeWidth={3}
          style={{ color: wantsWhite ? "#fff" : "#000" }}
        />
      )}
    </span>
  );
}
