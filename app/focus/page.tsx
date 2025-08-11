/**
 * Focus Page Component - Main Timer Interface and Session Management
 * 
 * This is the primary focus tracking page that provides a comprehensive interface
 * for managing focus sessions. It includes a prominent timer display, tag selection,
 * session history, and data management capabilities. The component integrates with
 * Picture-in-Picture mode for distraction-free timing and provides import/export
 * functionality for data portability.
 * 
 * Features:
 * - Large, prominent timer display with start/pause/reset controls
 * - Tag selection and management for categorizing focus sessions
 * - Real-time session list with edit and delete capabilities
 * - Picture-in-Picture mode for minimized timer view
 * - Data import/export functionality with .bitf.json format
 * - Keyboard shortcuts for quick actions
 * - Toast notifications for user feedback
 * - Theme-aware UI components
 * 
 * Dependencies:
 * - Pomodoro timer context for timer state management
 * - Focus sessions database integration
 * - Tag management system
 * - Picture-in-Picture API integration
 * - File system operations for data management
 * 
 * @fileoverview Main focus tracking page with timer and session management
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 */

"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { usePomo } from "@/hooks/PomoContext";
import { FocusSession, useFocus } from "@/hooks/useFocus";
import { calculateTime, cn, formatTime, formatTimeNew } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  FaCalendar,
  FaExternalLinkAlt,
  FaPause,
  FaPlay,
  FaTrash,
} from "react-icons/fa";
import {
  FaForwardFast,
  FaRegClock,
  FaTableList,
} from "react-icons/fa6";
import { RiExpandUpDownLine, RiFocus2Line } from "react-icons/ri";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import TagBadge from "@/components/TagBadge";
import { type JSX, useEffect, useState } from "react";
import { EditFocusSession } from "./EditFocusSection";
import TagSelector from "@/components/TagSelector";
import GraphDialog from "./Graph";
import { usePip, usePipSpace } from "@/hooks/usePip";
import PipTimer from "@/components/PipTimer";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Main Focus Page Component
 * 
 * Renders the complete focus tracking interface including timer controls,
 * tag selection, session management, and data operations. The component
 * manages the integration between various focus-related features and
 * provides a cohesive user experience for productivity tracking.
 * 
 * The component uses multiple hooks for state management:
 * - usePomo for timer functionality
 * - useFocus for session data management
 * - usePip for Picture-in-Picture integration
 * - useTheme for theme-aware notifications
 * 
 * @component
 * @returns {JSX.Element} The complete focus page interface
 * 
 * @example
 * ```tsx
 * // Automatically rendered when navigating to /focus
 * <Focus />
 * ```
 * 
 * @see {@link usePomo} for timer state management
 * @see {@link useFocus} for session database operations
 * @see {@link usePip} for Picture-in-Picture functionality
 */
export default function Focus(): JSX.Element {
  const { theme } = useTheme();
  const { state, start, pause, reset } = usePomo();
  const isMobile = useIsMobile();

  // Calculate current timer display values
  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;
  const { focusSessions } = useFocus();

  // Picture-in-Picture integration with custom styling
  const { show } = usePip(PipTimer, {
    injectStyles: `
    * {
      padding: 0;
      margin: 0;
      box-sizing: border-box;
      font-family: JetBrains Mono, monospace;
    }
    div {
      width: 100vw;
      height: 100vh;
      background-color: black;
      color: oklch(87% 0 0);

      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 0.5rem;
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 800;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }
    `,
  });

  // Shared state management for PiP communication
  const { data, update } = usePipSpace("piptimer", {
    time: state.elapsedSeconds,
    running: state.isRunning,
    inc: {
      pause: 0,
      resume: 0,
    },
  });

  /**
   * Synchronize main timer state with Picture-in-Picture window
   * Updates the shared state whenever the main timer changes
   */
  useEffect(() => {
    if (state.isRunning) {
      update({ time: state.elapsedSeconds, running: true });
    } else {
      update({ time: state.elapsedSeconds, running: false });
    }
  }, [state, update]);

  /**
   * Handle Picture-in-Picture control commands
   * Responds to pause/resume commands from the PiP window
   */
  useEffect(() => {
    if (data.inc.pause === 1) {
      pause();
      update({ running: false, inc: { pause: 0, resume: 0 } });
    }
    if (data.inc.resume === 1) {
      start();
      update({ running: true, inc: { pause: 0, resume: 0 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, update]);

  return (
    <div className={cn("flex-1 p-8 gap-8 flex flex-col items-center justify-center")}>
      {/* Main Timer Card */}
        <Card className={cn(isMobile ? "w-full max-w-96" : "min-w-96")}>
          <CardTitle className="text-md flex items-center justify-center gap-2 opacity-60">
            <RiFocus2Line />
            <span>Focus Session</span>
          </CardTitle>
          <CardDescription className="text-center flex flex-col gap-6">
            <span className={cn(isMobile ? "text-6xl font-black" : "text-8xl font-semibold")}>
              {formatTime(minutes, seconds)}
            </span>
            <TagSelector />
          </CardDescription>

          <CardFooter className="flex items-center justify-center gap-2">
            {/* Primary Play/Pause Button */}
            <Button
              size={"lg"}
              className="w-2/3 py-6"
              variant={"default"}
              onClick={state.isRunning ? pause : start}
            >
              {state.isRunning ? <FaPause /> : <FaPlay />}
              {state.isRunning ? <span>Pause</span> : <span>Start</span>}
            </Button>
            
            {/* Reset Button - Only shown when timer has elapsed time */}
            {state.elapsedSeconds > 0 && (
              <Button
                size={"icon"}
                className="py-6 w-1/6"
                variant={"destructive"}
                onClick={reset}
              >
                <FaForwardFast />
              </Button>
            )}
            
            {/* Picture-in-Picture Button */}
            {!isMobile && 
              <Button
                onClick={show}
                size={"icon"}
                className="py-6 w-1/6"
                variant={"secondary"}
              >
                <FaExternalLinkAlt />
              </Button>
            }
          </CardFooter>
        </Card>

      {/* Focus Sessions List Card */}
      {/* <div className=""> */}
        <Card className={cn(isMobile ? "w-full max-w-96" : "min-w-96")}>
          <CardTitle className="px-6 flex items-center justify-between">
            <div className="flex gap-1 text-sm items-center opacity-70">
              <FaTableList />
              {!isMobile && <span>Focus Report</span>}
            </div>
            <div className="flex gap-1">
              <GraphDialog />
            </div>
          </CardTitle>
          <CardDescription className="max-h-64 overflow-y-auto flex flex-col gap-2 py-2 px-12">
            {focusSessions.map((session) => (
              <FocusOption key={session.id} item={session} />
            ))}
          </CardDescription>
        </Card>
      {/* </div> */}

      {/* Theme-aware Toast Notifications */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

/**
 * Props interface for the FocusOption component
 */
interface FocusOptionProps {
  /** The focus session item to display and manage */
  item: FocusSession;
}

/**
 * Individual Focus Session Display Component
 * 
 * Renders a single focus session as an interactive card with session details,
 * tag display, and action menu. Provides options to edit or delete the session
 * through a dropdown menu interface.
 * 
 * Features:
 * - Session duration display with formatted time
 * - Tag badge with color coding
 * - Context menu with edit and delete options
 * - Date information in tooltip/menu
 * - Responsive button layout
 * 
 * @component
 * @param {FocusOptionProps} props - Component props
 * @param {FocusSession} props.item - The focus session to display
 * @returns {JSX.Element} Interactive session card with action menu
 * 
 * @example
 * ```tsx
 * {focusSessions.map((session) => (
 *   <FocusOption key={session.id} item={session} />
 * ))}
 * ```
 * 
 * @see {@link FocusSession} for session data structure
 * @see {@link EditFocusSession} for edit functionality
 */
function FocusOption({ item }: FocusOptionProps): JSX.Element {
  const { removeFocusSession } = useFocus();
  const isMobile = useIsMobile();

  // Calculate session duration and format date
  const time = calculateTime(item.startTime, item.endTime);
  const onDate = item.startTime.toLocaleDateString("en-GB");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  /**
   * Handles dropdown open/close state changes
   * 
   * @param {boolean} open - New dropdown state
   * @returns {void}
   */
  const handleOpenChange = (open: boolean): void => {
    setIsDropdownOpen(open);
  };

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className={cn("w-full flex justify-between items-center", isMobile ? "flex-col items-center justify-center h-18" : "h-12")}
        >
          {/* Session Duration Display */}
          <div className={cn("flex gap-2 items-center")}>
            <FaRegClock />
            <span className="font-semibold">
              {formatTimeNew(time, "H:M:S", "text")}
            </span>
          </div>
          
          {/* Tag and Expand Icon */}
          <div className={cn("flex gap-4 items-center")}>
            <TagBadge tag={item.tag} />
            {!isMobile && <RiExpandUpDownLine />}
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      {/* Action Menu */}
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex items-center gap-2">
          <FaCalendar /> {onDate}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <EditFocusSession item={item} setIsDropdownOpen={setIsDropdownOpen} />
        <DropdownMenuItem onClick={() => removeFocusSession(item.id!)}>
          <FaTrash />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}