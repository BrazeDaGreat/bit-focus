"use client";

/**
 * Recent Activity
 *
 * The ledger, newest first and grouped by day. Rows written by one action
 * (a focus earning and the loan repayment taken from it, say) share a group
 * and are shown as one entry, because undo removes the whole group.
 *
 * @since v0.25.0-beta
 */

import { useMemo, useState, type ComponentType } from "react";
import { format, isSameYear, isToday, isYesterday } from "date-fns";
import { Gift, History, Landmark, MoreHorizontal, Plus, RotateCcw, Timer, Trash2 } from "lucide-react";
import { Gems } from "@/components/rewards/Gem";
import { useRewards } from "@/hooks/useRewards";
import type { RewardTransaction, RewardTxKind } from "@/lib/db";
import { formatFocusTime } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { ICON_BUTTON, MenuItem, MenuNote, PointMenu, QUIET, usePointMenu } from "@/components/rewards/balance/shared";

const PAGE = 30;

const ICONS: Record<RewardTxKind, ComponentType<{ className?: string }>> = {
  opening: History,
  earn: Timer,
  redeem: Gift,
  add: Plus,
  throw: Trash2,
  loan: Landmark,
  repay: RotateCcw,
};

/** One action: its leading row plus anything written with it. */
interface Entry {
  key: string;
  group?: string;
  lead: RewardTransaction;
  extra: RewardTransaction[];
}

function labelOf(tx: RewardTransaction): string {
  switch (tx.kind) {
    case "earn":
      return [
        "Focus",
        tx.tag ? `#${tx.tag}` : null,
        tx.seconds ? formatFocusTime(Math.max(1, Math.round(tx.seconds / 60))) : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "redeem":
      return `Redeemed ${tx.itemTitle ?? "an item"}`;
    case "add":
      return tx.note ? `Added by hand — ${tx.note}` : "Added by hand";
    case "throw":
      return tx.note ? `Threw away — ${tx.note}` : "Threw away";
    case "loan":
      return tx.interestPercent ? `Loan (${tx.interestPercent}% interest)` : "Loan (no interest)";
    case "repay":
      return tx.note === "From earnings" ? "Repaid from earnings" : "Repaid loan";
    case "opening":
      return "Balance before gems";
  }
}

function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isSameYear(date, new Date()) ? "EEEE, MMM d" : "MMM d, yyyy");
}

function entriesOf(ledger: readonly RewardTransaction[]): Entry[] {
  const byGroup = new Map<string, Entry>();
  const out: Entry[] = [];
  for (let i = ledger.length - 1; i >= 0; i--) {
    const tx = ledger[i];
    const existing = tx.group ? byGroup.get(tx.group) : undefined;
    if (existing) {
      // An earning leads the repayments taken from it.
      if (existing.lead.kind === "repay" && tx.kind !== "repay") {
        existing.extra.unshift(existing.lead);
        existing.lead = tx;
      } else {
        existing.extra.push(tx);
      }
      continue;
    }
    const entry: Entry = { key: tx.group ?? tx.uid, group: tx.group, lead: tx, extra: [] };
    if (tx.group) byGroup.set(tx.group, entry);
    out.push(entry);
  }
  return out;
}

export function RecentActivity() {
  const ledger = useRewards((s) => s.ledger);
  const undo = useRewards((s) => s.undo);
  const [shown, setShown] = useState(PAGE);
  const menu = usePointMenu<Entry>();

  const entries = useMemo(() => entriesOf(ledger), [ledger]);
  const days = useMemo(() => {
    const out: { label: string; entries: Entry[] }[] = [];
    for (const entry of entries.slice(0, shown)) {
      const label = dayLabel(entry.lead.at);
      const last = out[out.length - 1];
      if (last?.label === label) last.entries.push(entry);
      else out.push({ label, entries: [entry] });
    }
    return out;
  }, [entries, shown]);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-muted/40 p-4">
        <p className="text-sm font-medium">Nothing here yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gems you earn from focus, spend in the shop or add by hand show up here.
        </p>
      </div>
    );
  }

  const target = menu.menu?.target;

  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <div key={day.label} className="flex flex-col gap-0.5">
          <h3 className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{day.label}</h3>
          {day.entries.map((entry) => {
            const Icon = ICONS[entry.lead.kind];
            const undoable = !!entry.group && entry.lead.kind !== "opening";
            return (
              <div
                key={entry.key}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                onContextMenu={undoable ? menu.onContextMenu(entry) : undefined}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{labelOf(entry.lead)}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">{format(entry.lead.at, "h:mm a")}</span>
                    {entry.extra.map((tx) => (
                      <span key={tx.uid} className="inline-flex items-center gap-1">
                        {labelOf(tx)} <Gems amount={tx.amount} sign hideIcon />
                      </span>
                    ))}
                  </p>
                </div>
                <Gems
                  amount={entry.lead.amount}
                  sign
                  className={cn(
                    "text-sm",
                    entry.lead.amount > 0 && "text-emerald-600",
                    entry.lead.amount < 0 && "text-destructive",
                  )}
                />
                {undoable ? (
                  <button
                    type="button"
                    className={cn(
                      ICON_BUTTON,
                      "h-8 w-8 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
                    )}
                    aria-label={`Actions for ${labelOf(entry.lead)}`}
                    title="More"
                    onClick={menu.openFrom(entry)}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                ) : (
                  <span className="w-8 shrink-0" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {entries.length > shown && (
        <button type="button" className={cn(QUIET, "self-start")} onClick={() => setShown((n) => n + PAGE)}>
          Show more
        </button>
      )}

      <PointMenu point={menu.menu?.point ?? null} onClose={menu.close} label="Activity actions" returnFocus={menu.returnFocus}>
        {target?.group && (
          <>
            <MenuItem destructive={target.lead.kind === "earn"} onSelect={() => void undo(target.group!)}>
              {target.lead.kind === "earn" ? "Remove these gems" : "Undo"}
            </MenuItem>
            {target.lead.kind === "earn" && (
              <MenuNote>
                The focus session itself stays.
                {target.extra.length > 0 && " The loan repayment taken from it is undone too."}
              </MenuNote>
            )}
          </>
        )}
      </PointMenu>
    </div>
  );
}
