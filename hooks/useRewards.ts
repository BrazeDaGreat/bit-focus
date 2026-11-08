/**
 * Rewards Store - Shop, Ledger, Loans and Discounts
 *
 * The balance is not stored anywhere: it is the sum of the rewards ledger,
 * one row per change (earned, redeemed, added, thrown away, loaned, repaid).
 * Rows sync one by one, so earning on a phone and a laptop at the same time
 * adds up instead of one device overwriting the other, and any change can be
 * undone by deleting the rows it wrote.
 *
 * Amounts are hundredths of a gem; see `lib/rewards.ts` for the math.
 *
 * Earlier versions kept a single number in localStorage (`rewardPoints`),
 * counted in focus minutes. The first load after updating carries it over as
 * an opening balance, and item prices are converted the same way, so both
 * are worth the same amount of focus as before.
 *
 * @since v0.11.0-beta (ledger since v0.25.0-beta)
 */

import { create } from "zustand";
import { toast } from "sonner";
import db from "@/lib/db";
import type { RewardItem, RewardTransaction, RewardTxKind, SpecialDiscount } from "@/lib/db";
import { mintUid } from "@/lib/sync/tracker";
import { sendMessage } from "@/lib/webhook";
import { useConfig } from "@/hooks/useConfig";
import { rewardSettings, useRewardSettings } from "@/hooks/useRewardSettings";
import {
  LEGACY_ICON_IDS,
  autoRepayments,
  balanceOf,
  blockingLimit,
  canAfford,
  earnedFor,
  formatGems,
  legacyMinutesToGems,
  loansOf,
  priceOf,
  rateFor,
  shortfall,
} from "@/lib/rewards";

const UNDO_WINDOW_MS = 8000;

/** Legacy balance key, in focus minutes. Read once to seed the ledger. */
const LEGACY_POINTS_KEY = "rewardPoints";
/** Synced flag: the legacy balance has been carried into the ledger. */
const LEDGER_MIGRATED_KEY = "rewards-ledger-migrated";
/** Fixed uid, so two devices carrying the balance over write one row. */
const OPENING_UID = "opening-balance";

/** Fields a person sets on a shop item. */
export type RewardItemInput = Pick<
  RewardItem,
  "title" | "description" | "cost" | "category" | "icon" | "limit" | "priceStep" | "bundle"
>;

/** Why a redemption did not happen. */
export type RedeemResult =
  | { ok: true; group: string }
  | { ok: false; reason: "limit" | "funds" | "hidden"; message: string };

interface RewardsState {
  /** Every shop item, including hidden ones and bundles. */
  items: RewardItem[];
  discounts: SpecialDiscount[];
  /** Every balance change, oldest first. */
  ledger: RewardTransaction[];
  loading: boolean;
  /** True once the first load finished. */
  loaded: boolean;

  /** Read items, discounts and the ledger, migrating older data first. */
  loadRewards: () => Promise<void>;
  /** Load once if nothing is loaded yet. */
  ensureLoaded: () => Promise<void>;

  // Items
  addItem: (input: RewardItemInput) => Promise<RewardItem | null>;
  updateItem: (id: number, changes: Partial<RewardItem>) => Promise<void>;
  /** Delete with an Undo toast. */
  deleteItem: (id: number) => Promise<void>;
  /** Copy an item, placed in the same category. */
  duplicateItem: (id: number) => Promise<void>;
  /** Make one item the savings goal, or clear the goal with null. */
  setGoal: (id: number | null) => Promise<void>;
  /** Rename a category and move its items. False when the name is taken or blank. */
  renameCategory: (from: string, to: string) => Promise<boolean>;
  /** Remove a category; its items become uncategorised. */
  deleteCategory: (name: string) => Promise<void>;

  // Balance
  /** Redeem an item at today's price, with an Undo toast. */
  redeem: (item: RewardItem) => Promise<RedeemResult>;
  /**
   * Credit a finished focus session at its tag's rate, repaying loans from it.
   * Safe to call twice for one completion.
   *
   * @returns Hundredths credited (before repayments).
   */
  earn: (input: { seconds: number; tag?: string; completionId: string }) => Promise<number>;
  /** Add gems by hand, with an Undo toast. */
  addGems: (amount: number, note?: string) => Promise<void>;
  /** Throw away gems, never more than the balance. False when refused. */
  throwAway: (amount: number, note?: string) => Promise<boolean>;
  /** Take a loan, paid out now and repaid from future earnings. */
  takeLoan: (amount: number, options?: { interestPercent?: number; repayPercent?: number }) => Promise<void>;
  /** Repay a loan from the balance. False when refused. */
  repayLoan: (loanUid: string, amount: number) => Promise<boolean>;
  /** Remove every ledger row written by one action. */
  undo: (group: string) => Promise<void>;

  // Discounts
  addDiscount: (title: string, percentage: number) => Promise<void>;
  toggleDiscount: (id: number) => Promise<void>;
  deleteDiscount: (id: number) => Promise<void>;
  /** Total active discount percentage, capped at 100. */
  getTotalDiscount: () => number;
}

/** Bring a pre-v0.25.0 item up to date, or return null when it already is. */
function upgradeItem(item: RewardItem): RewardItem | null {
  if (item.unit === "gem") return null;
  const legacyIndex = item.emoji !== undefined ? Number.parseInt(item.emoji, 10) : NaN;
  return {
    ...item,
    cost: legacyMinutesToGems(item.cost),
    unit: "gem",
    icon: item.icon ?? LEGACY_ICON_IDS[legacyIndex] ?? undefined,
  };
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Carry the pre-ledger balance over once. */
async function migrateLegacyBalance(): Promise<void> {
  if (typeof window === "undefined" || readStorage(LEDGER_MIGRATED_KEY)) return;
  const legacy = readStorage(LEGACY_POINTS_KEY);
  // Nothing here yet; another device may still sync one in.
  if (legacy === null) return;
  const minutes = Number.parseFloat(legacy) || 0;
  if (minutes !== 0 && (await db.rewardLedger.where("uid").equals(OPENING_UID).count()) === 0) {
    const now = new Date();
    await db.rewardLedger.add({
      uid: OPENING_UID,
      kind: "opening",
      amount: legacyMinutesToGems(minutes),
      at: now,
      group: OPENING_UID,
      note: "Balance before gems",
      createdAt: now,
      updatedAt: now,
    });
  }
  writeStorage(LEDGER_MIGRATED_KEY, "1");
}

/** Build a ledger row. */
function txRow(kind: RewardTxKind, amount: number, group: string, extra: Partial<RewardTransaction> = {}): RewardTransaction {
  const now = new Date();
  return { uid: mintUid(), kind, amount, at: now, group, createdAt: now, updatedAt: now, ...extra };
}

/** Post to the webhook when one is set up. Never throws. */
function postWebhook(lines: string[]): void {
  const { webhook, name } = useConfig.getState();
  if (!webhook) return;
  const message = [...lines, ...(name && name !== "NULL" ? [`👤 **User:** ${name}`] : [])].join("\n");
  sendMessage(message, webhook).catch(() => {});
}

function byTime(a: RewardTransaction, b: RewardTransaction): number {
  return a.at.getTime() - b.at.getTime();
}

let loadInFlight: Promise<void> | null = null;

export const useRewards = create<RewardsState>((set, get) => {
  /** Write rows, add them to state, and offer to undo them. */
  async function record(rows: RewardTransaction[], message?: string): Promise<void> {
    await db.rewardLedger.bulkAdd(rows);
    set((state) => ({ ledger: [...state.ledger, ...rows].sort(byTime) }));
    const group = rows[0]?.group;
    if (message && group) {
      toast(message, {
        duration: UNDO_WINDOW_MS,
        action: { label: "Undo", onClick: () => void get().undo(group) },
      });
    }
  }

  return {
    items: [],
    discounts: [],
    ledger: [],
    loading: false,
    loaded: false,

    loadRewards: async () => {
      set({ loading: true });
      try {
        await migrateLegacyBalance();
        const items = await db.rewards.toArray();
        const upgraded = items.map(upgradeItem).filter((item): item is RewardItem => item !== null);
        if (upgraded.length > 0) await db.rewards.bulkPut(upgraded);
        const byId = new Map(upgraded.map((item) => [item.id, item]));
        const [discounts, ledger] = await Promise.all([db.discounts.toArray(), db.rewardLedger.toArray()]);
        set({
          items: items.map((item) => byId.get(item.id) ?? item),
          discounts,
          ledger: ledger.sort(byTime),
          loading: false,
          loaded: true,
        });
      } catch (error) {
        console.error("Failed to load rewards:", error);
        toast.error("Couldn't load rewards.");
        set({ loading: false });
      }
    },

    ensureLoaded: async () => {
      if (get().loaded) return;
      loadInFlight ??= get().loadRewards().finally(() => {
        loadInFlight = null;
      });
      await loadInFlight;
    },

    addItem: async (input) => {
      try {
        const now = new Date();
        const item: RewardItem = { ...input, unit: "gem", createdAt: now, updatedAt: now };
        const id = await db.rewards.add(item);
        const added = (await db.rewards.get(id)) ?? { ...item, id };
        set((state) => ({ items: [...state.items, added] }));
        toast.success(`Added "${input.title}" to the shop`);
        return added;
      } catch (error) {
        console.error("Failed to add reward item:", error);
        toast.error("Couldn't add the item.");
        return null;
      }
    },

    updateItem: async (id, changes) => {
      try {
        const updatedAt = new Date();
        await db.rewards.update(id, { ...changes, updatedAt });
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, ...changes, updatedAt } : item)),
        }));
      } catch (error) {
        console.error("Failed to update reward item:", error);
        toast.error("Couldn't save the item.");
      }
    },

    deleteItem: async (id) => {
      const item = get().items.find((i) => i.id === id);
      if (!item) return;
      try {
        await db.rewards.delete(id);
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
        toast(`Deleted "${item.title}"`, {
          duration: UNDO_WINDOW_MS,
          action: {
            label: "Undo",
            onClick: () => {
              db.rewards
                .add(item)
                .then(() => set((state) => ({ items: [...state.items, item] })))
                .catch(() => toast.error("Couldn't restore the item."));
            },
          },
        });
      } catch (error) {
        console.error("Failed to delete reward item:", error);
        toast.error("Couldn't delete the item.");
      }
    },

    duplicateItem: async (id) => {
      const item = get().items.find((i) => i.id === id);
      if (!item) return;
      const { title, description, cost, category, icon, limit, priceStep, bundle, hidden } = item;
      await get().addItem({ title: `${title} (copy)`, description, cost, category, icon, limit, priceStep, bundle });
      if (hidden) {
        const copy = get().items.at(-1);
        if (copy?.id) await get().updateItem(copy.id, { hidden: true });
      }
    },

    setGoal: async (id) => {
      const changes = get().items.filter((item) => (item.id === id) !== !!item.goal);
      const updatedAt = new Date();
      await db.transaction("rw", db.rewards, async () => {
        for (const item of changes) await db.rewards.update(item.id!, { goal: item.id === id, updatedAt });
      });
      set((state) => ({
        items: state.items.map((item) =>
          changes.includes(item) ? { ...item, goal: item.id === id, updatedAt } : item,
        ),
      }));
    },

    renameCategory: async (from, to) => {
      const name = to.trim();
      const { categories, replaceCategory } = useRewardSettings.getState();
      if (!name || (name !== from && categories.some((c) => c.toLowerCase() === name.toLowerCase()))) return false;
      replaceCategory(from, name);
      const moved = get().items.filter((item) => item.category === from);
      const updatedAt = new Date();
      await db.transaction("rw", db.rewards, async () => {
        for (const item of moved) await db.rewards.update(item.id!, { category: name, updatedAt });
      });
      set((state) => ({
        items: state.items.map((item) => (item.category === from ? { ...item, category: name, updatedAt } : item)),
      }));
      return true;
    },

    deleteCategory: async (name) => {
      useRewardSettings.getState().removeCategory(name);
      const moved = get().items.filter((item) => item.category === name);
      const updatedAt = new Date();
      await db.transaction("rw", db.rewards, async () => {
        for (const item of moved) await db.rewards.update(item.id!, { category: undefined, updatedAt });
      });
      set((state) => ({
        items: state.items.map((item) => (item.category === name ? { ...item, category: undefined, updatedAt } : item)),
      }));
    },

    redeem: async (item) => {
      await get().ensureLoaded();
      const { items, ledger } = get();
      if (item.hidden) return { ok: false, reason: "hidden", message: "Show this item before redeeming it." };
      const now = new Date();
      const blocked = blockingLimit(item, items, ledger, now);
      if (blocked) {
        const { status } = blocked;
        const message = `${blocked.item.title} is limited to ${status.count} per ${status.period}.`;
        toast.error(message);
        return { ok: false, reason: "limit", message };
      }
      const price = priceOf(item, ledger, get().getTotalDiscount(), now).final;
      const balance = balanceOf(ledger);
      const { debtCap } = rewardSettings();
      if (!canAfford(price, balance, debtCap)) {
        const message = `You need ${formatGems(shortfall(price, balance, debtCap))} more gems.`;
        toast.error(message);
        return { ok: false, reason: "funds", message };
      }
      const group = mintUid();
      try {
        await record(
          [
            txRow("redeem", -price, group, {
              itemUid: item.uid,
              itemTitle: item.title,
              category: item.category,
              ...(item.bundle?.length ? { bundleItemUids: [...item.bundle] } : {}),
            }),
          ],
          `Redeemed "${item.title}" for ${formatGems(price)} gems`,
        );
      } catch (error) {
        console.error("Failed to redeem:", error);
        toast.error("Couldn't redeem the item.");
        return { ok: false, reason: "funds", message: "Couldn't redeem the item." };
      }
      if (rewardSettings().webhookRedeem) {
        postWebhook([
          `🎁 **Reward redeemed**`,
          `🛍️ **Item:** ${item.title}`,
          `💎 **Cost:** ${formatGems(price)} gems`,
          `💰 **Balance:** ${formatGems(balanceOf(get().ledger))} gems`,
        ]);
      }
      return { ok: true, group };
    },

    earn: async ({ seconds, tag, completionId }) => {
      await get().ensureLoaded();
      const settings = rewardSettings();
      const amount = earnedFor(seconds, rateFor(tag, settings));
      if (amount <= 0) return 0;
      const uid = `earn-${completionId}`;
      if (get().ledger.some((tx) => tx.uid === uid)) return 0;
      const rows = [
        { ...txRow("earn", amount, uid, { tag, seconds }), uid },
        ...autoRepayments(amount, get().ledger).map((repay) => ({
          ...txRow("repay", -repay.amount, uid, { loanUid: repay.loanUid, note: "From earnings" }),
          uid: `${uid}-repay-${repay.loanUid}`,
        })),
      ];
      try {
        await db.rewardLedger.bulkAdd(rows);
      } catch (error) {
        // The unique uid refuses a second credit for the same session.
        if ((error as { name?: string })?.name === "BulkError" || (error as { name?: string })?.name === "ConstraintError") return 0;
        throw error;
      }
      set((state) => ({ ledger: [...state.ledger, ...rows].sort(byTime) }));
      if (settings.webhookEarn && amount >= settings.webhookEarnMin) {
        postWebhook([
          `💎 **Gems earned**`,
          `➕ **Earned:** ${formatGems(amount)} gems${tag ? ` on \`#${tag}\`` : ""}`,
          `💰 **Balance:** ${formatGems(balanceOf(get().ledger))} gems`,
        ]);
      }
      return amount;
    },

    addGems: async (amount, note) => {
      if (amount <= 0) return;
      await get().ensureLoaded();
      await record([txRow("add", amount, mintUid(), { note })], `Added ${formatGems(amount)} gems`);
    },

    throwAway: async (amount, note) => {
      await get().ensureLoaded();
      const balance = balanceOf(get().ledger);
      if (amount <= 0 || amount > balance) {
        toast.error("You can't throw away more than your balance.");
        return false;
      }
      await record([txRow("throw", -amount, mintUid(), { note })], `Threw away ${formatGems(amount)} gems`);
      return true;
    },

    takeLoan: async (amount, options = {}) => {
      if (amount <= 0) return;
      await get().ensureLoaded();
      const settings = rewardSettings();
      const interestPercent = options.interestPercent ?? settings.loanInterestPercent;
      const repayPercent = options.repayPercent ?? settings.loanRepayPercent;
      await record(
        [txRow("loan", amount, mintUid(), { interestPercent, repayPercent })],
        `Borrowed ${formatGems(amount)} gems`,
      );
    },

    repayLoan: async (loanUid, amount) => {
      await get().ensureLoaded();
      const { ledger } = get();
      const loan = loansOf(ledger).find((l) => l.uid === loanUid);
      const balance = balanceOf(ledger);
      if (!loan || amount <= 0 || amount > loan.outstanding) {
        toast.error("That's more than the loan has left.");
        return false;
      }
      if (amount > balance) {
        toast.error("You can't repay more than your balance.");
        return false;
      }
      await record([txRow("repay", -amount, mintUid(), { loanUid })], `Repaid ${formatGems(amount)} gems`);
      return true;
    },

    undo: async (group) => {
      try {
        await db.rewardLedger.where("group").equals(group).delete();
        set((state) => ({ ledger: state.ledger.filter((tx) => tx.group !== group) }));
        toast("Undone");
      } catch (error) {
        console.error("Failed to undo:", error);
        toast.error("Couldn't undo that.");
      }
    },

    addDiscount: async (title, percentage) => {
      try {
        const now = new Date();
        const discount: SpecialDiscount = { title, percentage, active: true, createdAt: now, updatedAt: now };
        const id = await db.discounts.add(discount);
        set((state) => ({ discounts: [...state.discounts, { ...discount, id }] }));
      } catch (error) {
        console.error("Failed to add discount:", error);
        toast.error("Couldn't add the discount.");
      }
    },

    toggleDiscount: async (id) => {
      const discount = get().discounts.find((d) => d.id === id);
      if (!discount) return;
      const active = !discount.active;
      const updatedAt = new Date();
      await db.discounts.update(id, { active, updatedAt });
      set((state) => ({ discounts: state.discounts.map((d) => (d.id === id ? { ...d, active, updatedAt } : d)) }));
    },

    deleteDiscount: async (id) => {
      await db.discounts.delete(id);
      set((state) => ({ discounts: state.discounts.filter((d) => d.id !== id) }));
    },

    getTotalDiscount: () =>
      Math.min(100, get().discounts.filter((d) => d.active).reduce((sum, d) => sum + d.percentage, 0)),
  };
});

/** Which balance action dialog is open. Lets the command palette open it. */
export type BalanceAction = "add" | "throw" | "loan" | "repay";

interface RewardsUiState {
  balanceDialog: BalanceAction | null;
  openBalanceDialog: (action: BalanceAction) => void;
  closeBalanceDialog: () => void;
}

export const useRewardsUi = create<RewardsUiState>((set) => ({
  balanceDialog: null,
  openBalanceDialog: (action) => set({ balanceDialog: action }),
  closeBalanceDialog: () => set({ balanceDialog: null }),
}));

/** The balance, for selectors: `useRewards(selectBalance)`. */
export function selectBalance(state: { ledger: RewardTransaction[] }): number {
  return balanceOf(state.ledger);
}
