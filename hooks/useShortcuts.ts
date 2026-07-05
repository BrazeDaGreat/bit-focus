/**
 * Keyboard Shortcuts Store and Registry
 *
 * Central definition of every application-wide keyboard shortcut plus a tiny
 * Zustand store controlling the visibility of the shortcuts help dialog.
 *
 * The registry is the single source of truth: the global key listener
 * (`components/GlobalShortcuts.tsx`) and the help dialog both read from it,
 * so the popup can never drift out of sync with actual behavior.
 *
 * Shortcuts tied to optional features carry a `feature` key and are filtered
 * out (both from handling and from the help dialog) when the feature is
 * disabled in user configuration.
 *
 * @fileoverview Shortcut definitions and help-dialog visibility state
 * @author BIT Focus Development Team
 * @since v0.18.5
 */

import { create } from "zustand";
import type { FeatureKey, FeatureToggles } from "@/hooks/useConfig";

/** Categories used to group shortcuts inside the help dialog */
export type ShortcutCategory = "Navigation" | "Timer" | "General";

export interface ShortcutDef {
  /** Keys shown in the help dialog, e.g. ["Shift", "R"] */
  keys: string[];
  /** Human description of what the shortcut does */
  description: string;
  /** Group heading in the help dialog */
  category: ShortcutCategory;
  /** Optional feature gate — hidden and inert when the feature is off */
  feature?: FeatureKey;
  /** Navigation target, when the shortcut is a page jump */
  href?: string;
  /** Matcher id consumed by the global key listener */
  action:
    | "nav"
    | "timer-toggle"
    | "timer-reset"
    | "toggle-sidebar"
    | "open-help";
}

/** Every application-wide shortcut, in display order */
export const SHORTCUTS: ShortcutDef[] = [
  // ── Navigation ──
  { keys: ["H"], description: "Go to Home", category: "Navigation", href: "/", action: "nav" },
  { keys: ["F"], description: "Go to Focus", category: "Navigation", href: "/focus", action: "nav" },
  { keys: ["C"], description: "Go to Calendar", category: "Navigation", href: "/calendar", feature: "calendar", action: "nav" },
  { keys: ["A"], description: "Go to AI Chat", category: "Navigation", href: "/ai", feature: "aiChat", action: "nav" },
  { keys: ["E"], description: "Go to Excalidraw", category: "Navigation", href: "/excalidraw", feature: "excalidraw", action: "nav" },
  { keys: ["P"], description: "Go to Projects", category: "Navigation", href: "/projects", feature: "projects", action: "nav" },
  { keys: ["R"], description: "Go to Rewards", category: "Navigation", href: "/rewards", feature: "rewards", action: "nav" },
  { keys: ["L"], description: "Go to Changelog", category: "Navigation", href: "/changelog", action: "nav" },
  // ── Timer ──
  { keys: ["Space"], description: "Start / pause the timer", category: "Timer", action: "timer-toggle" },
  { keys: ["Shift", "R"], description: "Reset the timer", category: "Timer", action: "timer-reset" },
  // ── General ──
  { keys: ["Ctrl", "B"], description: "Toggle the sidebar", category: "General", action: "toggle-sidebar" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "General", action: "open-help" },
];

/** Shortcuts visible/active for the given feature configuration */
export function activeShortcuts(featureToggles: FeatureToggles): ShortcutDef[] {
  return SHORTCUTS.filter((s) => !s.feature || featureToggles[s.feature]);
}

interface ShortcutsDialogState {
  /** Whether the shortcuts help dialog is open */
  helpOpen: boolean;
  /** Open/close the shortcuts help dialog */
  setHelpOpen: (open: boolean) => void;
}

/** Visibility state for the shortcuts help dialog (shared between the
 *  sidebar button and the global `?` key handler) */
export const useShortcutsDialog = create<ShortcutsDialogState>((set) => ({
  helpOpen: false,
  setHelpOpen: (open) => set({ helpOpen: open }),
}));
