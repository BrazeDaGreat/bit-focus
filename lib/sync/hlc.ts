/**
 * Hybrid Logical Clock - Causally Ordered Timestamps
 *
 * Sync needs to answer one question for every record: of two versions, which
 * one happened later? Wall clocks cannot answer it — two devices disagree by
 * seconds or minutes, and the loser of that disagreement silently loses data.
 * A pure logical counter cannot answer it either, because it drifts away from
 * anything a human would call "recent".
 *
 * A hybrid logical clock is the standard answer: a wall-clock millisecond
 * paired with a counter that breaks ties and absorbs skew. Every stamp this
 * device produces is strictly greater than every stamp it has ever produced or
 * seen, so comparison is a plain string compare and merges are deterministic —
 * every device that sees the same two versions picks the same winner.
 *
 * Stamps are fixed-width and lexicographically sortable, which lets the same
 * comparison run in TypeScript, in a Dexie index, and in a PocketBase API rule
 * without any of them needing to parse the format.
 *
 * @fileoverview Causal timestamps for per-record conflict resolution.
 * @author BIT Focus Development Team
 * @since v0.21.0
 */

/** localStorage key holding the clock across reloads. */
const CLOCK_KEY = "bitfocus.sync.clock";

/** localStorage key holding this device's stable identity. */
const NODE_KEY = "bitfocus.sync.node";

/**
 * Largest clock skew tolerated from a peer, in milliseconds.
 *
 * A peer whose wall clock is wildly ahead would otherwise drag this device's
 * clock forward with it and keep it there. Beyond this window the remote stamp
 * is still ordered correctly — it just does not get to move our physical time.
 */
const MAX_DRIFT_MS = 60_000;

/** Width of the encoded millisecond field. Good past the year 10000. */
const TS_WIDTH = 11;

/** Width of the encoded tie-break counter. */
const COUNT_WIDTH = 4;

/** Ceiling for the tie-break counter before it must roll into the next ms. */
const COUNT_MAX = 36 ** COUNT_WIDTH - 1;

interface ClockState {
  /** Physical time component, in milliseconds. */
  ts: number;
  /** Tie-break counter for stamps minted within the same millisecond. */
  count: number;
}

let state: ClockState | null = null;
let nodeId: string | null = null;

/** Mint a random identifier with no dependency on `crypto` being present. */
function randomId(length: number): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, length);
  }
  let out = "";
  while (out.length < length) out += Math.random().toString(36).slice(2);
  return out.slice(0, length);
}

/**
 * Stable identifier for this browser profile.
 *
 * Two tabs of the same profile share it deliberately: they share an IndexedDB,
 * so for sync purposes they are one device. It exists so a device can tell its
 * own echo apart from a genuine change made somewhere else.
 */
export function deviceId(): string {
  if (nodeId) return nodeId;
  if (typeof window === "undefined") return "server000000";
  try {
    const stored = localStorage.getItem(NODE_KEY);
    if (stored && stored.length >= 8) {
      nodeId = stored;
      return nodeId;
    }
  } catch {
    // Storage unavailable or corrupt: fall through and mint a fresh identity.
  }
  nodeId = randomId(12);
  try {
    localStorage.setItem(NODE_KEY, nodeId);
  } catch {
    // Non-persistent identity is survivable; sync still converges, it just
    // cannot suppress this device's own realtime echo across reloads.
  }
  return nodeId;
}

/** Load the persisted clock, or start one at the current wall time. */
function load(): ClockState {
  if (state) return state;
  if (typeof window === "undefined") return { ts: 0, count: 0 };
  try {
    const raw = localStorage.getItem(CLOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ClockState>;
      if (typeof parsed.ts === "number" && typeof parsed.count === "number") {
        state = { ts: parsed.ts, count: parsed.count };
        return state;
      }
    }
  } catch {
    // Corrupt entry: a fresh clock is safe, since stamps only ever move
    // forward from whatever the wall clock says now.
  }
  state = { ts: 0, count: 0 };
  return state;
}

/** Persist the clock so stamps keep advancing across reloads. */
function save(next: ClockState): void {
  state = next;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLOCK_KEY, JSON.stringify(next));
  } catch {
    // Best effort. An unpersisted clock still advances within this session.
  }
}

/** Encode a clock reading as a sortable fixed-width stamp. */
function encode(ts: number, count: number, node: string): string {
  return [
    Math.max(0, Math.floor(ts)).toString(36).padStart(TS_WIDTH, "0"),
    Math.max(0, count).toString(36).padStart(COUNT_WIDTH, "0"),
    node,
  ].join(":");
}

/** Read the physical time back out of a stamp, for display only. */
export function hlcTime(stamp: string | null | undefined): number | null {
  if (!stamp) return null;
  const ts = parseInt(stamp.slice(0, TS_WIDTH), 36);
  return Number.isNaN(ts) ? null : ts;
}

/** Read the minting device out of a stamp. */
export function hlcNode(stamp: string | null | undefined): string {
  if (!stamp) return "";
  const parts = stamp.split(":");
  return parts.length >= 3 ? parts[2] : "";
}

/**
 * Mint the next stamp for a local change.
 *
 * Guaranteed strictly greater than every stamp previously minted or observed
 * on this device, even when the wall clock stands still or jumps backwards.
 */
export function hlcNow(): string {
  const current = load();
  const wall = Date.now();

  let ts = Math.max(current.ts, wall);
  let count = ts === current.ts ? current.count + 1 : 0;

  // Counter exhausted within one millisecond: borrow from the next one rather
  // than emit a duplicate stamp.
  if (count > COUNT_MAX) {
    ts += 1;
    count = 0;
  }

  save({ ts, count });
  return encode(ts, count, deviceId());
}

/**
 * Fold an observed remote stamp into this device's clock.
 *
 * Called for every record pulled down. Afterwards, any stamp this device mints
 * sorts after the one it just saw, which is what makes "later" mean the same
 * thing on every device rather than depending on whose clock is fast.
 *
 * @param remote - Stamp observed on a remote record.
 */
export function hlcObserve(remote: string | null | undefined): void {
  if (!remote) return;
  const remoteTs = hlcTime(remote);
  if (remoteTs === null) return;

  const remoteCount = parseInt(
    remote.slice(TS_WIDTH + 1, TS_WIDTH + 1 + COUNT_WIDTH),
    36,
  );
  const current = load();
  const wall = Date.now();

  // A peer far in the future is ordered ahead of us, but does not get to drag
  // our physical clock along with it.
  const bounded = Math.min(remoteTs, wall + MAX_DRIFT_MS);
  const ts = Math.max(current.ts, bounded, wall);

  let count: number;
  if (ts === current.ts && ts === bounded) {
    count = Math.max(current.count, Number.isNaN(remoteCount) ? 0 : remoteCount) + 1;
  } else if (ts === current.ts) {
    count = current.count + 1;
  } else if (ts === bounded) {
    count = (Number.isNaN(remoteCount) ? 0 : remoteCount) + 1;
  } else {
    count = 0;
  }

  save({ ts, count: Math.min(count, COUNT_MAX) });
}

/**
 * Compare two stamps.
 *
 * @returns Negative when `a` is older, positive when `a` is newer, 0 when equal.
 */
export function hlcCompare(a: string | null | undefined, b: string | null | undefined): number {
  const left = a ?? "";
  const right = b ?? "";
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** The stamp that sorts before every real stamp. Used for never-synced rows. */
export const HLC_ZERO = encode(0, 0, "000000000000");
