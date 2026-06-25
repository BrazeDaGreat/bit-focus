/**
 * Color Picker - Swatch Grid with Fine-Tune Input
 *
 * A compact, dependency-free color picker built on the shadcn/Radix Popover.
 * Neither shadcn/ui nor Radix ships a color primitive, so this provides a
 * consistent, theme-aware control: a curated palette of swatches for quick
 * picks plus a native color input for anything in between.
 *
 * The value is a hex string (e.g. `#3b82f6`). The trigger shows the current
 * swatch and its hex in monospace, matching the app's data-display idiom.
 *
 * @fileoverview Reusable hex color picker.
 * @author BIT Focus Development Team
 * @since v0.18.2-beta
 */

"use client";

import { useState, type JSX } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FaCheck } from "react-icons/fa6";

/** Curated default palette, ordered by hue. */
const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
  "#64748b", "#78716c", "#a1a1aa", "#1c1917",
];

/** Normalize a hex string to a comparable lowercase 6-digit form, or null. */
function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  return null;
}

/**
 * Color Picker Component
 *
 * @param props.value - Current color as a hex string.
 * @param props.onChange - Called with the selected hex string.
 * @param props.id - Optional id forwarded to the trigger for label association.
 * @param props.className - Optional extra classes for the trigger button.
 */
export default function ColorPicker({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (hex: string) => void;
  id?: string;
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const current = normalizeHex(value) ?? "#3b82f6";

  const pick = (hex: string) => {
    onChange(hex);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
        >
          <span
            className="size-5 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: current }}
          />
          <span className="font-mono uppercase tracking-wide text-muted-foreground">
            {current}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="grid grid-cols-5 gap-2">
          {PALETTE.map((hex) => {
            const active = normalizeHex(hex) === current;
            return (
              <button
                key={hex}
                type="button"
                onClick={() => pick(hex)}
                aria-label={hex}
                aria-pressed={active}
                className="grid size-7 place-items-center rounded-full border border-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: hex }}
              >
                {active && (
                  <FaCheck className="size-2.5 text-white drop-shadow" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-full border border-black/10">
            <span
              className="block size-full"
              style={{ backgroundColor: current }}
            />
            <input
              type="color"
              value={current}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Custom color"
            />
          </label>
          <span className="text-xs text-muted-foreground">
            Custom —{" "}
            <span className="font-mono uppercase tracking-wide text-foreground">
              {current}
            </span>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
