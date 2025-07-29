/**
 * Changelog Page Component - Display Application Version History and Updates
 * 
 * This page component renders the complete changelog for the BIT Focus application.
 * It displays version history, feature additions, bug fixes, and other updates
 * in a formatted markdown layout. The component integrates with the application's
 * theming system and provides toast notifications support.
 * 
 * Features:
 * - Markdown rendering of changelog content
 * - Theme-aware toast notifications
 * - Responsive layout with proper spacing
 * - Integration with Next.js theming system
 * 
 * @fileoverview Changelog page for displaying application version history
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 */

"use client";

import { useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import Markdown from "react-markdown";
import CHANGELOG from "./CHANGELOG";
import type { JSX } from "react";

/**
 * Changelog Page Component
 * 
 * Renders the application's changelog in a markdown format with proper styling.
 * The component automatically adapts to the current theme and provides a clean,
 * readable interface for users to view version history and updates.
 * 
 * The changelog content is imported from a separate CHANGELOG file to maintain
 * separation of concerns and make it easier to update version information.
 * 
 * @component
 * @returns {JSX.Element} The rendered changelog page with markdown content
 * 
 * @see {@link CHANGELOG} for the actual changelog content
 * @see {@link https://github.com/remarkjs/react-markdown} for react-markdown documentation
 */
export default function Changelog(): JSX.Element {
  const { theme } = useTheme();

  return (
    <div className="p-2">
      {/* Page Header */}
      <h1 className="text-4xl font-bold mx-2">Changelog</h1>
      
      {/* Markdown Content Container */}
      <div className="md">
        <Markdown>{CHANGELOG}</Markdown>
      </div>
      
      {/* Theme-aware Toast Notifications */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}