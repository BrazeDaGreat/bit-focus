/**
 * Root Layout Component - Application Shell and Provider Configuration
 * 
 * This is the root layout component for the BIT Focus application that establishes
 * the fundamental HTML structure, metadata, styling, and provider hierarchy for
 * the entire application. It serves as the foundational wrapper that all pages
 * inherit from, providing consistent theming, sidebar navigation, and global state
 * management across the application.
 * 
 * Architecture:
 * - HTML document structure with proper meta tags and fonts
 * - Multi-level provider hierarchy for state and UI management
 * - Sidebar-based navigation layout with collapsible functionality
 * - Theme system integration with multiple theme variants
 * - Analytics integration for user behavior tracking
 * - Responsive design foundation with mobile support
 * 
 * Provider Hierarchy (outer to inner):
 * 1. PomoProvider - Pomodoro timer state management
 * 2. SidebarProvider - Sidebar UI state and responsive behavior
 * 3. ThemeProvider - Theme switching and dark/light mode support
 * 
 * Features:
 * - Custom Google Fonts integration (Geist Sans & Geist Mono)
 * - SEO-optimized metadata and Open Graph tags
 * - Multi-theme support (light, dark, amethyst, bluenight, amoled)
 * - Responsive sidebar navigation with mobile adaptation
 * - Analytics tracking for performance monitoring
 * - Hydration suppression for theme consistency
 * 
 * Dependencies:
 * - Next.js App Router for layout system
 * - Google Fonts for typography
 * - Custom theme provider for styling
 * - Sidebar component system for navigation
 * - Pomodoro context for timer functionality
 * - Vercel Analytics for user tracking
 * 
 * @fileoverview Root layout establishing app structure and provider hierarchy
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 */

import type { Metadata } from "next";
import type { JSX } from "react";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PomoProvider } from "@/hooks/PomoContext";
import TopBar from "@/components/TopBar";

/**
 * Geist Sans Font Configuration
 * 
 * Configures the primary sans-serif font for the application using Google Fonts.
 * Geist Sans provides excellent readability and modern aesthetics for UI text,
 * headings, and general content throughout the application.
 * 
 * @constant
 * @type {NextFont}
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/**
 * Geist Mono Font Configuration
 * 
 * Configures the monospace font for code blocks, timer displays, and other
 * elements requiring fixed-width characters. Geist Mono ensures proper
 * alignment for numeric displays and code formatting.
 * 
 * @constant
 * @type {NextFont}
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Application Metadata Configuration
 * 
 * Defines comprehensive metadata for SEO optimization, social media sharing,
 * and browser behavior. Includes Open Graph tags for rich link previews
 * and proper application identification across platforms.
 * 
 * @constant
 * @type {Metadata}
 */
export const metadata: Metadata = {
  title: "BIT Focus",
  description: "Plz focus... for a bit. ha ha ha.",
  openGraph: {
    title: "BIT Focus",
    description: "Plz focus... for a bit. ha ha ha.",
    url: "https://bitfocus.vercel.app/",
    type: "website",
    images: [],
  },
};

/**
 * Root Layout Props Interface
 * 
 * Defines the expected props for the RootLayout component, following
 * Next.js App Router conventions for layout components.
 */
interface RootLayoutProps {
  /** Child components to be rendered within the layout */
  children: React.ReactNode;
}

/**
 * Root Layout Component
 * 
 * Establishes the foundational structure for the entire BIT Focus application.
 * This component creates the HTML document structure, configures global providers,
 * sets up the navigation system, and ensures consistent theming and state
 * management across all pages.
 * 
 * The layout implements a sophisticated provider hierarchy that manages different
 * aspects of the application state and UI behavior. Each provider wraps the
 * application layers below it, creating a cascading system of context and
 * functionality availability.
 * 
 * Layout Structure:
 * - HTML document with font variables and hydration suppression
 * - Provider hierarchy for state and UI management
 * - Sidebar navigation system with responsive behavior
 * - Main content area with top navigation bar
 * - Analytics integration for user behavior tracking
 * 
 * @component
 * @param {RootLayoutProps} props - Component props
 * @param {React.ReactNode} props.children - Page content to render within layout
 * @returns {JSX.Element} Complete HTML document with providers and navigation
 * 
 * @example
 * ```tsx
 * // Automatically used by Next.js App Router for all pages
 * export default function SomePage() {
 *   return <div>Page content appears within RootLayout</div>;
 * }
 * ```
 * 
 * @see {@link PomoProvider} for timer state management
 * @see {@link SidebarProvider} for navigation UI state
 * @see {@link ThemeProvider} for theme switching capabilities
 * @see {@link AppSidebar} for main navigation component
 * @see {@link TopBar} for secondary navigation and controls
 */
export default function RootLayout({
  children,
}: Readonly<RootLayoutProps>): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Timer State Management Provider */}
        <PomoProvider>
          {/* Sidebar UI State Provider */}
          <SidebarProvider>
            {/* Theme Management Provider */}
            <ThemeProvider
              attribute="class"
              value={{
                light: "light",
                dark: "dark",
                amethyst: "amethyst",
                amethystoverloaded: "amethystoverloaded",
                bluenight: "bluenight",
                amoled: "amoled",
                "pastel-blue": "pastel-blue",
                "pastel-orange": "pastel-orange",
                "pastel-purple": "pastel-purple",
              }}
              defaultTheme="system"
              enableSystem={true}
            >
              {/* Main Navigation Sidebar */}
              <AppSidebar />
              
              {/* Main Content Area */}
              <div className="flex-1 flex flex-col max-h-screen overflow-y-auto">
                {/* Secondary Navigation Bar */}
                <TopBar />
                
                {/* Page Content Injection Point */}
                {children}
              </div>
            </ThemeProvider>
          </SidebarProvider>
        </PomoProvider>
        
        {/* Analytics Tracking */}
        <Analytics />
      </body>
    </html>
  );
}