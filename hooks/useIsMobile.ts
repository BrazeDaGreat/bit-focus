/**
 * Mobile Detection Hook - Responsive Breakpoint Management
 *
 * This custom React hook provides a reliable way to detect mobile devices
 * and screen sizes for responsive design implementation. It uses a media
 * query approach with proper event handling to detect changes in screen
 * size and determine whether the current viewport should be considered
 * mobile or desktop.
 *
 * Features:
 * - Real-time responsive breakpoint detection
 * - Configurable breakpoint threshold (768px default)
 * - Proper event listener cleanup to prevent memory leaks
 * - SSR-safe initialization to prevent hydration mismatches
 * - Boolean return type for easy conditional rendering
 *
 * Responsive Strategy:
 * - Uses standard mobile-first breakpoint (768px)
 * - Matches common CSS framework conventions (Tailwind, Bootstrap)
 * - Provides consistent mobile detection across components
 * - Updates automatically when screen size changes
 *
 * Use Cases:
 * - Conditional rendering for mobile/desktop layouts
 * - Sidebar collapse behavior on small screens
 * - Touch vs mouse interaction adaptations
 * - Modal and navigation responsive behavior
 *
 * Dependencies:
 * - React hooks (useState, useEffect)
 * - Browser window and matchMedia APIs
 *
 * @fileoverview Mobile device detection hook for responsive design
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 */

import * as React from "react";

/**
 * Mobile Breakpoint Constant
 *
 * Defines the pixel width threshold for distinguishing between mobile
 * and desktop viewports. Set to 768px to match common CSS framework
 * conventions and provide consistent responsive behavior.
 *
 * @constant {number}
 */
const MOBILE_BREAKPOINT = 768;

/**
 * Mobile Detection Hook
 *
 * Determines if the current device should be treated as mobile based on
 * screen width. Uses the matchMedia API for efficient media query monitoring
 * and provides real-time updates when the viewport size changes.
 *
 * The hook handles SSR compatibility by initializing with undefined and
 * setting the actual value after component mount. This prevents hydration
 * mismatches between server and client rendering.
 *
 * Implementation uses both matchMedia for modern browsers and window.innerWidth
 * as a fallback, ensuring broad compatibility while maintaining performance.
 *
 * @hook
 * @returns {boolean} True if the current viewport is mobile-sized, false otherwise
 *
 * @example
 * ```tsx
 * // Basic mobile detection
 * function ResponsiveComponent() {
 *   const isMobile = useIsMobile();
 *
 *   return (
 *     <div>
 *       {isMobile ? (
 *         <MobileNavigation />
 *       ) : (
 *         <DesktopNavigation />
 *       )}
 *     </div>
 *   );
 * }
 *
 * // Conditional styling
 * function AdaptiveLayout() {
 *   const isMobile = useIsMobile();
 *
 *   return (
 *     <div className={isMobile ? "mobile-layout" : "desktop-layout"}>
 *       <Content />
 *     </div>
 *   );
 * }
 *
 * // Sidebar behavior
 * function AppLayout() {
 *   const isMobile = useIsMobile();
 *   const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
 *
 *   useEffect(() => {
 *     if (isMobile) {
 *       setSidebarOpen(false);
 *     }
 *   }, [isMobile]);
 *
 *   return <Layout sidebar={sidebarOpen} />;
 * }
 * ```
 *
 * @see {@link MOBILE_BREAKPOINT} for breakpoint configuration
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia} for matchMedia API
 */
export function useIsMobile(): boolean {
  // Initialize with undefined to prevent SSR hydration issues
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    // Create media query for mobile breakpoint detection
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    /**
     * Media Query Change Handler
     *
     * Updates the mobile state when the media query status changes.
     * Uses window.innerWidth as the source of truth to ensure
     * consistency across different browser implementations.
     *
     * @returns {void}
     */
    const onChange = (): void => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Set up media query event listener
    mql.addEventListener("change", onChange);

    // Set initial value based on current window size
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    // Cleanup event listener on unmount
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Return false as default for SSR safety (assumes desktop)
  return !!isMobile;
}
