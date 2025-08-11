/**
 * AppSidebar.tsx - Main Application Sidebar Component with Enhanced Navigation
 * 
 * This component renders the main navigation sidebar for the BIT Focus application.
 * Updated to include the new dedicated Todo page in the navigation menu, replacing
 * the previous popover-based task management with a full-featured page experience.
 * 
 * Features:
 * - Enhanced navigation items including dedicated Todo page
 * - User configuration and timer display
 * - Theme selector with multiple options
 * - Timer state management during navigation
 * - Responsive sidebar behavior
 * - Version information display
 * 
 * Navigation Items:
 * - Home: Dashboard and analytics overview
 * - Focus: Timer interface and session management
 * - Changelog: Version history and updates
 * 
 * Dependencies:
 * - Enhanced navigation structure
 * - Timer state management for smooth navigation
 * - Theme system integration
 * - User configuration management
 * 
 * @fileoverview Main application sidebar with enhanced navigation including Todo page
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 * @updated v0.8.2-alpha
 */

"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IoColorPalette } from "react-icons/io5";
import { FaChevronUp, FaHome, FaMoon, FaProjectDiagram, FaSun, FaCoffee } from "react-icons/fa";
import { IoIosTimer } from "react-icons/io";
import { FaGear, FaGem, FaPaintbrush, FaReadme, FaWater } from "react-icons/fa6";
import { useTheme } from "next-themes";
import EditConfig, { EditConfigSkeleton } from "./sidebar/EditConfig";
import { usePathname, useRouter } from "next/navigation";
import { useConfig } from "@/hooks/useConfig";
import { useEffect, useRef, useCallback, type JSX, useState } from "react";
import PomoFooterTimer from "./sidebar/PomoFooterTimer";
import { Skeleton } from "./ui/skeleton";
import { VERSION } from "@/app/changelog/CHANGELOG";
import { usePomo } from "@/hooks/PomoContext";
import { useProjects } from "@/hooks/useProjects";
import Notepad from "./sidebar/Notepad";
import { cn } from "@/lib/utils";

/**
 * Enhanced Navigation Items Configuration
 * 
 * Updated navigation structure including the new dedicated Todo page
 * for comprehensive task management capabilities.
 */
const items = [
  { title: "Home", url: "/", icon: <FaHome /> },
  { title: "Focus", url: "/focus", icon: <IoIosTimer /> },
  { title: "Projects", url: "/projects", icon: <FaProjectDiagram /> },
  { title: "Rewards", url: "/rewards", icon: <FaCoffee /> },
  { title: "Changelog", url: "/changelog", icon: <FaReadme /> },
];

/**
 * Main Application Sidebar Component
 * 
 * Renders the complete sidebar interface with enhanced navigation including
 * the new Todo page. Maintains all existing functionality while providing
 * access to the comprehensive task management interface.
 * 
 * The component handles timer state during navigation to prevent blocking
 * issues and provides a smooth user experience across all pages including
 * the new task management interface.
 * 
 * @component
 * @returns {JSX.Element} Complete sidebar interface with enhanced navigation
 * 
 * @example
 * ```tsx
 * // Used in root layout for consistent navigation
 * <AppSidebar />
 * ```
 */
export function AppSidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { pause, state, start } = usePomo();
  const { loadConfig, loadingConfig } = useConfig();
  const { loadProjects } = useProjects()
  const [ showNotepad, setShowNotepad ] = useState(true);
  
  
  // Track navigation state to prevent duplicate operations
  const isNavigatingRef = useRef(false);
  const wasRunningRef = useRef(false);

  /**
   * Load user configuration on component mount
   */
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /**
   * Load Projects
   */
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  /**
   * Optimized function to temporarily pause timer if it's running.
   * Stores the running state to restore later.
   */
  const pauseForNavigation = useCallback(() => {
    if (state.isRunning && state.elapsedSeconds > 0 && !isNavigatingRef.current) {
      wasRunningRef.current = true;
      pause();
    }
  }, [state.isRunning, state.elapsedSeconds, pause]);

  /**
   * Optimized function to resume timer if it was running before navigation.
   * Only resumes if the timer was actually running before pause.
   */
  const resumeAfterNavigation = useCallback(() => {
    if (wasRunningRef.current && !state.isRunning && state.elapsedSeconds > 0) {
      // Use a minimal delay to ensure navigation is complete
      const timeoutId = setTimeout(() => {
        start();
        wasRunningRef.current = false;
        isNavigatingRef.current = false;
      }, 10); // Minimal delay for navigation completion
      
      return () => clearTimeout(timeoutId);
    } else {
      isNavigatingRef.current = false;
    }
  }, [state.isRunning, state.elapsedSeconds, start]);

  /**
   * Resume timer after navigation completes (pathname change)
   */
  useEffect(() => {
    const cleanup = resumeAfterNavigation();
    return cleanup;
  }, [pathname, resumeAfterNavigation]);

  /**
   * Enhanced navigation handler that manages timer state for smooth navigation.
   * 
   * @param {string} url - The destination URL to navigate to
   * @param {React.MouseEvent} event - The click event from the navigation link
   */
  const handleNavigation = useCallback((url: string, event: React.MouseEvent) => {
    event.preventDefault();
    
    // Prevent duplicate navigation attempts
    if (isNavigatingRef.current) {
      return;
    }
    
    // Skip if already on the target page
    if (pathname === url) {
      return;
    }
    
    isNavigatingRef.current = true;
    
    // Pause timer immediately for smooth navigation
    pauseForNavigation();
    
    // Navigate with minimal delay to ensure pause takes effect
    setTimeout(() => {
      router.push(url);
    }, 5);
  }, [pathname, router, pauseForNavigation]);

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          {loadingConfig ? <EditConfigSkeleton /> : <EditConfig />}
        </SidebarHeader>
        
        <SidebarContent>
          {/* Main Menu with Enhanced Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel>BIT Focus</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      className="gap-2"
                      style={{ padding: "1.5rem 0.5rem" }}
                      isActive={pathname === item.url}
                      onClick={(event) => handleNavigation(item.url, event)}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between hover:bg-primary/20 my-0.5 select-none cursor-pointer" onClick={() => setShowNotepad(!showNotepad)}>
              <span>Notepad</span>
              <FaChevronUp className={cn("!w-2 !h-2", !showNotepad && "rotate-180", "transition-transform duration-200 ease-in-out")} />
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <Notepad className={cn(showNotepad ? "h-[232px]" : "h-0", "overflow-hidden transition-all duration-300 ease-in-out")} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <span className="text-center text-xs opacity-40 select-none">
            {VERSION}
          </span>
          <PomoFooterTimer />
          {loadingConfig ? <ThemeSelectorSkeleton /> : <ThemeSelector />}
        </SidebarFooter>
      </Sidebar>
    </>
  );
}

/**
 * Skeleton component for theme selector loading state
 * 
 * @returns {JSX.Element} Skeleton styling placeholder
 */
const ThemeSelectorSkeleton = (): JSX.Element => <Skeleton className="h-9" />;

/**
 * Theme Selector Component with Pastel Theme Support
 * 
 * Provides comprehensive theme switching capabilities with multiple theme options
 * including standard themes, branded themes, and new pastel themes designed
 * for comfortable extended use. The pastel themes feature soft, muted colors
 * that are easy on the eyes during long productivity sessions.
 * 
 * Theme Categories:
 * - Standard: Light, Dark, System
 * - Branded: Amethyst, Blue Night, AMOLED
 * - Pastel: Pastel Blue, Pastel Orange, Pastel Purple
 * 
 * @component
 * @returns {JSX.Element} Theme selection dropdown interface with pastel options
 * 
 * @example
 * ```tsx
 * // Used within the sidebar footer
 * <ThemeSelector />
 * ```
 */
const ThemeSelector = (): JSX.Element => {
  const { setTheme, theme } = useTheme();
  
  return (
    <Select
      onValueChange={(value) => setTheme(value)}
      defaultValue={theme ?? "system"}
    >
      <SelectTrigger className="w-full">
        <SelectValue
          placeholder={
            <span className="flex gap-2 items-center">
              <IoColorPalette /> Theme
            </span>
          }
        />
      </SelectTrigger>
      <SelectContent>
        {/* Standard Themes */}
        <SelectItem value="light">
          <FaSun /> Light
        </SelectItem>
        <SelectItem value="dark">
          <FaMoon /> Dark
        </SelectItem>
        <SelectItem value="system">
          <FaGear /> System
        </SelectItem>
        
        {/* Branded Themes */}
        <SelectItem value="amethyst">
          <FaGem className="text-purple-400" /> Amethyst
        </SelectItem>
        <SelectItem value="bluenight">
          <FaWater className="text-cyan-400" /> Blue Night
        </SelectItem>
        <SelectItem value="amoled">
          <IoColorPalette className="text-neutral-500" /> AMOLED v2
        </SelectItem>
        
        {/* New Pastel Themes */}
        <SelectItem value="pastel-blue">
          <FaPaintbrush className="text-blue-300" /> Pastel Blue
        </SelectItem>
        <SelectItem value="pastel-orange">
          <FaPaintbrush className="text-orange-300" /> Pastel Orange
        </SelectItem>
        <SelectItem value="pastel-purple">
          <FaPaintbrush className="text-purple-300" /> Pastel Purple
        </SelectItem>
      </SelectContent>
    </Select>
  );
};