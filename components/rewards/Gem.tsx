/**
 * Gems - The Rewards Currency on Screen
 *
 * One glyph and one number format for gems everywhere: shop prices, the
 * balance, the TopBar pill, toasts and settings. Amounts are hundredths of a
 * gem (see `lib/rewards.ts`).
 *
 * @since v0.25.0-beta
 */

import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGems } from "@/lib/rewards";

/** The gem glyph, sized to the surrounding text. */
export function GemIcon({ className }: { className?: string }) {
  return <Gem aria-hidden className={cn("size-[0.9em] shrink-0", className)} strokeWidth={2.25} />;
}

/**
 * An amount of gems: glyph, then the number in mono.
 *
 * @param amount - Hundredths of a gem.
 * @param sign - Prefix "+" on gains.
 * @param hideIcon - Number only, for places that already show the glyph.
 */
export function Gems({
  amount,
  sign,
  hideIcon,
  className,
  iconClassName,
}: {
  amount: number;
  sign?: boolean;
  hideIcon?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono tabular-nums", className)}>
      {!hideIcon && <GemIcon className={iconClassName} />}
      {formatGems(amount, { sign })}
      <span className="sr-only"> gems</span>
    </span>
  );
}
