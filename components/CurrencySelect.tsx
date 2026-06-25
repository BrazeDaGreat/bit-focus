/**
 * Currency Select - Shared Currency Dropdown
 *
 * A small wrapper around the shadcn/Radix Select primitive that renders the
 * app's supported currencies. Centralizes the option list so the onboarding
 * flow and the edit-details popup stay in sync, and replaces the native
 * `<select>` element which rendered inconsistently across themes.
 *
 * @fileoverview Reusable currency dropdown built on the shadcn Select.
 * @author BIT Focus Development Team
 * @since v0.18.2-beta
 */

"use client";

import type { JSX } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Supported currencies and their display labels. */
export const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "AED", label: "AED (د.إ)" },
  { value: "PKR", label: "PKR (₨)" },
] as const;

/**
 * Currency Select Component
 *
 * @param props.value - Currently selected currency code.
 * @param props.onChange - Called with the new currency code on selection.
 * @param props.id - Optional id forwarded to the trigger for label association.
 * @param props.className - Optional extra classes for the trigger.
 */
export default function CurrencySelect({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}): JSX.Element {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue placeholder="Select currency" />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
