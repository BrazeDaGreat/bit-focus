/**
 * Floating Notepad Component - Draggable Mathematical Calculator and Note-Taking Interface
 *
 * This component provides a floating, draggable notepad interface
 * that can be positioned anywhere on the screen. It features automatic mathematical
 * computation capabilities and maintains all functionality from the sidebar notepad
 * while offering enhanced flexibility through a floating window.
 *
 * Features:
 * - Floating button for notepad access
 * - Draggable notepad window
 * - Persistent text storage across browser sessions
 * - Real-time mathematical expression evaluation
 * - Automatic calculation results on "=" key press
 * - Minimizable window with smooth transitions
 * - Position persistence
 * - Keyboard shortcuts for enhanced productivity
 *
 * Window Controls:
 * - Drag the window header to reposition
 * - Click button to toggle window visibility
 * - Window position persists across sessions
 *
 * Mathematical Operations:
 * - Basic arithmetic: addition (+), subtraction (-), multiplication (*), division (/)
 * - Advanced operations: modulo (%), exponentiation (^ or **)
 * - Parentheses for operation precedence grouping
 * - Decimal number support with precision handling
 *
 * @fileoverview Floating notepad with drag and mathematical computation
 * @author BIT Focus Development Team
 */

"use client";

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { FaTrash, FaStickyNote, FaTimes } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNotepad } from "@/hooks/useNotepad";
import { KeyboardKey } from "./ui/keyboard-key";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Default window dimensions
 */
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 500;

/**
 * Position State Interface
 */
interface Position {
  x: number;
  y: number;
}

/**
 * Floating Notepad Component
 *
 * Renders a floating notepad with a draggable window.
 * Maintains all mathematical computation features while providing flexible positioning.
 *
 * @component
 * @returns {JSX.Element} Complete floating notepad interface
 */
export default function FloatingNotepad(): JSX.Element {
  const { content, setContent, clearContent, processCalculation } =
    useNotepad();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  // Window state
  const [isOpen, setIsOpen] = useState(false);
  const [windowPosition, setWindowPosition] = useState<Position>({
    x: 100,
    y: 100,
  });

  // Drag state
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });

  /**
   * Load saved position and open state from localStorage on mount
   */
  useEffect(() => {
    const savedWindowPos = localStorage.getItem("notepad-window-position");
    const savedIsOpen = localStorage.getItem("notepad-is-open");

    if (savedWindowPos) {
      setWindowPosition(JSON.parse(savedWindowPos));
    }
    if (savedIsOpen) {
      setIsOpen(JSON.parse(savedIsOpen));
    }
  }, []);

  /**
   * Save position and open state to localStorage
   */
  useEffect(() => {
    localStorage.setItem(
      "notepad-window-position",
      JSON.stringify(windowPosition)
    );
    localStorage.setItem("notepad-is-open", JSON.stringify(isOpen));
  }, [windowPosition, isOpen]);

  /**
   * Handle Calculation Processing
   */
  const handleCalculation = useCallback(() => {
    const processed = processCalculation(content);
    if (processed !== content) {
      setContent(processed);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [content, processCalculation, setContent]);

  /**
   * Handle Keyboard Events
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "=") {
        setTimeout(() => {
          handleCalculation();
        }, 10);
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleCalculation();
      }
    },
    [handleCalculation]
  );

  /**
   * Handle Content Change
   */
  const handleContentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(event.target.value);
    },
    [setContent]
  );

  /**
   * Handle Clear Content
   */
  const handleClear = useCallback(() => {
    clearContent();
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [clearContent]);

  /**
   * Start dragging the window
   */
  const handleWindowMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("textarea, button")) {
      return;
    }
    event.preventDefault();
    setIsDraggingWindow(true);
    dragOffset.current = {
      x: event.clientX - windowPosition.x,
      y: event.clientY - windowPosition.y,
    };
  };

  /**
   * Handle mouse move for dragging
   */
  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (isDraggingWindow) {
        setWindowPosition({
          x: event.clientX - dragOffset.current.x,
          y: event.clientY - dragOffset.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingWindow(false);
    };

    if (isDraggingWindow) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDraggingWindow, windowPosition]);

  return (
    <>
      {/* Floating Button */}
      <Button size="sm" variant="outline" onClick={() => setIsOpen(!isOpen)}>
        <FaStickyNote className="mr-2" />
        {!isMobile && "Notepad"}
      </Button>

      {/* Floating Window */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-40 flex flex-col shadow-2xl",
            "backdrop-blur-md border border-border",
            "overflow-hidden",
            // Mobile: full-screen, no rounded corners
            isMobile && "inset-0 rounded-none",
            // Desktop: floating window with rounded corners
            !isMobile && "rounded-lg",
            isDraggingWindow && "cursor-grabbing"
          )}
          style={
            isMobile
              ? undefined // Mobile uses CSS classes for full-screen
              : {
                  left: `${windowPosition.x}px`,
                  top: `${windowPosition.y}px`,
                  width: `${DEFAULT_WIDTH}px`,
                  height: `${DEFAULT_HEIGHT}px`,
                }
          }
        >
          {/* Window Header */}
          <div
            className={cn(
              "flex items-center justify-between p-3 border-b border-border bg-secondary/20 backdrop-blur-md select-none",
              !isMobile && "cursor-move"
            )}
            onMouseDown={isMobile ? undefined : handleWindowMouseDown}
          >
            <div className="flex items-center gap-2">
              <FaStickyNote className="w-4 h-4" />
              <span className="font-semibold text-sm">Notepad</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <FaTimes className="w-3 h-3" />
            </Button>
          </div>

          {/* Window Content */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col gap-2">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder="6*(4+27) = "
              className="flex-1 resize-none text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 bg-white/10"
            />

            {/* Help Text and Controls */}
            <div className="text-xs opacity-50 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <KeyboardKey className="text-[10px]">CTRL</KeyboardKey>
                <span>+</span>
                <KeyboardKey className="text-[10px]">Enter</KeyboardKey>
                <span>Calculate</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
              >
                <FaTrash className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
