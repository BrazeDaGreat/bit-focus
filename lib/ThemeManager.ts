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
  { value: "light", label: "Light", icon: FaSun, swatch: ["oklch(0.930 0.028 295)", "oklch(0.500 0.075 290)", "oklch(0.290 0.025 290)"], isDark: false },
  { value: "dark", label: "Dark", icon: FaMoon, swatch: ["oklch(0.225 0.018 285)", "oklch(0.745 0.070 285)", "oklch(0.900 0.018 285)"], isDark: true },
  { value: "amethyst", label: "Amethyst", icon: FaGem, iconClass: "text-purple-400", swatch: ["oklch(0.235 0.030 300)", "oklch(0.740 0.085 300)", "oklch(0.900 0.022 295)"], isDark: true },
  { value: "amethystoverloaded", label: "Amethyst+", icon: FaGem, iconClass: "text-purple-700", swatch: ["oklch(0.200 0.040 300)", "oklch(0.690 0.100 300)", "oklch(0.900 0.028 295)"], isDark: true },
  { value: "bluenight", label: "Blue Night", icon: FaWater, iconClass: "text-cyan-400", swatch: ["oklch(0.220 0.028 245)", "oklch(0.740 0.065 215)", "oklch(0.900 0.018 220)"], isDark: true },
  { value: "amoled", label: "AMOLED", icon: IoColorPalette, iconClass: "text-neutral-400", swatch: ["oklch(0.145 0.012 285)", "oklch(0.700 0.045 285)", "oklch(0.870 0.014 285)"], isDark: true },
  { value: "pastel-blue", label: "Pastel Blue", icon: FaPaintbrush, iconClass: "text-blue-300", swatch: ["oklch(0.925 0.035 235)", "oklch(0.510 0.075 240)", "oklch(0.300 0.028 250)"], isDark: false },
  { value: "pastel-orange", label: "Pastel Orange", icon: FaPaintbrush, iconClass: "text-orange-300", swatch: ["oklch(0.940 0.040 65)", "oklch(0.520 0.085 48)", "oklch(0.310 0.032 45)"], isDark: false },
  { value: "pastel-purple", label: "Pastel Purple", icon: FaPaintbrush, iconClass: "text-purple-300", swatch: ["oklch(0.930 0.032 300)", "oklch(0.520 0.075 295)", "oklch(0.300 0.030 290)"], isDark: false },
  { value: "evergreen", label: "Evergreen", icon: FaLeaf, iconClass: "text-emerald-400", swatch: ["oklch(0.225 0.028 155)", "oklch(0.730 0.080 150)", "oklch(0.890 0.022 145)"], isDark: true },
  { value: "rose", label: "Rosé", icon: FaHeart, iconClass: "text-rose-400", swatch: ["oklch(0.940 0.035 20)", "oklch(0.510 0.080 15)", "oklch(0.310 0.032 15)"], isDark: false },
  { value: "parchment", label: "Parchment", icon: FaBook, iconClass: "text-amber-700", swatch: ["oklch(0.925 0.045 85)", "oklch(0.490 0.065 60)", "oklch(0.300 0.032 65)"], isDark: false },
  { value: "nord", label: "Nord", icon: FaSnowflake, iconClass: "text-sky-300", swatch: ["oklch(0.255 0.025 255)", "oklch(0.760 0.055 220)", "oklch(0.900 0.018 240)"], isDark: true },
  { value: "ember", label: "Ember", icon: FaFire, iconClass: "text-orange-500", swatch: ["oklch(0.225 0.025 45)", "oklch(0.740 0.085 65)", "oklch(0.900 0.022 70)"], isDark: true },
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
