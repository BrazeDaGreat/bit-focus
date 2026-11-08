"use client";

/**
 * Rewards Page
 *
 * Two zones, like Home. "Spend" leads with the balance (savings goal and
 * loans beside it) and then the shop. Below a labelled seam, "Review" shows
 * where gems came from and went.
 *
 * The page owns the framing; each section renders its own panels.
 *
 * @since v0.11.0-beta (redesigned in v0.25.0-beta)
 */

import { useEffect, type JSX } from "react";
import { useRewards } from "@/hooks/useRewards";
import { BalancePanel } from "@/components/rewards/balance/BalancePanel";
import { ManageBalanceDialog } from "@/components/rewards/balance/ManageBalanceDialog";
import { RewardShop } from "@/components/rewards/shop/RewardShop";
import { RewardsReview } from "@/components/rewards/review/RewardsReview";

export default function RewardsPage(): JSX.Element {
  const loadRewards = useRewards((s) => s.loadRewards);

  useEffect(() => {
    void loadRewards();
  }, [loadRewards]);

  return (
    <div className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-6">
        <BalancePanel />
        <RewardShop />
      </div>

      {/* ── Seam ── */}
      <div className="mb-4 mt-10 flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Review
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <RewardsReview />

      <ManageBalanceDialog />
    </div>
  );
}
