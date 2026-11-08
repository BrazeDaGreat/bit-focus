"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { Gems } from "@/components/rewards/Gem";
import { REWARD_ICONS, isIconId } from "@/components/rewards/reward-icons";
import { useRewards, type RewardItemInput } from "@/hooks/useRewards";
import { useRewardSettings } from "@/hooks/useRewardSettings";
import type { RewardItem } from "@/lib/db";
import { focusMinutesFor, formatFocusTime, formatGems, parseGems, priceOf } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { FIELD, MENU_ITEM, MENU_SURFACE, Menu, PRIMARY, QUIET } from "./shop-menu";

export function ItemFormDialog({ item, initialCategory, onClose }: {
  item?: RewardItem;
  initialCategory?: string;
  onClose: () => void;
}) {
  const id = useId();
  const { items, ledger, discounts, getTotalDiscount } = useRewards();
  const { categories, rate, addCategory } = useRewardSettings();
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? formatGems(item.cost) : "");
  const [category, setCategory] = useState(item?.category ?? initialCategory ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "gift");
  const [emoji, setEmoji] = useState(item?.icon && !isIconId(item.icon) ? item.icon : "");
  const [type, setType] = useState<"item" | "bundle">(item?.bundle?.length ? "bundle" : "item");
  const [bundle, setBundle] = useState<string[]>(item?.bundle ?? []);
  const [limited, setLimited] = useState(!!item?.limit);
  const [limitCount, setLimitCount] = useState(String(item?.limit?.count ?? 1));
  const [period, setPeriod] = useState<"day" | "week">(item?.limit?.period ?? "day");
  const [stepped, setStepped] = useState(!!item?.priceStep);
  const [step, setStep] = useState(String(item?.priceStep ?? 20));
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Reading discounts keeps the reference price live when discounts change elsewhere.
  const discount = discounts.length ? getTotalDiscount() : 0;
  const candidates = items.filter(candidate => !candidate.bundle?.length && candidate.uid && candidate.id !== item?.id);
  const selectedItems = candidates.filter(candidate => bundle.includes(candidate.uid!));
  const referencePrice = selectedItems.reduce((sum, candidate) => sum + priceOf(candidate, ledger, discount, new Date()).final, 0);
  const parsedPrice = /^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(price.trim()) ? parseGems(price) : null;
  const labelClass = "grid gap-1.5 text-sm font-medium";

  function createCategory() {
    const name = newCategory.trim();
    if (!addCategory(name)) { toast.error(name ? "A category with that name already exists." : "Enter a category name."); return; }
    setCategory(name); setNewCategory(""); setAddingCategory(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!title.trim()) { setError("Give the item a title."); return; }
    if (parsedPrice === null || parsedPrice <= 0 || !Number.isSafeInteger(parsedPrice)) { setError("Enter a price above zero, with up to two decimal places."); return; }
    const count = Number(limitCount);
    const percent = Number(step);
    if (limited && (!Number.isSafeInteger(count) || count <= 0)) { setError("Enter a whole number above zero for the limit."); return; }
    if (stepped && (!Number.isFinite(percent) || percent <= 0)) { setError("Enter a price increase above zero."); return; }
    if (type === "bundle" && selectedItems.length === 0) { setError("Choose at least one item for the bundle."); return; }
    const input: RewardItemInput = {
      title: title.trim(), description: description.trim() || undefined, cost: parsedPrice,
      category: categories.includes(category) ? category : undefined, icon: icon || undefined,
      limit: limited ? { count, period } : undefined,
      priceStep: stepped ? percent : undefined,
      bundle: type === "bundle" ? selectedItems.map(candidate => candidate.uid!) : undefined,
    };
    setError(null); setSaving(true);
    try {
      if (item?.id != null) {
        const before = useRewards.getState().items.find(candidate => candidate.id === item.id);
        if (!before) { setError("This item was removed. Close this form and add a new item."); return; }
        await useRewards.getState().updateItem(item.id, input);
        // updateItem reports persistence errors itself; leave the form open if nothing changed.
        const saved = useRewards.getState().items.find(candidate => candidate.id === item.id);
        if (saved === before) return;
      } else if (!await useRewards.getState().addItem(input)) return;
      onClose();
    } catch { setError("Couldn't save the item. Try again."); }
    finally { setSaving(false); }
  }

  return <ResponsiveDialog open onOpenChange={open => { if (!open && !saving) onClose(); }}
    title={item ? "Edit item" : "Add item"} description="Give your focus something to look forward to."
    dialogContentClassName="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-xl"
    dialogBodyClassName="min-w-0">
    <form onSubmit={save} className="grid gap-4 pt-2" aria-busy={saving}>
      <label className={labelClass}>Title <span className="sr-only">(required)</span>
        <input autoFocus required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} className={FIELD} placeholder="An episode, a coffee, an afternoon out…" />
      </label>
      <label className={labelClass}>Description
        <textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} className={cn(FIELD, "h-auto resize-y py-2 font-normal")} placeholder="What does this reward include?" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <label htmlFor={`${id}-price`} className="text-sm font-medium">Price in gems <span className="sr-only">(required)</span></label>
          <input id={`${id}-price`} required inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} className={cn(FIELD, "font-mono tabular-nums")} placeholder="1.50" aria-describedby={`${id}-focus`} />
          <p id={`${id}-focus`} className="text-xs text-muted-foreground" aria-live="polite">{parsedPrice !== null && parsedPrice > 0 ? rate > 0 ? <>≈ <span className="font-mono tabular-nums">{formatFocusTime(focusMinutesFor(parsedPrice, rate))}</span> of focus</> : "Set an earn rate to see focus time." : "Enter a price to see its focus time."}</p>
        </div>
        <div className="grid content-start gap-1.5">
          <span id={`${id}-category-label`} className="text-sm font-medium">Category</span>
          <Menu.Root><Menu.Trigger className={cn(QUIET, "w-full justify-between bg-muted/60 text-foreground")} aria-labelledby={`${id}-category-label ${id}-category-value`}>
            <span id={`${id}-category-value`} className="truncate">{categories.includes(category) ? category : "Uncategorised"}</span><ChevronDown aria-hidden className="size-4" />
          </Menu.Trigger><Menu.Portal><Menu.Content className={MENU_SURFACE} collisionPadding={12} sideOffset={4}>
            <Menu.RadioGroup value={category} onValueChange={setCategory}>
              {["", ...categories].map(name => <Menu.RadioItem key={name} value={name} className={MENU_ITEM}><span className="w-4">{category === name && <Check aria-hidden className="size-4" />}</span>{name || "Uncategorised"}</Menu.RadioItem>)}
            </Menu.RadioGroup>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item className={MENU_ITEM} onSelect={() => setAddingCategory(true)}><Plus aria-hidden className="size-4" />New category…</Menu.Item>
          </Menu.Content></Menu.Portal></Menu.Root>
        </div>
      </div>
      {addingCategory && <div className="flex flex-wrap gap-2 rounded-xl bg-muted/60 p-2">
        <input autoFocus aria-label="New category name" placeholder="Category name" value={newCategory} onChange={event => setNewCategory(event.target.value)} className={cn(FIELD, "min-w-32 flex-1")} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); createCategory(); } }} />
        <button type="button" className={QUIET} onClick={createCategory}>Add category</button>
        <button type="button" className={QUIET} onClick={() => setAddingCategory(false)}>Cancel</button>
      </div>}
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        <div className="grid max-h-40 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 overflow-y-auto rounded-xl bg-muted/60 p-1">
          {REWARD_ICONS.map(({ id: iconId, label, Icon }) => <button key={iconId} type="button" title={label} aria-label={label} aria-pressed={icon === iconId}
            onClick={() => { setIcon(iconId); setEmoji(""); }} className={cn("flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring", icon === iconId ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted")}><Icon aria-hidden className="size-4" /></button>)}
        </div>
        <label className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">Or type an emoji
          <input value={emoji} onChange={event => { setEmoji(event.target.value); setIcon(event.target.value.trim() || "gift"); }} className={cn(FIELD, "w-24 text-center")} maxLength={24} placeholder="🎁" />
        </label>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Type</legend>
        <div className="flex rounded-xl bg-muted/60 p-1">
          {(["item", "bundle"] as const).map(value => <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)} className={cn(QUIET, "flex-1", type === value && "bg-background text-foreground shadow-xs")}>{value === "item" ? "Item" : "Bundle"}</button>)}
        </div>
      </fieldset>
      {type === "bundle" && <fieldset className="min-w-0 rounded-xl bg-muted/40 p-3">
        <legend className="px-1 text-sm font-medium">Included items</legend>
        <div className="max-h-44 overflow-y-auto">
          {candidates.length ? candidates.map(candidate => <label key={candidate.uid} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/50">
            <input type="checkbox" checked={bundle.includes(candidate.uid!)} onChange={event => setBundle(current => event.target.checked ? [...current, candidate.uid!] : current.filter(uid => uid !== candidate.uid))} className="size-4 accent-primary" />
            <span className="min-w-0 flex-1 truncate">{candidate.title}{candidate.hidden ? " (hidden)" : ""}</span><Gems amount={priceOf(candidate, ledger, discount, new Date()).final} className="text-xs text-muted-foreground" />
          </label>) : <div className="rounded-xl bg-muted/40 p-3"><p className="text-sm font-medium">No items to include yet</p><p className="mt-1 text-xs text-muted-foreground">Create an individual item first, then make a bundle.</p></div>}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Current total: <Gems amount={referencePrice} /></span><button type="button" disabled={!selectedItems.length || referencePrice <= 0} className={cn(QUIET, "h-9 text-xs")} onClick={() => setPrice(formatGems(referencePrice))}>Use as price</button></div>
        <p className="text-xs text-muted-foreground">The bundle’s own price is what you pay.</p>
      </fieldset>}
      <div className="grid gap-2">
        <button type="button" aria-pressed={limited} aria-expanded={limited} aria-controls={`${id}-limit`} onClick={() => setLimited(value => !value)} className={cn(QUIET, "justify-between", limited && "bg-muted text-foreground")}><span>Limit how often</span><span className="text-xs">{limited ? "On" : "Off"}</span></button>
        {limited && <div id={`${id}-limit`} className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/40 p-3">
          <label className={cn(labelClass, "min-w-24 flex-1")}>Redemptions<input type="number" inputMode="numeric" min="1" step="1" required value={limitCount} onChange={event => setLimitCount(event.target.value)} className={cn(FIELD, "font-mono tabular-nums")} /></label>
          <div className="flex rounded-xl bg-muted/60 p-1">{(["day", "week"] as const).map(value => <button key={value} type="button" aria-pressed={period === value} className={cn(QUIET, "h-9", period === value && "bg-background text-foreground shadow-xs")} onClick={() => setPeriod(value)}>Per {value}</button>)}</div>
        </div>}
        <button type="button" aria-pressed={stepped} aria-expanded={stepped} aria-controls={`${id}-step`} onClick={() => setStepped(value => !value)} className={cn(QUIET, "h-auto min-h-10 justify-between py-2 text-left", stepped && "bg-muted text-foreground")}><span>Raise the price after each redemption</span><span className="text-xs">{stepped ? "On" : "Off"}</span></button>
        {stepped && <div id={`${id}-step`} className="grid gap-2 rounded-xl bg-muted/40 p-3">
          <label className={labelClass}>Increase each time (%)<input type="number" inputMode="decimal" min="0.01" step="any" required value={step} onChange={event => setStep(event.target.value)} className={cn(FIELD, "font-mono tabular-nums")} /></label>
          <p className="text-xs text-muted-foreground">Adds this share of the listed price after each redemption. Resets every Monday.</p>
        </div>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-2"><button type="button" className={QUIET} disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className={PRIMARY} disabled={saving}>{saving ? "Saving…" : item ? "Save changes" : "Add item"}</button></div>
    </form>
  </ResponsiveDialog>;
}
