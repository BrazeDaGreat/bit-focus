"use client";

/**
 * Balance Panel
 *
 * The lead of the Rewards page: the balance, what was earned lately, and
 * beside it the savings goal, outstanding loans and active discounts. Every
 * balance change goes through `ManageBalanceDialog`; the rest of the panel's
 * actions live in its right-click menu (also behind the quiet more button).
 *
 * @since v0.25.0-beta
 */

import { useMemo, useState } from "react";
import { MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Gems } from "@/components/rewards/Gem";
import { RewardIcon } from "@/components/rewards/reward-icons";
import { useRewards, useRewardsUi } from "@/hooks/useRewards";
import { useRewardSettings } from "@/hooks/useRewardSettings";
import {
  balanceOf,
  focusMinutesFor,
  formatFocusTime,
  goalOf,
  loansOf,
  priceOf,
  progressToward,
  shortfall,
  startOfDay,
  startOfWeek,
} from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { DiscountsDialog } from "./DiscountsDialog";
import { openRepay } from "./ManageBalanceDialog";
import {
  EYEBROW,
  ICON_BUTTON,
  MenuCheck,
  MenuItem,
  MenuSeparator,
  MenuSub,
  PRIMARY,
  PointMenu,
  QUIET,
  Track,
  usePointMenu,
} from "./shared";

type MenuTarget = { kind: "panel" } | { kind: "goal" } | { kind: "loan"; uid: string };

export function BalancePanel() {
  const loaded = useRewards((s) => s.loaded);
  const items = useRewards((s) => s.items);
  const ledger = useRewards((s) => s.ledger);
  const discounts = useRewards((s) => s.discounts);
  const redeem = useRewards((s) => s.redeem);
  const setGoal = useRewards((s) => s.setGoal);
  const toggleDiscount = useRewards((s) => s.toggleDiscount);
  const openBalanceDialog = useRewardsUi((s) => s.openBalanceDialog);
  const rate = useRewardSettings((s) => s.rate);
  const debtCap = useRewardSettings((s) => s.debtCap);
  const menu = usePointMenu<MenuTarget>();
  const [discountsOpen, setDiscountsOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const balance = useMemo(() => balanceOf(ledger), [ledger]);
  const loans = useMemo(() => loansOf(ledger).filter((loan) => loan.outstanding > 0), [ledger]);
  const debt = loans.reduce((sum, loan) => sum + loan.outstanding, 0);

  const earned = useMemo(() => {
    const now = new Date();
    const day = startOfDay(now).getTime();
    const week = startOfWeek(now).getTime();
    let today = 0;
    let thisWeek = 0;
    for (const tx of ledger) {
      if (tx.kind !== "earn") continue;
      const t = tx.at.getTime();
      if (t >= week) thisWeek += tx.amount;
      if (t >= day) today += tx.amount;
    }
    return { today, thisWeek };
  }, [ledger]);

  const activeDiscounts = discounts.filter((d) => d.active);
  const discountPercent = Math.min(
    100,
    activeDiscounts.reduce((sum, d) => sum + d.percentage, 0),
  );
  const goal = goalOf(items);
  const goalPrice = goal ? priceOf(goal, ledger, discountPercent, new Date()).final : 0;
  const goalShort = goal ? shortfall(goalPrice, balance, debtCap) : 0;
  const goalProgress = goal ? progressToward(goalPrice, balance, debtCap) : 0;

  async function redeemGoal() {
    if (!goal || redeeming) return;
    setRedeeming(true);
    try {
      await redeem(goal);
    } finally {
      setRedeeming(false);
    }
  }

  if (!loaded) {
    return (
      <section className="rounded-2xl border bg-card p-5 shadow-xs" aria-busy>
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="flex flex-col gap-2 lg:w-72">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-3 w-48 rounded-md" />
            <Skeleton className="mt-2 h-10 w-40 rounded-lg" />
          </div>
          <Skeleton className="h-28 flex-1 rounded-xl" />
        </div>
      </section>
    );
  }

  const target = menu.menu?.target;

  return (
    <>
      <section
        aria-label="Balance"
        className="rounded-2xl border bg-card p-5 shadow-xs"
        onContextMenu={menu.onContextMenu({ kind: "panel" })}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
          {/* Lead: the balance */}
          <div className="flex min-w-0 flex-col gap-1 lg:w-72 lg:shrink-0">
            <span className={EYEBROW}>Balance</span>
            <Gems
              amount={balance}
              className={cn("font-mono text-4xl font-semibold tracking-tight", balance < 0 && "text-destructive")}
              iconClassName="size-7 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {earned.thisWeek > 0 ? (
                <>
                  <Gems amount={earned.today} sign hideIcon /> today · <Gems amount={earned.thisWeek} sign hideIcon />{" "}
                  this week
                </>
              ) : (
                <>Nothing earned this week · {rate === 1 ? "1 gem" : `${rate} gems`} per focused hour</>
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1">
              <button type="button" className={QUIET} onClick={() => openBalanceDialog("add")}>
                <SlidersHorizontal className="size-4" />
                Manage balance
              </button>
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label="More balance actions"
                title="More balance actions"
                onClick={menu.openFrom({ kind: "panel" })}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </div>

            {activeDiscounts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {activeDiscounts.map((discount) => (
                  <button
                    key={discount.id}
                    type="button"
                    onClick={() => setDiscountsOpen(true)}
                    className="inline-flex h-6 items-center gap-1 rounded-full bg-primary/12 px-2 text-xs font-medium text-primary outline-none transition-colors duration-150 hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
                    title="Manage discounts"
                  >
                    <span className="font-mono tabular-nums">−{discount.percentage}%</span>
                    <span className="max-w-32 truncate">{discount.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden w-px self-stretch bg-border lg:block" aria-hidden />

          {/* Beside: goal and loans */}
          <div className={cn("grid min-w-0 flex-1 gap-3", goal && loans.length > 0 && "md:grid-cols-2")}>
            {goal ? (
              <div
                className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/40 p-4"
                onContextMenu={menu.onContextMenu({ kind: "goal" })}
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs">
                    <RewardIcon icon={goal.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={EYEBROW}>Saving up for</span>
                    <p className="truncate text-sm font-semibold tracking-tight">{goal.title}</p>
                  </div>
                  <Gems amount={goalPrice} className="text-sm text-muted-foreground" />
                </div>
                <Track value={goalProgress} fillClassName={goalShort === 0 ? "bg-emerald-600" : undefined} />
                {goalShort > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    <Gems amount={goalShort} className="text-foreground" /> to go
                    {Number.isFinite(focusMinutesFor(goalShort, rate)) && (
                      <> · ≈ {formatFocusTime(focusMinutesFor(goalShort, rate))} of focus</>
                    )}
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-emerald-600">Ready to redeem</p>
                    <button
                      type="button"
                      className={cn(PRIMARY, "h-8")}
                      disabled={redeeming}
                      onClick={() => void redeemGoal()}
                    >
                      Redeem
                    </button>
                  </div>
                )}
              </div>
            ) : (
              loans.length === 0 && (
                <div className="flex items-center rounded-xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">
                    Right-click an item in the shop and choose Save up for this.
                  </p>
                </div>
              )
            )}

            {loans.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2 rounded-xl bg-muted/40 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={EYEBROW}>{loans.length === 1 ? "Loan" : "Loans"}</span>
                  <span className="text-xs text-muted-foreground">
                    <Gems amount={debt} className="text-destructive" /> owed
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {loans.map((loan) => (
                    <div
                      key={loan.uid}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                      onContextMenu={menu.onContextMenu({ kind: "loan", uid: loan.uid })}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span>
                            Borrowed <Gems amount={loan.principal} hideIcon />
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {loan.interestPercent > 0 ? `${loan.interestPercent}% interest` : "No interest"}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            <Gems amount={loan.outstanding} className="text-foreground" /> left
                          </span>
                        </div>
                        <Track value={loan.total > 0 ? loan.repaid / loan.total : 0} className="h-1" />
                        <p className="text-xs text-muted-foreground">
                          {loan.repayPercent > 0
                            ? `${loan.repayPercent}% of each earning goes to it`
                            : "Repaid by hand only"}
                        </p>
                      </div>
                      <button type="button" className={cn(QUIET, "h-8")} onClick={() => openRepay(loan.uid)}>
                        Repay
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <PointMenu
        point={menu.menu?.point ?? null}
        onClose={menu.close}
        label="Balance actions"
        returnFocus={menu.returnFocus}
      >
        {target?.kind === "goal" && goal && (
          <>
            {goalShort === 0 && <MenuItem onSelect={() => void redeemGoal()}>Redeem {goal.title}</MenuItem>}
            <MenuItem onSelect={() => void setGoal(null)}>Remove goal</MenuItem>
            <MenuSeparator />
          </>
        )}
        {target?.kind === "loan" && (
          <>
            <MenuItem onSelect={() => openRepay(target.uid)}>Repay this loan…</MenuItem>
            <MenuSeparator />
          </>
        )}
        <MenuItem onSelect={() => openBalanceDialog("add")}>Add gems…</MenuItem>
        <MenuItem onSelect={() => openBalanceDialog("throw")} disabled={balance <= 0}>
          Throw away gems…
        </MenuItem>
        <MenuItem onSelect={() => openBalanceDialog("loan")}>Take a loan…</MenuItem>
        {debt > 0 && <MenuItem onSelect={() => openBalanceDialog("repay")}>Repay loan…</MenuItem>}
        <MenuSeparator />
        {discounts.length > 0 ? (
          <MenuSub label="Discounts">
            {discounts.map((discount) => (
              <MenuCheck
                key={discount.id}
                checked={discount.active}
                onChange={() => discount.id != null && void toggleDiscount(discount.id)}
              >
                <span className="min-w-0 flex-1 truncate">{discount.title}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">−{discount.percentage}%</span>
              </MenuCheck>
            ))}
            <MenuSeparator />
            <MenuItem onSelect={() => setDiscountsOpen(true)}>Manage discounts…</MenuItem>
          </MenuSub>
        ) : (
          <MenuItem onSelect={() => setDiscountsOpen(true)}>Discounts…</MenuItem>
        )}
        {goal && target?.kind !== "goal" && <MenuItem onSelect={() => void setGoal(null)}>Remove goal</MenuItem>}
      </PointMenu>

      <DiscountsDialog open={discountsOpen} onOpenChange={setDiscountsOpen} />
    </>
  );
}
