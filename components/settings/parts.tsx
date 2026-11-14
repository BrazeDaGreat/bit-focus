"use client";

/**
 * Settings building blocks
 *
 * Every Settings section is built from the same four pieces so the page reads
 * as one surface: a Group (a plain label over a well), a Well (the soft filled
 * container), a Row (a label and hint against one control) and one button
 * style. Quiet buttons sit raised inside wells; only a section's primary
 * action is filled.
 *
 * @fileoverview Shared layout primitives for the Settings page.
 * @since v0.25.3
 */

import type { ComponentProps, JSX, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Fields inside a well: raised off the fill, at the controls' height and radius. */
export const FIELD_CLASS = "h-9 rounded-lg bg-background";

/** A plain label over a well. Sentence case, not micro-caps, so the section title leads. */
export function Group({
  title,
  aside,
  children,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-3 px-1">
          {title && <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

export function Well({
  className,
  ...props
}: ComponentProps<"div">): JSX.Element {
  return <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/60 p-1", className)} {...props} />;
}

/** One setting: label and optional hint on the left, its control on the right. Wraps on phones. */
export function Row({
  id,
  label,
  hint,
  children,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        "flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg px-3 py-2.5",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
        {id ? (
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
            {label}
          </Label>
        ) : (
          <span className="text-sm font-medium">{label}</span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** The one button shape on Settings. Quiet by default; `primary` for a section's main action. */
export function SettingsButton({
  primary,
  className,
  ...props
}: ComponentProps<typeof Button> & { primary?: boolean }): JSX.Element {
  return (
    <Button
      variant={primary ? "default" : "ghost"}
      className={cn(
        "h-9 gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
        !primary && "bg-background shadow-xs hover:bg-background/70",
        className
      )}
      {...props}
    />
  );
}
