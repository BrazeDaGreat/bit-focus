/**
 * Theme Manager - Single Source of Truth for Themes
 *
 * Every theme's metadata lives here: value, label, picker icon, onboarding
 * swatch, and dark flag. Adding a theme means:
 *   1. Add a CSS class block in `app/globals.css` (Tailwind needs real CSS).
 *   2. Add one entry to `THEMES` below.
 * Everything else (sidebar picker, onboarding, layout provider mapping,
 * dark detection) derives from this registry.
 *
 * @fileoverview Central theme registry for BIT Focus
 * @author BIT Focus Development Team
 */

import type { IconType } from "react-icons";
import { FaSun, FaMoon } from "react-icons/fa";
import {
  FaGear,
  FaGem,
  FaPaintbrush,
  FaWater,
  FaLeaf,
  FaHeart,
  FaBook,
  FaSnowflake,
  FaFire,
} from "react-icons/fa6";
import { IoColorPalette } from "react-icons/io5";

export interface ThemeDefinition {
  /** Theme value passed to next-themes and matching the CSS class name. */
  value: string;
  /** Human-readable name shown in pickers. */
  label: string;
  /** Icon component for the sidebar theme picker. */
  icon: IconType;
  /** Extra Tailwind classes for the icon (accent color). */
  iconClass?: string;
  /** Decorative swatch trio `[background, accent, foreground]` for onboarding. */
  swatch: [string, string, string];
  /** Whether the theme is dark (drives dark-mode-aware components). */
  isDark: boolean;
}

/** All selectable themes, in display order. */
export const THEMES: ThemeDefinition[] = [
  { value: "system", label: "System", icon: FaGear, swatch: ["#71717a", "#a1a1aa", "#e4e4e7"], isDark: false },
  { value: "light", label: "Light", icon: FaSun, swatch: ["#ffffff", "#78716c", "#1c1917"], isDark: false },
  { value: "dark", label: "Dark", icon: FaMoon, swatch: ["#1c1917", "#a8a29e", "#fafaf9"], isDark: true },
  { value: "amethyst", label: "Amethyst", icon: FaGem, iconClass: "text-purple-400", swatch: ["#2a2440", "#a78bfa", "#e9d5ff"], isDark: true },
  { value: "amethystoverloaded", label: "Amethyst+", icon: FaGem, iconClass: "text-purple-700", swatch: ["#1a1626", "#7c5cdb", "#ede9fe"], isDark: true },
  { value: "bluenight", label: "Blue Night", icon: FaWater, iconClass: "text-cyan-400", swatch: ["#23272e", "#5ec4c4", "#e5e7eb"], isDark: true },
  { value: "amoled", label: "AMOLED", icon: IoColorPalette, iconClass: "text-neutral-400", swatch: ["#000000", "#404040", "#f5f5f5"], isDark: true },
  { value: "pastel-blue", label: "Pastel Blue", icon: FaPaintbrush, iconClass: "text-blue-300", swatch: ["#eff4fb", "#7aa3d6", "#3a4a5e"], isDark: false },
  { value: "pastel-orange", label: "Pastel Orange", icon: FaPaintbrush, iconClass: "text-orange-300", swatch: ["#fbf4ef", "#e0a06a", "#5e4a3a"], isDark: false },
  { value: "pastel-purple", label: "Pastel Purple", icon: FaPaintbrush, iconClass: "text-purple-300", swatch: ["#f6effb", "#b07ad6", "#4a3a5e"], isDark: false },
  { value: "evergreen", label: "Evergreen", icon: FaLeaf, iconClass: "text-emerald-400", swatch: ["#152018", "#5fc98d", "#d7ecdd"], isDark: true },
  { value: "rose", label: "Rosé", icon: FaHeart, iconClass: "text-rose-400", swatch: ["#fdf2f3", "#cf5f76", "#5e3a40"], isDark: false },
  { value: "parchment", label: "Parchment", icon: FaBook, iconClass: "text-amber-700", swatch: ["#f2e8d5", "#8a6a3c", "#3a3222"], isDark: false },
  { value: "nord", label: "Nord", icon: FaSnowflake, iconClass: "text-sky-300", swatch: ["#2e3440", "#88c0d0", "#eceff4"], isDark: true },
  { value: "ember", label: "Ember", icon: FaFire, iconClass: "text-orange-500", swatch: ["#231c15", "#e6963f", "#ecdfce"], isDark: true },
];

/** Union of theme values. */
export type ThemeValue = (typeof THEMES)[number]["value"];

/**
 * `value` prop for next-themes ThemeProvider: maps each theme value to its
 * CSS class name. "system" is excluded — next-themes handles it natively.
 */
export const THEME_CLASS_MAP: Record<string, string> = Object.fromEntries(
  THEMES.filter((t) => t.value !== "system").map((t) => [t.value, t.value])
);

/** Look up a theme definition; undefined for unknown values. */
export function getTheme(value: string | undefined): ThemeDefinition | undefined {
  return THEMES.find((t) => t.value === value);
}

/**
 * Whether a theme value is dark. "system" resolves via the optional
 * `resolvedTheme` (from next-themes) when provided.
 */
export function isDarkTheme(theme: string | undefined, resolvedTheme?: string): boolean {
  const value = theme === "system" ? resolvedTheme : theme;
  return getTheme(value)?.isDark ?? false;
}
