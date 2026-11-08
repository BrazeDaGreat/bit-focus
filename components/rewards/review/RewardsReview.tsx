"use client";

/**
 * Rewards Review
 *
 * The page's second zone: where gems came from and went. Earned vs spent by
 * week with the lists behind those numbers, and the recent activity log
 * beside it.
 *
 * @since v0.25.0-beta
 */

import { useMemo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Gems } from "@/components/rewards/Gem";
import { useRewards } from "@/hooks/useRewards";
import { useTag } from "@/hooks/useTag";
import { startOfWeek, summarizeLedger } from "@/lib/rewards";
import { getTagColor } from "@/lib/utils";
import type { WeekDatum } from "./EarnedSpentChart";
import { RecentActivity } from "./RecentActivity";

const EarnedSpentChart = dynamic(() => import("./EarnedSpentChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

const WEEKS = 8;

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Gems amount={amount} className="text-lg font-semibold tracking-tight" iconClassName="size-4 text-muted-foreground" />
    </div>
  );
}

function ListBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="px-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function ListRow({ label, detail, amount, dot }: { label: string; detail?: string; amount: number; dot?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
      {dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: dot }} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail && <span className="font-mono text-xs tabular-nums text-muted-foreground">{detail}</span>}
      <Gems amount={amount} hideIcon className="text-xs text-muted-foreground" />
    </div>
  );
}

export function RewardsReview() {
  const loaded = useRewards((s) => s.loaded);
  const ledger = useRewards((s) => s.ledger);
  const savedTags = useTag((s) => s.savedTags);

  const { summary, weeks, active } = useMemo(() => {
    const now = new Date();
    const first = startOfWeek(now);
    first.setDate(first.getDate() - 7 * (WEEKS - 1));
    const weeks: WeekDatum[] = Array.from({ length: WEEKS }, (_, i) => {
      const start = new Date(first);
      start.setDate(start.getDate() + 7 * i);
      return { week: format(start, "MMM d"), earned: 0, spent: 0 };
    });
    let active = false;
    for (const tx of ledger) {
      if (tx.kind !== "earn" && tx.kind !== "redeem") continue;
      active = true;
      const index = Math.floor((startOfWeek(tx.at).getTime() - first.getTime()) / (7 * 86_400_000) + 0.5);
      if (index < 0 || index >= WEEKS) continue;
      if (tx.kind === "earn") weeks[index].earned += tx.amount;
      else weeks[index].spent -= tx.amount;
    }
    return { summary: summarizeLedger(ledger, now), weeks, active };
  }, [ledger]);

  if (!loaded) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-[180px] w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title="Earned vs spent" subtitle={`By week, last ${WEEKS} weeks`}>
        {active ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Earned 7 days" amount={summary.earned7} />
              <Stat label="Earned 30 days" amount={summary.earned30} />
              <Stat label="Spent 30 days" amount={summary.spent30} />
            </div>

            <div className="h-[180px]">
              <EarnedSpentChart data={weeks} />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} /> Earned
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: "var(--chart-2)" }} /> Spent
              </span>
            </div>

            {(summary.topItems.length > 0 || summary.byTag.length > 0) && (
              <div className="flex flex-col gap-4 border-t pt-4">
                {summary.topItems.length > 0 && (
                  <ListBlock title="Top rewards · 30 days">
                    {summary.topItems.map((item, i) => (
                      <ListRow key={`${item.title}-${i}`} label={item.title} detail={`×${item.count}`} amount={item.spent} />
                    ))}
                  </ListBlock>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {summary.byTag.length > 0 && (
                    <ListBlock title="Earned by tag">
                      {summary.byTag.slice(0, 6).map(({ tag, earned }) => (
                        <ListRow
                          key={tag}
                          label={tag === "Untagged" ? tag : `#${tag}`}
                          amount={earned}
                          dot={tag === "Untagged" ? "var(--muted-foreground)" : getTagColor(savedTags, tag)[0]}
                        />
                      ))}
                    </ListBlock>
                  )}
                  {summary.byCategory.length > 0 && (
                    <ListBlock title="Spent by category">
                      {summary.byCategory.slice(0, 6).map(({ category, spent }) => (
                        <ListRow key={category} label={category} amount={spent} />
                      ))}
                    </ListBlock>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-sm font-medium">No gems earned or spent yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Finish a focus session to earn gems, then redeem something in the shop to see both here.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Recent activity" subtitle="Newest first · right-click an entry to undo it">
        <RecentActivity />
      </Panel>
    </div>
  );
}
