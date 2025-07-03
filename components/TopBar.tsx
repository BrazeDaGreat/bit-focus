/**
 * Top Navigation Bar Component - Enhanced with Quick Task Creation
 * 
 * This component provides the secondary navigation bar that appears at the top
 * of the application interface. It has been updated to replace the comprehensive
 * TaskView popover with a streamlined QuickTaskAdd component for minimal friction
 * task creation workflows.
 * 
 * Features:
 * - Sidebar toggle for responsive navigation
 * - Quick access to external resources (Discord, GitHub)
 * - Streamlined quick task creation interface
 * - Responsive button layout and sizing
 * - Consistent styling with application theme
 * 
 * Layout Structure:
 * - Left side: Sidebar trigger and external links
 * - Right side: Quick task creation button
 * - Responsive design for mobile and desktop
 * 
 * Dependencies:
 * - QuickTaskAdd component for task creation
 * - UI components for consistent styling
 * - React Icons for visual elements
 * 
 * @fileoverview Top navigation bar with enhanced task creation capabilities
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 * @updated v0.7.1-alpha - Replaced TaskView with QuickTaskAdd
 */

"use client";

import { FaDiscord, FaGithub } from "react-icons/fa6";
import { Button } from "./ui/button";
import { SidebarTrigger } from "./ui/sidebar";
import QuickTaskAdd from "./QuickTaskAdd";
import type { JSX } from "react";

/**
 * TopBar Button Props Interface
 * 
 * Defines the properties for individual action buttons in the top bar
 * including click handlers and icon display.
 */
interface TopBarButtonProps {
  /** Click event handler for the button */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Icon element to display in the button */
  icon?: React.ReactNode;
}

/**
 * TopBar Button Component
 * 
 * Renders individual action buttons with consistent styling and behavior.
 * Handles click events with proper propagation control for overlay scenarios.
 * 
 * @component
 * @param {TopBarButtonProps} props - Button configuration
 * @returns {JSX.Element} Styled action button
 */
function TopBarButton(props: TopBarButtonProps): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (props.onClick) {
          props.onClick(event);
        }
      }}
    >
      {props.icon}
    </Button>
  );
}

/**
 * Main TopBar Component
 * 
 * Renders the complete top navigation bar with sidebar controls, external
 * links, and the enhanced quick task creation interface. The component
 * provides a clean, minimal interface that prioritizes quick access to
 * essential functions.
 * 
 * The layout uses flexbox for responsive positioning with left-aligned
 * navigation controls and right-aligned task creation. Button sizes and
 * spacing are optimized for both desktop and mobile interactions.
 * 
 * @component
 * @returns {JSX.Element} Complete top navigation bar
 * 
 * @example
 * ```tsx
 * // Used in root layout for consistent navigation
 * <TopBar />
 * ```
 */
export default function TopBar(): JSX.Element {
  return (
    <div className="px-2 py-2.5 border-b border-secondary flex items-center justify-between gap-2">
      {/* Left Side: Navigation and External Links */}
      <div className="flex items-center justify-start gap-2">
        {/* Sidebar Toggle */}
        <SidebarTrigger />
        
        {/* Discord Link */}
        <TopBarButton
          icon={<FaDiscord />}
          onClick={() => {
            window.open("https://discord.gg/XXkSFkdx8H", "_blank");
          }}
        />
        
        {/* GitHub Repository Link */}
        <TopBarButton
          icon={<FaGithub />}
          onClick={() =>
            window.open("https://github.com/BrazeDaGreat/bit-focus", "_blank")
          }
        />
      </div>
      
      {/* Right Side: Quick Task Creation */}
      <div className="flex items-center gap-2">
        <QuickTaskAdd />
      </div>
    </div>
  );
}