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
export type ShortcutCategory = "Navigation" | "Timer" | "Calendar" | "General";

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
    | "timer-extend"
    | "timer-skip-break"
    | "tag-next"
    | "tag-prev"
    | "toggle-sidebar"
    | "open-help"
    | "open-palette"
    | "toggle-notepad"
    /** Handled by the page or widget itself; documented here only */
    | "page-local";
}

/** Every application-wide shortcut, in display order */
export const SHORTCUTS: ShortcutDef[] = [
  // ── Navigation ──
  { keys: ["H"], description: "Go to Home", category: "Navigation", href: "/", action: "nav" },
  { keys: ["F"], description: "Go to Focus", category: "Navigation", href: "/focus", action: "nav" },
  { keys: ["T"], description: "Go to Focus Table", category: "Navigation", href: "/focus-table", action: "nav" },
  { keys: ["C"], description: "Go to Calendar", category: "Navigation", href: "/calendar", feature: "calendar", action: "nav" },
  { keys: ["G"], description: "Go to AI Chat", category: "Navigation", href: "/ai", feature: "aiChat", action: "nav" },
  { keys: ["P"], description: "Go to Projects", category: "Navigation", href: "/projects", feature: "projects", action: "nav" },
  { keys: ["O"], description: "Go to Notes", category: "Navigation", href: "/notes", feature: "notes", action: "nav" },
  { keys: ["R"], description: "Go to Rewards", category: "Navigation", href: "/rewards", feature: "rewards", action: "nav" },
  { keys: ["L"], description: "Go to Changelog", category: "Navigation", href: "/changelog", action: "nav" },
  { keys: ["S"], description: "Go to Settings", category: "Navigation", href: "/settings", action: "nav" },
  // ── Timer ──
  { keys: ["Space"], description: "Start / pause the timer", category: "Timer", action: "timer-toggle" },
  { keys: ["Shift", "R"], description: "Reset the timer", category: "Timer", action: "timer-reset" },
  { keys: ["+"], description: "Add 5 minutes (Pomodoro)", category: "Timer", action: "timer-extend" },
  { keys: ["N"], description: "Skip the break (Pomodoro)", category: "Timer", action: "timer-skip-break" },
  { keys: ["]"], description: "Next saved tag", category: "Timer", action: "tag-next" },
  { keys: ["["], description: "Previous saved tag", category: "Timer", action: "tag-prev" },
  // ── Calendar (only while the Calendar page is open) ──
  { keys: ["D"], description: "Day view (Calendar page)", category: "Calendar", feature: "calendar", action: "page-local" },
  { keys: ["W"], description: "Week view (Calendar page)", category: "Calendar", feature: "calendar", action: "page-local" },
  { keys: ["M"], description: "Month view (Calendar page)", category: "Calendar", feature: "calendar", action: "page-local" },
  { keys: ["T"], description: "Jump to today (Calendar page)", category: "Calendar", feature: "calendar", action: "page-local" },
  { keys: ["←"], description: "Previous day / week / month", category: "Calendar", feature: "calendar", action: "page-local" },
  { keys: ["→"], description: "Next day / week / month", category: "Calendar", feature: "calendar", action: "page-local" },
  // ── General ──
  { keys: ["Ctrl", "K"], description: "Open the command palette", category: "General", action: "open-palette" },
  { keys: ["Ctrl", "B"], description: "Toggle the sidebar", category: "General", action: "toggle-sidebar" },
  { keys: ["Alt", "N"], description: "Toggle Notepad view", category: "General", action: "toggle-notepad" },
  { keys: ["W"], description: "Export backup (data menu open)", category: "General", action: "page-local" },
  { keys: ["Q"], description: "Import backup (data menu open)", category: "General", action: "page-local" },
  { keys: ["A"], description: "Upload backup (data menu open)", category: "General", action: "page-local" },
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

interface CommandPaletteState {
  /** Whether the command palette is open */
  paletteOpen: boolean;
  /** Open/close the command palette */
  setPaletteOpen: (open: boolean) => void;
}

/** Visibility state for the command palette (Ctrl/⌘+K, sidebar, Top Bar) */
export const useCommandPalette = create<CommandPaletteState>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
}));

/** Visibility state for the shortcuts help dialog (shared between the
 *  sidebar button and the global `?` key handler) */
export const useShortcutsDialog = create<ShortcutsDialogState>((set) => ({
  helpOpen: false,
  setHelpOpen: (open) => set({ helpOpen: open }),
}));
