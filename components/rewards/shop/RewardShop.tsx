"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps, type FormEvent } from "react";
import { Check, MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { Skeleton as BaseSkeleton } from "@/components/ui/skeleton";
import { useRewards, selectBalance } from "@/hooks/useRewards";
import { useRewardSettings } from "@/hooks/useRewardSettings";
import type { RewardItem } from "@/lib/db";
import { priceOf, redemptionsOf } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { ItemFormDialog } from "./ItemFormDialog";
import { RedeemDialog } from "./RedeemDialog";
import { RewardItemCard } from "./RewardItemCard";
import { FIELD, MENU_ITEM, Menu, PRIMARY, QUIET, ShopContextMenu, Submenu } from "./shop-menu";

const SORTS = [
  ["featured", "Featured"], ["price-low", "Price low → high"], ["price-high", "Price high → low"],
  ["last-redeemed", "Last redeemed"], ["most-redeemed", "Most redeemed"], ["name", "Name"],
] as const;
type Sort = typeof SORTS[number][0];
type CategoryEdit = { from?: string };

function Skeleton({ className, ...props }: ComponentProps<typeof BaseSkeleton>) {
  return <BaseSkeleton {...props} className={cn("animate-none motion-safe:animate-pulse", className)} />;
}

export function RewardShop() {
  const { items, ledger, loading, loaded, discounts, getTotalDiscount } = useRewards();
  const balance = useRewards(selectBalance);
  const { categories, rate, debtCap, moveCategory } = useRewardSettings();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("featured");
  const [showHidden, setShowHidden] = useState(false);
  const [viewLoaded, setViewLoaded] = useState(false);
  const [initialLoadFinished, setInitialLoadFinished] = useState(false);
  const [form, setForm] = useState<{ item?: RewardItem } | null>(null);
  const [categoryEdit, setCategoryEdit] = useState<CategoryEdit | null>(null);
  const [redeeming, setRedeeming] = useState<RewardItem | null>(null);
  const [quickRedeeming, setQuickRedeeming] = useState(false);
  const quickRedeemingRef = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const discount = discounts.length ? getTotalDiscount() : 0;
  useEffect(() => {
    void useRewards.getState().ensureLoaded()
      .catch(() => toast.error("Couldn't load the shop. Refresh to try again."))
      .finally(() => setInitialLoadFinished(true));
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("rewards-shop-view") ?? "null");
      if (saved && SORTS.some(([value]) => value === saved.sort)) setSort(saved.sort);
      if (typeof saved?.showHidden === "boolean") setShowHidden(saved.showHidden);
    } catch {}
    setViewLoaded(true);
  }, []);
  useEffect(() => {
    if (!viewLoaded) return;
    try { localStorage.setItem("rewards-shop-view", JSON.stringify({ sort, showHidden })); } catch {}
  }, [sort, showHidden, viewLoaded]);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);

  const visibleCategories = categories.filter(name => items.some(item => (showHidden || !item.hidden) && item.category === name));
  const hasUncategorised = items.some(item => (showHidden || !item.hidden) && !categories.includes(item.category ?? ""));
  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const lastRedeemed = new Map<string, number>();
    for (const tx of ledger) {
      if (tx.kind !== "redeem") continue;
      for (const uid of [tx.itemUid, ...(tx.bundleItemUids ?? [])]) {
        if (uid) lastRedeemed.set(uid, Math.max(lastRedeemed.get(uid) ?? 0, tx.at.getTime()));
      }
    }
    const rows = items.filter(item => (showHidden || !item.hidden)
      && (category === null || (categories.includes(item.category ?? "") ? item.category : "") === category)
      && (!query || `${item.title} ${item.description ?? ""}`.toLocaleLowerCase().includes(query)))
      .map(item => ({ item, price: priceOf(item, ledger, discount, now).final, count: item.uid ? redemptionsOf(item.uid, ledger, new Date(0)) : 0, last: lastRedeemed.get(item.uid ?? "") ?? 0 }));
    rows.sort((a, b) => {
      let order = 0;
      switch (sort) {
        case "featured": order = Number(!!b.item.goal) - Number(!!a.item.goal) || Number(!!b.item.pinned) - Number(!!a.item.pinned) || b.item.createdAt.getTime() - a.item.createdAt.getTime(); break;
        case "price-low": order = a.price - b.price; break;
        case "price-high": order = b.price - a.price; break;
        case "last-redeemed": order = b.last - a.last; break;
        case "most-redeemed": order = b.count - a.count; break;
      }
      return order || a.item.title.localeCompare(b.item.title);
    });
    return rows.map(row => row.item);
  }, [items, ledger, discount, now, search, category, categories, showHidden, sort]);

  function run(action: () => Promise<unknown>) { void action().catch(() => toast.error("Couldn't update the shop. Try again.")); }
  function categoryMenu(name: string) {
    const index = categories.indexOf(name);
    return <>
      <Menu.Item className={MENU_ITEM} onSelect={() => setCategoryEdit({})}>New category…</Menu.Item>
      <Menu.Item className={MENU_ITEM} onSelect={() => setCategoryEdit({ from: name })}>Rename…</Menu.Item>
      <Menu.Item className={MENU_ITEM} disabled={index <= 0} onSelect={() => moveCategory(index, index - 1)}>Move left</Menu.Item>
      <Menu.Item className={MENU_ITEM} disabled={index < 0 || index >= categories.length - 1} onSelect={() => moveCategory(index, index + 1)}>Move right</Menu.Item>
      <Menu.Separator className="my-1 h-px bg-border" />
      <Menu.Item className={cn(MENU_ITEM, "text-destructive")} onSelect={() => run(async () => { await useRewards.getState().deleteCategory(name); if (category === name) setCategory(""); })}>Delete category</Menu.Item>
    </>;
  }
  const viewMenu = <>
    <Submenu label="Sort by"><Menu.RadioGroup value={sort} onValueChange={value => setSort(value as Sort)}>
      {SORTS.map(([value, label]) => <Menu.RadioItem key={value} value={value} className={MENU_ITEM}><span className="w-4"><Menu.ItemIndicator><Check aria-hidden className="size-4" /></Menu.ItemIndicator></span>{label}</Menu.RadioItem>)}
    </Menu.RadioGroup></Submenu>
    <Menu.CheckboxItem className={MENU_ITEM} checked={showHidden} onCheckedChange={setShowHidden}><span className="w-4"><Menu.ItemIndicator><Check aria-hidden className="size-4" /></Menu.ItemIndicator></span>Show hidden items</Menu.CheckboxItem>
    <Menu.Separator className="my-1 h-px bg-border" />
    <Menu.Item className={MENU_ITEM} onSelect={() => setCategoryEdit({})}>New category…</Menu.Item>
    {!!categories.length && <Submenu label="Manage categories">{categories.map(name => <Submenu key={name} label={name}>{categoryMenu(name)}</Submenu>)}</Submenu>}
  </>;

  async function redeem(item: RewardItem, immediately = false) {
    if (!immediately) { setRedeeming(item); return; }
    if (quickRedeemingRef.current) return;
    quickRedeemingRef.current = true; setQuickRedeeming(true);
    try { await useRewards.getState().redeem(item); }
    catch { toast.error("Couldn't redeem the item. Try again."); }
    finally { quickRedeemingRef.current = false; setQuickRedeeming(false); setNow(new Date()); }
  }
  const emptyTitle = !loaded ? "The shop couldn't load" : !items.length ? "Your reward shelf is empty" : search.trim() ? "No rewards match your search" : category !== null ? "No rewards in this category" : "No visible rewards";
  const emptyHint = !loaded ? "Refresh the page to try loading your rewards again." : !items.length ? "Add an item to turn your focus into something to look forward to." : search.trim() ? "Try a shorter search, or choose All to search every category." : category !== null ? "Choose All, or add an item to this category." : "Open the shop view menu and turn on Show hidden items, or add an item.";
  return <>
    <ShopContextMenu label="Shop view" menu={viewMenu} className="min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {openMenu => <>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-40 flex-1 sm:max-w-64"><Search aria-hidden className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><span className="sr-only">Search reward titles and descriptions</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search rewards…" className={cn(FIELD, "bg-muted/40 pl-9")} /></label>
          <div className="flex max-w-full flex-wrap items-center gap-1" aria-label="Filter rewards by category">
            <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={cn(QUIET, category === null && "bg-muted text-foreground")}>All</button>
            {visibleCategories.map(name => <ShopContextMenu key={name} label={`Manage category ${name}`} className="min-w-0 max-w-full rounded-lg" menu={categoryMenu(name)}>
              <button type="button" aria-pressed={category === name} title={`${name} · Right-click for category actions`} onClick={() => setCategory(name)} className={cn(QUIET, "max-w-full", category === name && "bg-muted text-foreground")}><span className="truncate">{name}</span></button>
            </ShopContextMenu>)}
            {hasUncategorised && <button type="button" aria-pressed={category === ""} onClick={() => setCategory("")} className={cn(QUIET, category === "" && "bg-muted text-foreground")}>Uncategorised</button>}
          </div>
          <div className="ml-auto flex items-center gap-1"><button type="button" className={cn(QUIET, "w-10 px-0")} aria-label="Shop view and category actions" aria-haspopup="menu" title="Shop view and category actions" onClick={openMenu}><MoreHorizontal aria-hidden className="size-4" /></button><button type="button" className={PRIMARY} disabled={!loaded} onClick={() => setForm({})}><Plus aria-hidden className="size-4" />Add item</button></div>
        </div>
        {loading || (!loaded && !initialLoadFinished) ? <div role="status" aria-label="Loading rewards" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><span className="sr-only">Loading rewards…</span>{Array.from({ length: 8 }, (_, index) => <div key={index} className="rounded-2xl border bg-card p-5 shadow-xs"><div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><Skeleton className="h-4 w-24 rounded-lg" /></div><Skeleton className="mt-4 h-3 w-full rounded-lg" /><Skeleton className="mt-2 h-3 w-2/3 rounded-lg" /><Skeleton className="mt-8 h-6 w-20 rounded-lg" /><Skeleton className="mt-2 h-3 w-28 rounded-lg" /><Skeleton className="mt-4 h-10 w-full rounded-lg" /></div>)}</div>
          : matches.length ? <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{matches.map(item => <RewardItemCard key={item.uid ?? item.id} item={item} items={items} ledger={ledger} categories={categories} discount={discount} balance={balance} rate={rate} debtCap={debtCap} now={now} busy={quickRedeeming} onEdit={item => setForm({ item })} onRedeem={(item, immediately) => { void redeem(item, immediately); }} />)}</div>
            : <div className="rounded-xl bg-muted/40 p-5"><p className="text-sm font-medium">{emptyTitle}</p><p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p></div>}
      </>}
    </ShopContextMenu>
    {form && <ItemFormDialog key={form.item?.id ?? "new"} item={form.item} initialCategory={category ?? undefined} onClose={() => setForm(null)} />}
    {categoryEdit && <CategoryDialog key={categoryEdit.from ?? "new"} from={categoryEdit.from} onClose={() => setCategoryEdit(null)} onRenamed={(from, to) => { if (category === from) setCategory(to); }} />}
    {redeeming && <RedeemDialog item={redeeming} now={now} onClose={() => { setRedeeming(null); setNow(new Date()); }} />}
  </>;
}

function CategoryDialog({ from, onClose, onRenamed }: { from?: string; onClose: () => void; onRenamed: (from: string, to: string) => void }) {
  const [name, setName] = useState(from ?? "");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Enter a category name."); return; }
    setBusy(true);
    try {
      const ok = from !== undefined ? await useRewards.getState().renameCategory(from, trimmed) : useRewardSettings.getState().addCategory(trimmed);
      if (!ok) { toast.error("A category with that name already exists."); return; }
      if (from !== undefined) onRenamed(from, trimmed);
      onClose();
    } catch { toast.error("Couldn't save the category. Try again."); }
    finally { setBusy(false); }
  }
  return <ResponsiveDialog open onOpenChange={open => { if (!open && !busy) onClose(); }} title={from !== undefined ? "Rename category" : "New category"} description="Keep related rewards together." dialogContentClassName="rounded-2xl sm:max-w-sm">
    <form onSubmit={save} className="grid gap-4 pt-2" aria-busy={busy}><label className="grid gap-1.5 text-sm font-medium">Category name<input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} className={FIELD} /></label><div className="flex justify-end gap-2"><button type="button" className={QUIET} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={PRIMARY} disabled={busy}>{busy ? "Saving…" : from !== undefined ? "Save changes" : "Add category"}</button></div></form>
  </ResponsiveDialog>;
}
