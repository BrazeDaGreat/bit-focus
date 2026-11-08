"use client";

import { useEffect, type JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./ui/sidebar";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { useRewards, selectBalance } from "@/hooks/useRewards";
import { useRewardSettings } from "@/hooks/useRewardSettings";
import { useConfig } from "@/hooks/useConfig";
import { GemIcon, Gems } from "@/components/rewards/Gem";
import { debtOf, formatGems, goalOf, priceOf, progressToward, shortfall, startOfDay } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import BITFdata from "./BITFdata";
import FloatingNotepad from "./FloatingNotepad";
import QuickMessageDialog from "./QuickMessageDialog";
import MiniTimer from "./MiniTimer";
import SyncChip from "./auth/SyncChip";
import OfflineIndicator from "./OfflineIndicator";

/** Map of pathname patterns to display names */
const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/focus": "Focus",
  "/ai": "AI Chat (BETA)",
  "/calendar": "Calendar",
  "/projects": "Projects",
  "/rewards": "Rewards",
  "/changelog": "Changelog",
  "/focus-table": "Focus Table",
  "/settings": "Settings",
};

function usePageTitle(): string {
  const pathname = usePathname();

  if (pathname.startsWith("/projects/")) {
    return "Projects";
  }

  return PAGE_TITLES[pathname] ?? "BIT Focus";
}

export default function TopBar(): JSX.Element {
  const { items, ledger, ensureLoaded, getTotalDiscount } = useRewards();
  const balance = useRewards(selectBalance);
  const debtCap = useRewardSettings((s) => s.debtCap);
  const { featureToggles } = useConfig();
  const pageTitle = usePageTitle();
  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  const now = new Date();
  const today = startOfDay(now).getTime();
  const earnedToday = ledger.reduce((sum, tx) => sum + (tx.kind === "earn" && tx.at.getTime() >= today ? tx.amount : 0), 0);
  const debt = debtOf(ledger);
  const goal = goalOf(items);
  const goalPrice = goal ? priceOf(goal, ledger, getTotalDiscount(), now).final : 0;
  const progress = progressToward(goalPrice, balance, debtCap);
  const remaining = shortfall(goalPrice, balance, debtCap);
  const balanceTrigger = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/rewards" aria-label={`Balance ${formatGems(balance)} gems. Open rewards`}
          className={cn("inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-full bg-muted/70 px-2.5 font-mono text-xs tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-11 md:gap-2 md:px-3 md:text-sm lg:h-10", balance < 0 && "bg-destructive/12 text-destructive hover:bg-destructive/15")}>
          <span className="relative grid size-6 shrink-0 place-items-center">
            {goal && <svg viewBox="0 0 24 24" className="absolute inset-0 size-6 -rotate-90" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/20" />
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" pathLength="1" strokeDasharray={`${progress} 1`} strokeLinecap="round" className="text-primary motion-safe:transition-[stroke-dasharray] motion-safe:duration-700 motion-safe:ease-out" />
            </svg>}
            <GemIcon className={cn("size-3.5", balance >= 0 && "text-primary")} />
          </span>
          <Gems amount={balance} hideIcon />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" sideOffset={8} className="w-64 rounded-2xl border bg-card p-4 text-card-foreground shadow-xs animate-none data-[state=closed]:animate-none motion-safe:animate-in motion-safe:fade-in">
        <div className="grid gap-2 text-xs">
          <div className="flex justify-between gap-3"><span>Balance</span><Gems amount={balance} /></div>
          <div className="flex justify-between gap-3"><span>Earned today</span><Gems amount={earnedToday} /></div>
          {debt > 0 && <div className="flex justify-between gap-3"><span>Owed</span><Gems amount={debt} /></div>}
          {goal && <div className="mt-1 grid gap-2 rounded-xl bg-muted/60 p-2">
            <span className="font-medium">Goal: {goal.title}</span>
            <div role="progressbar" aria-label={`Savings for ${goal.title}`} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} /></div>
            <span>{remaining > 0 ? <><Gems amount={remaining} /> to go</> : "Ready to redeem"}</span>
          </div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
  return (
    <>
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
        {/* Keep content clear of the Android status bar when installed as a PWA. */}
        <div className="h-[env(safe-area-inset-top)] lg:hidden" aria-hidden="true" />

        {/* Phones get one compact row (navigation lives in the bottom dock);
            tablets stack a command shelf under the title; desktops use one wide row. */}
        <div className="flex h-14 items-center gap-1 pl-4 pr-2 md:grid md:h-auto md:min-h-14 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-2 md:gap-y-2 md:px-4 md:py-2 lg:h-16 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-3">
          {/* Primary Android-style app bar: navigation, destination, balance. */}
          <div className="flex min-w-0 flex-1 items-center gap-2 md:col-start-1 md:row-start-1">
            <SidebarTrigger className="hidden size-11 touch-manipulation rounded-full text-muted-foreground transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-95 motion-reduce:transition-none md:inline-flex lg:size-10" />
            <h1 className="truncate text-lg font-semibold leading-none tracking-tight md:text-xl lg:text-lg">
              {pageTitle}
            </h1>
            <OfflineIndicator />
          </div>

          {/* A dedicated command shelf prevents tools competing with the title. */}
          <div className="flex shrink-0 items-center md:col-span-2 md:row-start-2 md:h-12 md:min-w-0 md:gap-2 md:rounded-2xl md:bg-muted/70 md:p-1 md:ring-1 md:ring-border/40 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:h-10 lg:bg-transparent lg:p-0 lg:ring-0">
            {/* On phones the dock's Focus tab carries the live timer instead. */}
            <MiniTimer className="hidden h-10 w-fit max-w-40 flex-none border-0 bg-background shadow-sm ring-1 ring-border/70 [&_button]:size-9 [&_button]:touch-manipulation [&_button]:transition-transform [&_button:active]:scale-95 motion-reduce:[&_button]:transition-none md:flex lg:h-9 lg:max-w-none lg:border lg:shadow-none lg:ring-0 lg:[&_button]:size-7" />

            <div className="ml-auto flex shrink-0 items-center gap-0.5 text-muted-foreground md:text-foreground [&_button]:size-10 [&_button]:touch-manipulation [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-0 [&_button]:shadow-none [&_button]:transition-[background-color,color,transform] [&_button:active]:scale-95 [&_button:hover]:bg-muted md:rounded-xl md:bg-background md:p-0.5 md:shadow-sm md:ring-1 md:ring-border/70 md:[&_button]:rounded-[0.625rem] lg:bg-muted/60 lg:shadow-none lg:ring-0 lg:[&_button]:size-8 motion-reduce:[&_button]:transition-none">
              <SyncChip />
              <QuickMessageDialog />
              <FloatingNotepad />
              <BITFdata />
            </div>
          </div>

          {/* The balance is a compact tonal action, like an Android status chip. */}
          <div className="ml-1 shrink-0 md:col-start-2 md:row-start-1 md:ml-0 lg:col-start-3">
            {featureToggles.rewards && balanceTrigger}
          </div>
        </div>
      </header>

    </>
  );
}
