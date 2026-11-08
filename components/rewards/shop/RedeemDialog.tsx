"use client";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { Gems } from "@/components/rewards/Gem";
import { RewardIcon } from "@/components/rewards/reward-icons";
import { useRewards, selectBalance } from "@/hooks/useRewards";
import { useRewardSettings } from "@/hooks/useRewardSettings";
import type { RewardItem } from "@/lib/db";
import { blockingLimit, canAfford, priceOf } from "@/lib/rewards";
import { availableAgain } from "./RewardItemCard";
import { PRIMARY, QUIET } from "./shop-menu";

export function RedeemDialog({ item: originalItem, now, onClose }: { item: RewardItem; now: Date; onClose: () => void }) {
  const { items, ledger, getTotalDiscount, discounts } = useRewards();
  const balance = useRewards(selectBalance);
  const debtCap = useRewardSettings(state => state.debtCap);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const item = items.find(candidate => candidate.id === originalItem.id);
  const discount = discounts.length ? getTotalDiscount() : 0;
  const price = priceOf(item ?? originalItem, ledger, discount, now);
  const blocked = item ? blockingLimit(item, items, ledger, now) : null;
  const disabled = !item || item.hidden || !!blocked || !canAfford(price.final, balance, debtCap);
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || disabled || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { const result = await useRewards.getState().redeem(item); if (result.ok) onClose(); }
    catch { toast.error("Couldn't redeem the item. Try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <ResponsiveDialog open onOpenChange={open => { if (!open && !busy) onClose(); }} title="Redeem reward" description="Review the price before spending your gems." dialogContentClassName="rounded-2xl sm:max-w-md">
    <form onSubmit={confirm} className="space-y-4 pt-2" aria-busy={busy}>
      <div className="flex gap-3 rounded-xl bg-muted/40 p-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60"><RewardIcon icon={(item ?? originalItem).icon} /></div><div className="min-w-0"><p className="break-words text-sm font-medium">{(item ?? originalItem).title}</p>{(item ?? originalItem).description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{(item ?? originalItem).description}</p>}</div></div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Listed price</dt><dd><Gems amount={price.base} /></dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Price step <span className="font-mono tabular-nums">(+{price.steps * (item?.priceStep ?? 0)}%)</span></dt><dd><Gems amount={price.stepped - price.base} sign /></dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Discount <span className="font-mono tabular-nums">(−{discount}%)</span></dt><dd><Gems amount={price.final - price.stepped} /></dd></div>
        <div className="flex justify-between gap-3 rounded-lg bg-muted/60 px-2 py-2 font-medium"><dt>Final price</dt><dd><Gems amount={price.final} /></dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Balance after</dt><dd><Gems amount={balance - price.final} /></dd></div>
      </dl>
      {disabled && <p role="status" className="text-xs text-muted-foreground">{!item ? "This item was removed. Choose another reward." : item.hidden ? "Show this item in the shop before redeeming it." : blocked ? `${availableAgain(blocked.status.resetsAt)} · ${blocked.item.title}` : "Keep focusing to earn the gems you need."}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={QUIET} disabled={busy} onClick={onClose}>Cancel</button><button autoFocus type="submit" className={PRIMARY} disabled={disabled || busy}>{busy ? "Redeeming…" : "Redeem"}</button></div>
    </form>
  </ResponsiveDialog>;
}
