/**
 * Theme Provider Component - Application Theme Management System
 * 
 * This component serves as a wrapper around the next-themes ThemeProvider,
 * providing a clean interface for theme management throughout the BIT Focus
 * application. It enables seamless theme switching, system theme detection,
 * and consistent styling across all components.
 * 
 * Features:
 * - Multiple theme variants (light, dark, amethyst, bluenight, amoled)
 * - System theme detection and automatic switching
 * - Persistent theme preferences across sessions
 * - Hydration-safe theme application
 * - Custom theme attribute configuration
 * 
 * Theme Architecture:
 * - Uses CSS class-based theme switching
 * - Integrates with Tailwind CSS custom theme configurations
 * - Supports both light/dark modes and custom branded themes
 * - Maintains accessibility standards across all themes
 * 
 * Dependencies:
 * - next-themes for core theme functionality
 * - React for component architecture
 * 
 * @fileoverview Theme management system for consistent application styling
 * @author BIT Focus Development Team
 * @since v0.3.4-alpha
 */

"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Application Theme Provider Component
 * 
 * Wraps the application with theme management capabilities using next-themes.
 * This component provides theme switching functionality and maintains theme
 * state across the entire application. It supports multiple custom themes
 * in addition to standard light/dark modes.
 * 
 * The provider handles theme persistence, system preference detection, and
 * hydration safety to prevent theme flickering during initial load. All
 * theme-related functionality throughout the app depends on this provider
 * being present in the component tree.
 * 
 * @component
 * @param {React.ComponentProps<typeof NextThemesProvider>} props - Next themes provider props
 * @param {React.ReactNode} props.children - Child components to wrap with theme context
 * @returns {JSX.Element} Theme provider wrapper component
 * 
 * @example
 * ```tsx
 * // Used in root layout to provide theme context
 * <ThemeProvider
 *   attribute="class"
 *   value={{
 *     light: "light",
 *     dark: "dark",
 *     amethyst: "amethyst",
 *     bluenight: "bluenight",
 *     amoled: "amoled",
 *   }}
 *   defaultTheme="system"
 *   enableSystem={true}
 * >
 *   <App />
 * </ThemeProvider>
 * 
 * // Using theme in components
 * const { theme, setTheme } = useTheme();
 * setTheme('amethyst');
 * ```
 * 
 * @see {@link https://github.com/pacocoursey/next-themes} for next-themes documentation
 * @see {@link useTheme} hook for accessing theme state in components
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>): React.JSX.Element {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}