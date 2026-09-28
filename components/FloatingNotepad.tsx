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
 * - Draggable notepad window on desktop, full-screen sheet on mobile
 * - Persistent text storage across browser sessions
 * - Real-time mathematical expression evaluation
 * - Automatic calculation results when "=" is typed (hardware or on-screen keyboard)
 * - Position persistence, kept inside the viewport
 * - Keyboard shortcuts for enhanced productivity
 *
 * Window Controls:
 * - Drag the window header to reposition (mouse, pen, or touch)
 * - Click button to toggle window visibility
 * - Escape closes the notepad
 * - Window position persists across sessions
 *
 * Rendering:
 * - The window is portalled to document.body. The Top Bar uses backdrop-filter,
 *   which turns it into the containing block for fixed descendants and applies
 *   its button styles to anything nested in it.
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
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { FaTrash, FaStickyNote, FaTimes, FaEquals } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { useNotepad } from "@/hooks/useNotepad";
import { KeyboardKey } from "./ui/keyboard-key";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Default window dimensions
 */
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 500;

/** Gap kept between the window and the viewport edge */
const EDGE_GAP = 8;

/** How long the clear button waits for a confirming second press */
const CLEAR_CONFIRM_MS = 3000;

const POSITION_KEY = "notepad-window-position";

/**
 * Position State Interface
 */
interface Position {
  x: number;
  y: number;
}

/**
 * Window size for the current viewport, never larger than the screen.
 */
function getWindowSize(): { width: number; height: number } {
  return {
    width: Math.min(DEFAULT_WIDTH, window.innerWidth - EDGE_GAP * 2),
    height: Math.min(DEFAULT_HEIGHT, window.innerHeight - EDGE_GAP * 2),
  };
}

/**
 * Keep the window fully on screen, e.g. after a saved position from a larger
 * display or a browser resize.
 */
function clampPosition(position: Position): Position {
  const { width, height } = getWindowSize();
  const maxX = Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - height - EDGE_GAP);
  return {
    x: Math.min(Math.max(position.x, EDGE_GAP), maxX),
    y: Math.min(Math.max(position.y, EDGE_GAP), maxY),
  };
}

/**
 * Run calculations over the text and work out where the caret belongs
 * afterwards. If the caret's line was solved, the caret moves to the end of
 * that line (after the result); otherwise it keeps its column.
 */
function calculateWithCaret(
  text: string,
  caret: number,
  processCalculation: (text: string) => string
): { value: string; caret: number } {
  const processed = processCalculation(text);
  if (processed === text) return { value: text, caret };

  const before = text.split("\n");
  const after = processed.split("\n");
  const caretLine = text.slice(0, caret).split("\n").length - 1;
  const column = caret - text.slice(0, caret).lastIndexOf("\n") - 1;

  let offset = 0;
  for (let i = 0; i < caretLine; i++) offset += after[i].length + 1;

  const lineChanged = before[caretLine] !== after[caretLine];
  return {
    value: processed,
    caret: offset + (lineChanged ? after[caretLine].length : column),
  };
}

/**
 * Tracks the visible viewport on mobile so the sheet shrinks above the
 * on-screen keyboard instead of being covered by it.
 */
function useVisualViewport(enabled: boolean) {
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(
    null
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!enabled || !vv) {
      setViewport(null);
      return;
    }
    const update = () => setViewport({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return viewport;
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
  const { content, setContent, clearContent, processCalculation, isOpen, setIsOpen } =
    useNotepad();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const isMobile = useIsMobile();
  const viewport = useVisualViewport(isOpen && isMobile);

  // Portal target is only available after hydration
  const [mounted, setMounted] = useState(false);

  // Window state
  const [windowPosition, setWindowPosition] = useState<Position>({
    x: 100,
    y: 100,
  });
  const [windowSize, setWindowSize] = useState({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });

  // Drag state
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });

  // Clear needs a second press so a stray tap cannot wipe the notes
  const [confirmClear, setConfirmClear] = useState(false);

  /**
   * Load saved position from localStorage on mount
   */
  useEffect(() => {
    setMounted(true);
    setWindowSize(getWindowSize());
    try {
      const savedWindowPos = localStorage.getItem(POSITION_KEY);
      if (savedWindowPos) {
        setWindowPosition(clampPosition(JSON.parse(savedWindowPos)));
      }
    } catch {
      // Unreadable or unavailable storage: keep the default position
    }
  }, []);

  /**
   * Save position to localStorage
   */
  useEffect(() => {
    if (!mounted || isDraggingWindow) return;
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(windowPosition));
    } catch {
      // Private mode can throw; position just won't persist
    }
  }, [windowPosition, isDraggingWindow, mounted]);

  /**
   * Keep the window on screen when the browser is resized
   */
  useEffect(() => {
    const onResize = () => {
      setWindowSize(getWindowSize());
      setWindowPosition((pos) => clampPosition(pos));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /**
   * Focus the textarea and place cursor at the end when the notepad is opened.
   * On mobile this is skipped so the keyboard does not cover the notes until
   * the user taps into them.
   */
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const length = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(length, length);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, isMobile]);

  /**
   * Stop the page behind the full-screen sheet from scrolling on mobile
   */
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen, isMobile]);

  /**
   * Restore the caret after a calculation rewrote the text
   */
  useEffect(() => {
    if (pendingCaret.current === null || !textareaRef.current) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    textareaRef.current.setSelectionRange(caret, caret);
  }, [content]);

  /**
   * Reset the clear confirmation after a short wait
   */
  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), CLEAR_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  /**
   * Close the notepad and hand focus back to the button that opened it
   */
  const closeNotepad = useCallback(() => {
    setIsOpen(false);
    setConfirmClear(false);
    triggerRef.current?.focus();
  }, [setIsOpen]);

  /**
   * Apply calculations to the given text, keeping the caret in place
   */
  const applyCalculation = useCallback(
    (text: string, caret: number) => {
      const result = calculateWithCaret(text, caret, processCalculation);
      if (result.value !== text) pendingCaret.current = result.caret;
      setContent(result.value);
    },
    [processCalculation, setContent]
  );

  /**
   * Handle Calculation Processing (Ctrl+Enter and the Calculate button)
   */
  const handleCalculation = useCallback(() => {
    const textarea = textareaRef.current;
    applyCalculation(content, textarea?.selectionStart ?? content.length);
    textarea?.focus();
  }, [applyCalculation, content]);

  /**
   * Handle Keyboard Events
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleCalculation();
      }
    },
    [handleCalculation]
  );

  /**
   * Handle Content Change
   *
   * The "=" trigger is detected here rather than on keydown: on-screen
   * keyboards on Android report keydown as "Unidentified", so a keydown check
   * never fires on phones.
   */
  const handleContentChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const { value, selectionStart } = event.target;
      const typedEquals =
        value.length > content.length && value[selectionStart - 1] === "=";

      if (typedEquals) {
        applyCalculation(value, selectionStart);
      } else {
        setContent(value);
      }
    },
    [applyCalculation, content.length, setContent]
  );

  /**
   * Handle Clear Content
   */
  const handleClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearContent();
    setConfirmClear(false);
    textareaRef.current?.focus();
  }, [clearContent, confirmClear]);

  /**
   * Close on Escape from anywhere inside the window
   */
  const handleWindowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeNotepad();
    }
  };

  /**
   * Start dragging the window (mouse, pen, or touch)
   */
  const handleHeaderPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDraggingWindow(true);
    dragOffset.current = {
      x: event.clientX - windowPosition.x,
      y: event.clientY - windowPosition.y,
    };
  };

  const handleHeaderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWindow) return;
    setWindowPosition(
      clampPosition({
        x: event.clientX - dragOffset.current.x,
        y: event.clientY - dragOffset.current.y,
      })
    );
  };

  const handleHeaderPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWindow) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDraggingWindow(false);
  };

  const lineCount = content ? content.split("\n").length : 0;

  const notepadWindow = (
    <div
      role="dialog"
      aria-label="Notepad"
      onKeyDown={handleWindowKeyDown}
      className={cn(
        "fixed flex flex-col overflow-hidden bg-popover text-popover-foreground",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
        // Mobile: full-screen sheet sized to the visible viewport
        isMobile &&
          "inset-x-0 top-0 z-50 h-[100dvh] motion-safe:slide-in-from-bottom-2",
        // Desktop: floating window
        !isMobile &&
          "z-40 rounded-2xl border border-border shadow-md motion-safe:slide-in-from-bottom-1",
        isDraggingWindow && "cursor-grabbing select-none"
      )}
      style={
        isMobile
          ? viewport
            ? { height: `${viewport.height}px`, top: `${viewport.top}px` }
            : undefined
          : {
              left: `${windowPosition.x}px`,
              top: `${windowPosition.y}px`,
              width: `${windowSize.width}px`,
              height: `${windowSize.height}px`,
            }
      }
    >
      {/* Window Header */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b border-border/60 select-none",
          isMobile
            ? "px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
            : "touch-none px-3 py-2",
          !isMobile && (isDraggingWindow ? "cursor-grabbing" : "cursor-grab")
        )}
        onPointerDown={isMobile ? undefined : handleHeaderPointerDown}
        onPointerMove={isMobile ? undefined : handleHeaderPointerMove}
        onPointerUp={isMobile ? undefined : handleHeaderPointerUp}
        onPointerCancel={isMobile ? undefined : handleHeaderPointerUp}
      >
        <div className="flex min-w-0 items-center gap-2 pl-1">
          <FaStickyNote className="size-3.5 shrink-0 text-primary" />
          <span className="text-sm font-semibold tracking-tight">Notepad</span>
          {!isMobile && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <KeyboardKey className="text-[10px]">Alt</KeyboardKey>
              <KeyboardKey className="text-[10px]">N</KeyboardKey>
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            isMobile ? "size-11" : "size-8"
          )}
          onClick={closeNotepad}
          aria-label="Close notepad"
          title="Close notepad"
        >
          <FaTimes className="size-3.5" />
        </Button>
      </div>

      {/* Window Content */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={"Notes and sums, one per line\n6*(4+27) ="}
          aria-label="Notepad text"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={cn(
            "min-h-0 w-full flex-1 resize-none rounded-xl bg-muted/50 px-3 py-2.5 font-notepad leading-relaxed text-foreground",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            // 16px on mobile stops iOS from zooming in on focus
            isMobile ? "text-base" : "text-sm"
          )}
        />

        {/* Help Text and Controls */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-2",
            isMobile && "pb-[env(safe-area-inset-bottom)]"
          )}
        >
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            {isMobile ? (
              <span className="truncate">
                End a line with = to solve it
              </span>
            ) : (
              <>
                <KeyboardKey className="text-[10px]">Ctrl</KeyboardKey>
                <span>+</span>
                <KeyboardKey className="text-[10px]">Enter</KeyboardKey>
                <span className="ml-0.5">solves every line ending in =</span>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {lineCount > 0 && !isMobile && (
              <span className="mr-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </span>
            )}
            {isMobile && (
              <Button
                variant="ghost"
                onClick={handleCalculation}
                className="h-11 gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Solve lines ending in ="
              >
                <FaEquals className="size-3" />
                Solve
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={!content && !confirmClear}
              className={cn(
                "gap-2 rounded-lg text-sm font-medium transition-colors duration-150",
                isMobile ? "h-11 px-3" : "h-8 px-2",
                confirmClear
                  ? "bg-destructive/12 text-destructive hover:bg-destructive/20 hover:text-destructive"
                  : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              )}
              aria-label={confirmClear ? "Confirm clear notepad" : "Clear notepad"}
              title={confirmClear ? "Press again to clear" : "Clear notepad"}
            >
              <FaTrash className="size-3" />
              {(confirmClear || isMobile) && (
                <span>{confirmClear ? "Clear all?" : "Clear"}</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Top Bar Button */}
      <Button
        ref={triggerRef}
        size="icon"
        variant="outline"
        onClick={() => (isOpen ? closeNotepad() : setIsOpen(true))}
        className={cn("rounded-lg", isOpen && "text-primary")}
        aria-label={isOpen ? "Close notepad" : "Open notepad"}
        aria-pressed={isOpen}
        title="Notepad"
      >
        <FaStickyNote />
      </Button>

      {/* Floating Window, rendered outside the Top Bar */}
      {mounted && isOpen && createPortal(notepadWindow, document.body)}
    </>
  );
}
