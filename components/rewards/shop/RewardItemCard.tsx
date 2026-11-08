"use client";

import { format, isTomorrow } from "date-fns";
import { MoreHorizontal, Pin, Target } from "lucide-react";
import { toast } from "sonner";
import { Gems } from "@/components/rewards/Gem";
import { RewardIcon } from "@/components/rewards/reward-icons";
import { useRewards } from "@/hooks/useRewards";
import type { RewardItem, RewardTransaction } from "@/lib/db";
import { blockingLimit, canAfford, focusMinutesFor, formatFocusTime, limitOf, priceOf, progressToward, shortfall } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { MENU_ITEM, Menu, PRIMARY, QUIET, ShopContextMenu, Submenu } from "./shop-menu";

export function availableAgain(at: Date) {
  return `Available again ${isTomorrow(at) ? "tomorrow" : format(at, "EEE")}`;
}

export function RewardItemCard({ item, items, ledger, categories, discount, balance, rate, debtCap, now, busy, onEdit, onRedeem }: {
  item: RewardItem;
  items: RewardItem[];
  ledger: RewardTransaction[];
  categories: string[];
  discount: number;
  balance: number;
  rate: number;
  debtCap: number;
  now: Date;
  busy: boolean;
  onEdit: (item: RewardItem) => void;
  onRedeem: (item: RewardItem, immediately?: boolean) => void;
}) {
  const price = priceOf(item, ledger, discount, now);
  const affordable = canAfford(price.final, balance, debtCap);
  const missing = shortfall(price.final, balance, debtCap);
  const limit = limitOf(item, ledger, now);
  const blocked = blockingLimit(item, items, ledger, now);
  const disabled = busy || !!item.hidden || !affordable || !!blocked;
  const contents = (item.bundle ?? []).map(uid => items.find(candidate => candidate.uid === uid)).filter((candidate): candidate is RewardItem => !!candidate);
  const savings = contents.reduce((sum, candidate) => sum + priceOf(candidate, ledger, discount, now).final, 0) - price.final;
  const id = item.id;
  const act = (action: () => Promise<unknown>) => { void action().catch(() => toast.error("Couldn't update the item. Try again.")); };
  const menu = <>
    <Menu.Item className={MENU_ITEM} disabled={disabled} onSelect={() => onRedeem(item)}>Redeem…</Menu.Item>
    <Menu.Item className={MENU_ITEM} disabled={id == null} onSelect={() => onEdit(item)}>Edit</Menu.Item>
    <Menu.Item className={MENU_ITEM} disabled={id == null} onSelect={() => act(() => useRewards.getState().duplicateItem(id!))}>Duplicate</Menu.Item>
    <Menu.Separator className="my-1 h-px bg-border" />
    <Menu.Item className={MENU_ITEM} disabled={id == null} onSelect={() => act(() => useRewards.getState().updateItem(id!, { pinned: !item.pinned }))}>{item.pinned ? "Unpin" : "Pin to top"}</Menu.Item>
    <Menu.Item className={MENU_ITEM} disabled={id == null} onSelect={() => act(() => useRewards.getState().setGoal(item.goal ? null : id!))}>{item.goal ? "Remove goal" : "Save up for this"}</Menu.Item>
    <Menu.Item className={MENU_ITEM} disabled={id == null} onSelect={() => act(() => useRewards.getState().updateItem(id!, { hidden: !item.hidden }))}>{item.hidden ? "Show in shop" : "Hide"}</Menu.Item>
    <Submenu label="Move to category">
      <Menu.RadioGroup value={categories.includes(item.category ?? "") ? item.category : ""} onValueChange={category => { if (id != null) act(() => useRewards.getState().updateItem(id, { category: category || undefined })); }}>
        {[...categories, ""].map(category => <Menu.RadioItem key={category} value={category} disabled={id == null} className={MENU_ITEM}><Menu.ItemIndicator><span aria-hidden>✓</span></Menu.ItemIndicator>{category || "Uncategorised"}</Menu.RadioItem>)}
      </Menu.RadioGroup>
    </Submenu>
    <Menu.Separator className="my-1 h-px bg-border" />
    <Menu.Item className={cn(MENU_ITEM, "text-destructive")} disabled={id == null} onSelect={() => act(() => useRewards.getState().deleteItem(id!))}>Delete</Menu.Item>
  </>;

  return <ShopContextMenu label={`Actions for ${item.title}`} menu={menu} className={cn("group relative flex min-w-0 flex-col rounded-2xl border bg-card p-5 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring", item.hidden && "opacity-55")}>
    {openMenu => <>
      <button type="button" aria-label={`More actions for ${item.title}`} aria-haspopup="menu" title="More actions" onClick={openMenu}
        className={cn(QUIET, "absolute right-3 top-3 size-9 px-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100")}><MoreHorizontal aria-hidden className="size-4" /></button>
      <div className="flex min-w-0 items-start gap-3 pr-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground"><RewardIcon icon={item.icon} /></div>
        <div className="min-w-0 self-center"><h3 className="break-words text-sm font-semibold tracking-tight">{item.title}</h3>
          {(item.pinned || item.goal || item.hidden || item.bundle?.length) && <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {item.goal && <span className="inline-flex items-center gap-1 text-primary"><Target aria-hidden className="size-3" />Savings goal</span>}
            {item.pinned && <span className="inline-flex items-center gap-1"><Pin aria-hidden className="size-3" />Pinned</span>}
            {!!item.bundle?.length && <span>Bundle</span>}{item.hidden && <span>Hidden</span>}
          </div>}
        </div>
      </div>
      {item.description && <p className="mt-3 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
      <div className="mt-3 grid gap-1 text-xs leading-relaxed text-muted-foreground">
        {blocked ? <p title={`${blocked.item.title}: ${blocked.status.count} per ${blocked.status.period}`} className="font-mono tabular-nums">{availableAgain(blocked.status.resetsAt)}{blocked.item.uid !== item.uid && <span className="font-sans"> · {blocked.item.title}</span>}</p>
          : limit && <p><span className="font-mono tabular-nums">{limit.count}</span> per {limit.period} · <span className="font-mono tabular-nums">{limit.used}</span> used</p>}
        {!!item.priceStep && <p><span className="font-mono tabular-nums">+{item.priceStep}%</span> per redemption this week</p>}
        {!!item.bundle?.length && <>
          <p className="line-clamp-2">Includes {contents.map(candidate => candidate.title).join(", ") || "removed items"}{contents.length < item.bundle.length && contents.length > 0 ? ", removed item" : ""}</p>
          {savings > 0 && <p>Save <Gems amount={savings} /> <span aria-hidden>gems</span></p>}
        </>}
      </div>
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-baseline gap-2"><Gems amount={price.final} className="text-xl font-semibold tracking-tight" />{(price.stepped !== price.base || price.final !== price.stepped) && <s className="text-xs text-muted-foreground"><Gems amount={price.base} /></s>}</div>
        <p className="mt-1 text-xs text-muted-foreground">{rate > 0 ? <>≈ <span className="font-mono tabular-nums">{formatFocusTime(focusMinutesFor(price.final, rate))}</span> of focus</> : "Set an earn rate to see focus time."}</p>
        {!affordable && <div className="mt-3 space-y-1.5">
          <div role="progressbar" aria-label={`Progress toward ${item.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressToward(price.final, balance, debtCap) * 100)} className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progressToward(price.final, balance, debtCap) * 100}%` }} /></div>
          <p className="text-xs text-muted-foreground"><Gems amount={missing} /> to go{rate > 0 && <> · ≈ <span className="font-mono tabular-nums">{formatFocusTime(focusMinutesFor(missing, rate))}</span> focus</>}</p>
        </div>}
        <button type="button" disabled={disabled} title="Shift-click to redeem without confirming" className={cn(PRIMARY, "mt-4 w-full")} onClick={event => onRedeem(item, event.shiftKey)}>Redeem</button>
      </div>
    </>}
  </ShopContextMenu>;
}
