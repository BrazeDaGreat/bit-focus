"use client";

/**
 * Discounts Dialog
 *
 * Add, switch and delete discounts. Every active discount is added up and
 * taken off every price in the shop (capped at 100%).
 *
 * @since v0.25.0-beta
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { Switch } from "@/components/ui/switch";
import { useRewards } from "@/hooks/useRewards";
import { cn } from "@/lib/utils";
import { FIELD, ICON_BUTTON, PRIMARY } from "./shared";

export function DiscountsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const discounts = useRewards((s) => s.discounts);
  const addDiscount = useRewards((s) => s.addDiscount);
  const toggleDiscount = useRewards((s) => s.toggleDiscount);
  const deleteDiscount = useRewards((s) => s.deleteDiscount);
  const total = discounts.filter((d) => d.active).reduce((sum, d) => sum + d.percentage, 0);
  const [title, setTitle] = useState("");
  const [percent, setPercent] = useState("");

  const value = Number.parseInt(percent, 10);
  const valid = title.trim().length > 0 && Number.isFinite(value) && value >= 1 && value <= 100;

  async function submit() {
    if (!valid) return;
    await addDiscount(title.trim(), value);
    toast.success(`Added −${value}% ${title.trim()}`);
    setTitle("");
    setPercent("");
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Discounts"
      description="Active discounts are added up and taken off every price in the shop."
      dialogContentClassName="sm:max-w-md"
    >
      <div className="flex flex-col gap-4 pt-1">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            className={FIELD}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Name, like Weekend"
            aria-label="Discount name"
          />
          <div className="flex gap-2">
            <label className="relative w-full sm:w-24">
              <span className="sr-only">Percent off</span>
              <input
                className={cn(FIELD, "pr-7 font-mono tabular-nums")}
                inputMode="numeric"
                value={percent}
                onChange={(event) => setPercent(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                placeholder="20"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
            </label>
            <button type="submit" className={PRIMARY} disabled={!valid}>
              Add discount
            </button>
          </div>
        </form>

        {discounts.length === 0 ? (
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-sm font-medium">No discounts yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add one for a weekend or a good week, then switch it off when it ends.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 rounded-xl bg-muted/40 p-1">
            {discounts.map((discount) => (
              <div key={discount.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                <Switch
                  checked={discount.active}
                  onCheckedChange={() => discount.id != null && void toggleDiscount(discount.id)}
                  aria-label={`${discount.active ? "Switch off" : "Switch on"} ${discount.title}`}
                />
                <span className={cn("min-w-0 flex-1 truncate text-sm", !discount.active && "text-muted-foreground")}>
                  {discount.title}
                </span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">−{discount.percentage}%</span>
                <button
                  type="button"
                  className={cn(ICON_BUTTON, "h-8 w-8 hover:text-destructive")}
                  aria-label={`Delete ${discount.title}`}
                  title="Delete"
                  onClick={() => discount.id != null && void deleteDiscount(discount.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {total > 100 && (
          <p className="text-xs text-muted-foreground">Active discounts add up to {total}%; prices stop at free.</p>
        )}
      </div>
    </ResponsiveDialog>
  );
}
