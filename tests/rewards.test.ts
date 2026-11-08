import { test } from "node:test";
import assert from "node:assert/strict";
import type { RewardItem, RewardTransaction } from "../lib/db";
import {
  DEFAULT_REWARD_SETTINGS,
  autoRepayments,
  balanceOf,
  blockingLimit,
  canAfford,
  debtOf,
  earnedFor,
  focusMinutesFor,
  formatFocusTime,
  formatGems,
  legacyMinutesToGems,
  loansOf,
  parseGems,
  priceOf,
  rateFor,
  shortfall,
  summarizeLedger,
} from "../lib/rewards";

const NOW = new Date(2026, 10, 11, 12); // Wednesday
let n = 0;
function tx(kind: RewardTransaction["kind"], amount: number, extra: Partial<RewardTransaction> = {}): RewardTransaction {
  const at = extra.at ?? NOW;
  return { uid: `tx-${n++}`, kind, amount, at, createdAt: at, updatedAt: at, ...extra };
}
function item(extra: Partial<RewardItem> = {}): RewardItem {
  return { uid: "item", title: "Gaming", cost: 200, unit: "gem", createdAt: NOW, updatedAt: NOW, ...extra };
}

test("an hour of focus earns one gem at the default rate", () => {
  assert.equal(earnedFor(3600, 1), 100);
  assert.equal(earnedFor(25 * 60, 1), 42);
  assert.equal(earnedFor(3600, 0.5), 50);
  assert.equal(focusMinutesFor(100, 1), 60);
  assert.equal(focusMinutesFor(100, 0), Infinity);
  assert.equal(formatFocusTime(130), "2h 10m");
  assert.equal(formatFocusTime(45), "45m");
});

test("tags use their own rate, others the overall one", () => {
  const settings = { ...DEFAULT_REWARD_SETTINGS, rate: 1, tagRates: { uni: 0.5, chores: 0 } };
  assert.equal(rateFor("uni", settings), 0.5);
  assert.equal(rateFor("chores", settings), 0);
  assert.equal(rateFor("other", settings), 1);
  assert.equal(rateFor(undefined, settings), 1);
});

test("legacy minutes keep their focus value", () => {
  assert.equal(legacyMinutesToGems(60), 100);
  assert.equal(legacyMinutesToGems(6000), 10000);
  assert.equal(legacyMinutesToGems(500), 833);
});

test("formatting and parsing gems", () => {
  assert.equal(formatGems(1240), "12.40");
  assert.equal(formatGems(-300), "−3.00");
  assert.equal(formatGems(42, { sign: true }), "+0.42");
  assert.equal(parseGems("2.5"), 250);
  assert.equal(parseGems("0,75"), 75);
  assert.equal(parseGems("abc"), null);
});

test("the debt cap decides how far below zero a redemption may go", () => {
  assert.equal(canAfford(300, 200, 0), false);
  assert.equal(canAfford(300, 200, 100), true);
  assert.equal(shortfall(300, 200, 0), 100);
  assert.equal(shortfall(300, -50, 100), 250);
});

test("loans charge interest and repay from earnings, oldest first", () => {
  const loanA = tx("loan", 1000, { interestPercent: 10, repayPercent: 50, at: new Date(2026, 10, 1) });
  const loanB = tx("loan", 200, { interestPercent: 0, repayPercent: 100, at: new Date(2026, 10, 2) });
  const ledger = [loanA, loanB, tx("repay", -100, { loanUid: loanA.uid })];
  const [a, b] = loansOf(ledger);
  assert.equal(a.total, 1100);
  assert.equal(a.outstanding, 1000);
  assert.equal(b.outstanding, 200);
  assert.equal(debtOf(ledger), 1200);
  // 50% of 300 to A, then B takes its 100% share of the rest.
  assert.deepEqual(autoRepayments(300, ledger), [
    { loanUid: loanA.uid, amount: 150 },
    { loanUid: loanB.uid, amount: 150 },
  ]);
  assert.equal(balanceOf(ledger), 1100);
});

test("weekly price steps raise the price, then discounts apply", () => {
  const stepped = item({ priceStep: 50 });
  const ledger = [
    tx("redeem", -200, { itemUid: "item", at: new Date(2026, 10, 10) }), // this week
    tx("redeem", -200, { itemUid: "item", at: new Date(2026, 10, 3) }), // last week
  ];
  const price = priceOf(stepped, ledger, 10, NOW);
  assert.equal(price.steps, 1);
  assert.equal(price.stepped, 300);
  assert.equal(price.final, 270);
});

test("limits count bundle redemptions and block bundles", () => {
  const game = item({ uid: "game", limit: { count: 1, period: "day" } });
  const bundle = item({ uid: "bundle", title: "Evening", bundle: ["game"] });
  const ledger = [tx("redeem", -200, { itemUid: "bundle", bundleItemUids: ["game"], at: new Date(2026, 10, 11, 9) })];
  assert.equal(blockingLimit(game, [game, bundle], ledger, NOW)?.item.uid, "game");
  assert.equal(blockingLimit(bundle, [game, bundle], ledger, NOW)?.item.uid, "game");
  assert.equal(blockingLimit(game, [game, bundle], ledger, new Date(2026, 10, 12, 9)), null);
});

test("summary splits earning and spending", () => {
  const ledger = [
    tx("earn", 100, { tag: "uni" }),
    tx("redeem", -50, { itemUid: "a", itemTitle: "Snack", category: "Treats" }),
    tx("redeem", -30, { itemUid: "a", itemTitle: "Snack", category: "Treats", at: new Date(2026, 9, 1) }),
  ];
  const summary = summarizeLedger(ledger, NOW);
  assert.equal(summary.earned7, 100);
  assert.equal(summary.spent30, 50);
  assert.deepEqual(summary.topItems, [{ title: "Snack", count: 1, spent: 50 }]);
  assert.deepEqual(summary.byTag, [{ tag: "uni", earned: 100 }]);
});
