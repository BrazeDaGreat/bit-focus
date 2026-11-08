/**
 * Rewards Economy - Gems, Prices, Loans and Limits
 *
 * Pure functions over the rewards ledger. The store writes rows; everything
 * the interface shows — balance, debt, a price after discounts, whether an
 * item is still on cooldown — is computed here from those rows, so every
 * surface agrees and the rules can be tested without a browser.
 *
 * Amounts are integers in hundredths of a gem. At the default rate one hour
 * of focus earns one gem (100). Before v0.25.0 one unit was one focus minute;
 * `legacyMinutesToGems` converts those so an old balance buys as much focus
 * time as it did.
 *
 * @fileoverview Gem formatting, earning, pricing, limits, loans and summaries
 * @author BIT Focus Development Team
 * @since v0.25.0-beta
 */

import type { RewardItem, RewardTransaction } from "@/lib/db";

/** Hundredths per gem. */
export const GEM = 100;

/**
 * Icon ids for the five icons offered before v0.25.0, in their old order.
 * Old items stored an index into that list.
 */
export const LEGACY_ICON_IDS = ["hourglass", "gamepad", "burger", "smartphone", "ball"] as const;

/** Display name of the currency, singular and plural. */
export const GEM_NAME = { one: "gem", many: "gems" } as const;

/** Rewards preferences. Synced through browser storage. */
export interface RewardSettings {
  /** Gems earned per focused hour, for tags without their own rate. */
  rate: number;
  /** Gems per focused hour for specific tags, by tag name. */
  tagRates: Record<string, number>;
  /** Shop categories, in display order. */
  categories: string[];
  /** How far below zero a redemption may take the balance, in hundredths. */
  debtCap: number;
  /** Post redemptions to the webhook. */
  webhookRedeem: boolean;
  /** Post earnings of at least `webhookEarnMin` to the webhook. */
  webhookEarn: boolean;
  /** Smallest earning worth posting, in hundredths. */
  webhookEarnMin: number;
  /** Default interest for new loans, in percent. */
  loanInterestPercent: number;
  /** Default share of each earning taken to repay loans, in percent. */
  loanRepayPercent: number;
}

export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  rate: 1,
  tagRates: {},
  categories: ["Breaks", "Gaming", "Treats", "Others"],
  debtCap: 0,
  webhookRedeem: false,
  webhookEarn: false,
  webhookEarnMin: GEM,
  loanInterestPercent: 0,
  loanRepayPercent: 50,
};

/**
 * Format an amount as gems with two decimals.
 *
 * @param amount - Hundredths of a gem.
 * @param options.sign - Prefix "+" for gains (losses always get "−").
 */
export function formatGems(amount: number, options: { sign?: boolean } = {}): string {
  const text = (Math.abs(amount) / GEM).toFixed(2);
  if (amount < 0) return `−${text}`;
  return options.sign && amount > 0 ? `+${text}` : text;
}

/**
 * Read a gem amount typed by a person ("2", "2.5", "0.75").
 *
 * @returns Hundredths of a gem, or null when the text is not a number.
 */
export function parseGems(text: string): number | null {
  const value = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * GEM) : null;
}

/** Convert a pre-v0.25.0 amount (one unit per focus minute) to hundredths of a gem. */
export function legacyMinutesToGems(minutes: number): number {
  return Math.round((minutes * GEM) / 60);
}

/** Gems per focused hour for a tag. */
export function rateFor(tag: string | undefined, settings: RewardSettings): number {
  const own = tag ? settings.tagRates[tag] : undefined;
  return typeof own === "number" && Number.isFinite(own) && own >= 0 ? own : settings.rate;
}

/** Hundredths of a gem earned for focused seconds at a rate. */
export function earnedFor(seconds: number, rate: number): number {
  return Math.max(0, Math.round((seconds / 3600) * rate * GEM));
}

/**
 * Focus minutes needed to earn an amount at a rate.
 *
 * @returns Whole minutes, rounded up; Infinity when the rate is zero.
 */
export function focusMinutesFor(amount: number, rate: number): number {
  if (amount <= 0) return 0;
  if (rate <= 0) return Infinity;
  return Math.ceil((amount / GEM / rate) * 60);
}

/** "45m", "2h", "2h 10m". */
export function formatFocusTime(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The balance: every ledger amount added up. */
export function balanceOf(ledger: readonly RewardTransaction[]): number {
  return ledger.reduce((sum, tx) => sum + tx.amount, 0);
}

/** Midnight at the start of `now`'s day, local time. */
export function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Midnight at the start of `now`'s week (Monday), local time. */
export function startOfWeek(now: Date): Date {
  const day = startOfDay(now);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

/** One loan with what is left to pay. */
export interface LoanStatus {
  uid: string;
  takenAt: Date;
  /** Paid out to the balance. */
  principal: number;
  /** Principal plus interest. */
  total: number;
  repaid: number;
  outstanding: number;
  interestPercent: number;
  repayPercent: number;
}

/** Every loan, oldest first, with repayments applied. */
export function loansOf(ledger: readonly RewardTransaction[]): LoanStatus[] {
  const repaid = new Map<string, number>();
  for (const tx of ledger) {
    if (tx.kind === "repay" && tx.loanUid) {
      repaid.set(tx.loanUid, (repaid.get(tx.loanUid) ?? 0) - tx.amount);
    }
  }
  return ledger
    .filter((tx) => tx.kind === "loan")
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((tx) => {
      const interestPercent = tx.interestPercent ?? 0;
      const total = Math.round(tx.amount * (1 + interestPercent / 100));
      const paid = repaid.get(tx.uid) ?? 0;
      return {
        uid: tx.uid,
        takenAt: tx.at,
        principal: tx.amount,
        total,
        repaid: paid,
        outstanding: Math.max(0, total - paid),
        interestPercent,
        repayPercent: tx.repayPercent ?? 0,
      };
    });
}

/** Total still owed across loans. */
export function debtOf(ledger: readonly RewardTransaction[]): number {
  return loansOf(ledger).reduce((sum, loan) => sum + loan.outstanding, 0);
}

/**
 * Repayments to take from a new earning, oldest loan first.
 *
 * Each loan takes its own share of the earning, never more than it is owed
 * and never more than the earning has left.
 *
 * @param earned - Hundredths just earned.
 * @returns Positive amounts per loan; the caller records them as negative.
 */
export function autoRepayments(
  earned: number,
  ledger: readonly RewardTransaction[],
): { loanUid: string; amount: number }[] {
  let left = earned;
  const out: { loanUid: string; amount: number }[] = [];
  for (const loan of loansOf(ledger)) {
    if (left <= 0) break;
    if (loan.outstanding <= 0 || loan.repayPercent <= 0) continue;
    const amount = Math.min(Math.round((earned * loan.repayPercent) / 100), loan.outstanding, left);
    if (amount > 0) {
      out.push({ loanUid: loan.uid, amount });
      left -= amount;
    }
  }
  return out;
}

/** Redemptions of an item since a moment, counting bundles that contain it. */
export function redemptionsOf(
  itemUid: string,
  ledger: readonly RewardTransaction[],
  since: Date,
): number {
  const from = since.getTime();
  let count = 0;
  for (const tx of ledger) {
    if (tx.kind !== "redeem" || tx.at.getTime() < from) continue;
    if (tx.itemUid === itemUid || tx.bundleItemUids?.includes(itemUid)) count++;
  }
  return count;
}

/** Where an item stands against its redemption limit. */
export interface LimitStatus {
  used: number;
  count: number;
  period: "day" | "week";
  /** When the period rolls over. */
  resetsAt: Date;
  blocked: boolean;
}

/** Limit standing of one item, or null when it has no limit. */
export function limitOf(
  item: RewardItem,
  ledger: readonly RewardTransaction[],
  now: Date,
): LimitStatus | null {
  if (!item.limit || !item.uid || item.limit.count <= 0) return null;
  const { count, period } = item.limit;
  const start = period === "day" ? startOfDay(now) : startOfWeek(now);
  const resetsAt = new Date(start);
  resetsAt.setDate(resetsAt.getDate() + (period === "day" ? 1 : 7));
  const used = redemptionsOf(item.uid, ledger, start);
  return { used, count, period, resetsAt, blocked: used >= count };
}

/**
 * Whether an item can be redeemed right now as far as limits go.
 *
 * A bundle is blocked when it or anything inside it has reached its limit.
 *
 * @returns The blocking item and its status, or null when nothing blocks.
 */
export function blockingLimit(
  item: RewardItem,
  items: readonly RewardItem[],
  ledger: readonly RewardTransaction[],
  now: Date,
): { item: RewardItem; status: LimitStatus } | null {
  const own = limitOf(item, ledger, now);
  if (own?.blocked) return { item, status: own };
  for (const uid of item.bundle ?? []) {
    const inner = items.find((i) => i.uid === uid);
    const status = inner && limitOf(inner, ledger, now);
    if (inner && status?.blocked) return { item: inner, status };
  }
  return null;
}

/** An item's price today. */
export interface Price {
  /** Listed price. */
  base: number;
  /** After this week's price steps. */
  stepped: number;
  /** After discounts: what redeeming costs. */
  final: number;
  /** Redemptions this week that raised the price. */
  steps: number;
}

/**
 * Price an item: listed cost, raised by its weekly step, then discounted.
 *
 * @param discountPercent - Total active discount, 0–100.
 */
export function priceOf(
  item: RewardItem,
  ledger: readonly RewardTransaction[],
  discountPercent: number,
  now: Date,
): Price {
  const base = item.cost;
  const steps = item.priceStep && item.uid ? redemptionsOf(item.uid, ledger, startOfWeek(now)) : 0;
  const stepped = Math.round(base * (1 + ((item.priceStep ?? 0) / 100) * steps));
  const final = Math.max(0, Math.round(stepped * (1 - Math.min(100, Math.max(0, discountPercent)) / 100)));
  return { base, stepped, final, steps };
}

/** Whether a balance can cover a price without passing the debt cap. */
export function canAfford(price: number, balance: number, debtCap: number): boolean {
  return balance - price >= -Math.max(0, debtCap);
}

/** How much more is needed before a price is affordable (0 when it already is). */
export function shortfall(price: number, balance: number, debtCap: number): number {
  return Math.max(0, price - balance - Math.max(0, debtCap));
}

/** Share of the way to affording a price, 0–1. */
export function progressToward(price: number, balance: number, debtCap: number): number {
  if (price <= 0) return 1;
  return Math.min(1, Math.max(0, (balance + Math.max(0, debtCap)) / price));
}

/** The item being saved up for, if any. */
export function goalOf(items: readonly RewardItem[]): RewardItem | undefined {
  return items.find((item) => item.goal && !item.hidden);
}

/** A ledger in numbers, for stats and the AI context. */
export interface LedgerSummary {
  balance: number;
  debt: number;
  earned7: number;
  spent7: number;
  earned30: number;
  spent30: number;
  /** Most redeemed in the last 30 days. */
  topItems: { title: string; count: number; spent: number }[];
  /** Redemption spend by category in the last 30 days. */
  byCategory: { category: string; spent: number }[];
  /** Earnings by tag in the last 30 days. */
  byTag: { tag: string; earned: number }[];
}

/** Summarise the ledger around `now`. Spending counts redemptions only. */
export function summarizeLedger(ledger: readonly RewardTransaction[], now: Date): LedgerSummary {
  const day = 24 * 60 * 60 * 1000;
  const since7 = now.getTime() - 7 * day;
  const since30 = now.getTime() - 30 * day;
  let earned7 = 0, spent7 = 0, earned30 = 0, spent30 = 0;
  const items = new Map<string, { title: string; count: number; spent: number }>();
  const categories = new Map<string, number>();
  const tags = new Map<string, number>();

  for (const tx of ledger) {
    const t = tx.at.getTime();
    if (t < since30) continue;
    if (tx.kind === "earn") {
      earned30 += tx.amount;
      if (t >= since7) earned7 += tx.amount;
      const tag = tx.tag || "Untagged";
      tags.set(tag, (tags.get(tag) ?? 0) + tx.amount);
    } else if (tx.kind === "redeem") {
      const spent = -tx.amount;
      spent30 += spent;
      if (t >= since7) spent7 += spent;
      const key = tx.itemUid ?? tx.itemTitle ?? "?";
      const entry = items.get(key) ?? { title: tx.itemTitle ?? "Removed item", count: 0, spent: 0 };
      entry.count++;
      entry.spent += spent;
      items.set(key, entry);
      const category = tx.category || "Uncategorised";
      categories.set(category, (categories.get(category) ?? 0) + spent);
    }
  }

  return {
    balance: balanceOf(ledger),
    debt: debtOf(ledger),
    earned7, spent7, earned30, spent30,
    topItems: [...items.values()].sort((a, b) => b.count - a.count || b.spent - a.spent).slice(0, 5),
    byCategory: [...categories].map(([category, spent]) => ({ category, spent })).sort((a, b) => b.spent - a.spent),
    byTag: [...tags].map(([tag, earned]) => ({ tag, earned })).sort((a, b) => b.earned - a.earned),
  };
}
