/**
 * Timer Completion Journal - Saving Finished Focus Without Losing or Doubling It
 *
 * Ending a focus session used to award points and announce success first,
 * then fire off one unawaited database write per stretch. A failed write lost
 * the session while the points stayed; a reload mid-write lost it silently.
 *
 * A finished session is now a {@link PendingCompletion}: written to a small
 * device-local journal before the timer clears, then saved to IndexedDB in a
 * single transaction. Every stretch carries a uid derived from the completion
 * id, so saving the same completion twice — a retry, a reload that replays the
 * journal, two overlapping flushes — inserts its rows exactly once. Points are
 * granted only by the call that actually inserted the rows, so they follow the
 * database rather than the number of attempts.
 *
 * @fileoverview Durable, idempotent saving of finished timer sessions.
 * @author BIT Focus Development Team
 * @since v0.24.0
 */

import type { FocusSegment } from "@/lib/timer-state";

/** localStorage key of the journal. Device-local: never synced or backed up. */
export const COMPLETION_JOURNAL_KEY = "pomoPendingCompletions";

/** A finished focus session that has not been confirmed saved yet. */
export interface PendingCompletion {
  /** Unique id; stretch uids are derived from it */
  id: string;
  tag: string;
  taskUid?: string;
  projectUid?: string;
  /** Active stretches to save, already merged by sessionSegments */
  segments: FocusSegment[];
  /** Reward points granted once the stretches are saved */
  points: number;
  /** Focused seconds, for messages */
  seconds: number;
  /** When the session ended (ms) */
  createdAt: number;
  /** Pomodoro review entry, recorded only after its focus rows are saved. */
  pomodoro?: { completed: boolean };
}

/** One focus row to insert, identified by a deterministic uid. */
export interface CompletionRow {
  uid: string;
  tag: string;
  startTime: Date;
  endTime: Date;
  taskUid?: string;
  projectUid?: string;
}

/** Minimal key-value storage; localStorage satisfies it. */
export interface JournalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CompletionDeps {
  /** Where the journal lives; null when browser storage is unavailable */
  storage: JournalStorage | null;
  /**
   * Insert rows whose uid is not stored yet, atomically.
   * Resolves with how many rows were inserted.
   */
  save(rows: CompletionRow[]): Promise<number>;
  /** Grant reward points. A throw is logged; the saved session stands. */
  award(points: number): void;
  /** Side effects that depend on a newly committed session. */
  onSaved?(completion: PendingCompletion): void;
}

/** Result of processing one completion. */
export type CompletionOutcome = "saved" | "duplicate" | "failed";

function mintId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Uid of a completion's nth stretch. Stable across retries and reloads. */
export function stretchUid(completionId: string, index: number): string {
  return `${completionId}-${index}`;
}

/**
 * Build a completion for finished stretches.
 *
 * @param input - Session details; points default to whole minutes focused.
 */
export function createCompletion(input: {
  tag: string;
  segments: FocusSegment[];
  seconds: number;
  taskUid?: string;
  projectUid?: string;
  createdAt: number;
  id?: string;
  pomodoro?: { completed: boolean };
}): PendingCompletion {
  return {
    id: input.id ?? mintId(),
    tag: input.tag,
    ...(input.taskUid ? { taskUid: input.taskUid } : {}),
    ...(input.projectUid ? { projectUid: input.projectUid } : {}),
    segments: input.segments.map((s) => ({ start: s.start, end: s.end })),
    points: Math.floor(input.seconds / 60),
    seconds: input.seconds,
    createdAt: input.createdAt,
    ...(input.pomodoro ? { pomodoro: input.pomodoro } : {}),
  };
}

/** Rows a completion is saved as. */
export function completionRows(c: PendingCompletion): CompletionRow[] {
  return c.segments.map((seg, i) => ({
    uid: stretchUid(c.id, i),
    tag: c.tag,
    startTime: new Date(seg.start),
    endTime: new Date(seg.end),
    ...(c.taskUid ? { taskUid: c.taskUid } : {}),
    ...(c.projectUid ? { projectUid: c.projectUid } : {}),
  }));
}

function isCompletion(v: unknown): v is PendingCompletion {
  const c = v as PendingCompletion;
  return (
    !!c &&
    typeof c.id === "string" &&
    typeof c.tag === "string" &&
    typeof c.points === "number" &&
    Number.isFinite(c.points) && c.points >= 0 &&
    Number.isFinite(c.seconds) && c.seconds >= 60 &&
    Number.isFinite(c.createdAt) &&
    (c.pomodoro === undefined || (!!c.pomodoro && typeof c.pomodoro.completed === "boolean")) &&
    Array.isArray(c.segments) &&
    c.segments.length > 0 &&
    c.segments.every((s) => Number.isFinite(s?.start) && Number.isFinite(s?.end) && s.end > s.start)
  );
}

/** Read the journal, ignoring anything malformed. */
export function readJournal(storage: JournalStorage | null): PendingCompletion[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(COMPLETION_JOURNAL_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isCompletion) : [];
  } catch {
    return [];
  }
}

/**
 * Pending completions, mirrored to the journal.
 *
 * Memory is the working copy, so a full or blocked storage still lets the
 * session retry until the tab closes.
 */
export class CompletionQueue {
  private pending = new Map<string, PendingCompletion>();
  private inflight = new Map<string, Promise<CompletionOutcome>>();
  private journalStored = false;

  constructor(private deps: CompletionDeps) {
    for (const c of readJournal(deps.storage)) this.pending.set(c.id, c);
    this.journalStored = this.pending.size > 0;
  }

  /** Completions waiting to be saved, oldest first. */
  list(): PendingCompletion[] {
    return [...this.pending.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  /** False means a failed save can currently be recovered only in this tab. */
  isDurable(): boolean { return this.journalStored || this.pending.size === 0; }

  /** Whether the journal write landed. */
  private persist(): boolean {
    const { storage } = this.deps;
    if (!storage) return this.journalStored = false;
    try {
      if (this.pending.size === 0) storage.removeItem(COMPLETION_JOURNAL_KEY);
      else storage.setItem(COMPLETION_JOURNAL_KEY, JSON.stringify(this.list()));
      return this.journalStored = true;
    } catch {
      return this.journalStored = false;
    }
  }

  /**
   * Record a completion before anything else happens to the timer.
   * Synchronous, so the journal holds it even if the page closes next.
   *
   * @returns Whether the journal write succeeded.
   */
  add(c: PendingCompletion): boolean {
    this.pending.set(c.id, c);
    return this.persist();
  }

  /**
   * Save one completion, granting its points if this call stored it.
   * Concurrent calls for the same id share one attempt.
   */
  process(id: string): Promise<CompletionOutcome> {
    const running = this.inflight.get(id);
    if (running) return running;

    const attempt = (async (): Promise<CompletionOutcome> => {
      const c = this.pending.get(id);
      if (!c) return "duplicate";
      let inserted: number;
      try {
        inserted = await this.deps.save(completionRows(c));
      } catch {
        return "failed";
      }
      if (inserted > 0 && c.points > 0) {
        try {
          this.deps.award(c.points);
        } catch (error) {
          // The session is saved; only the points balance could not be
          // written. A retry would insert nothing and so award nothing, so
          // there is nothing left to retry.
          console.warn("Could not award focus points", error);
        }
      }
      if (inserted > 0) {
        try { this.deps.onSaved?.(c); }
        catch (error) { console.warn("Could not update focus review", error); }
      }
      // Same synchronous run as the award: no reload can land between them.
      this.pending.delete(id);
      this.persist();
      return inserted > 0 ? "saved" : "duplicate";
    })();

    this.inflight.set(id, attempt);
    void attempt.finally(() => this.inflight.delete(id));
    return attempt;
  }

  /** Journal a completion and try to save it now. */
  submit(c: PendingCompletion): Promise<CompletionOutcome> {
    this.add(c);
    return this.process(c.id);
  }

  /** Retry everything pending. */
  async flush(): Promise<{ saved: PendingCompletion[]; failed: PendingCompletion[] }> {
    const items = this.list();
    const outcomes = await Promise.all(items.map((c) => this.process(c.id)));
    return {
      saved: items.filter((_, i) => outcomes[i] === "saved"),
      failed: items.filter((_, i) => outcomes[i] === "failed"),
    };
  }
}
