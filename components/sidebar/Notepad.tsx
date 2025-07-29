/**
 * Sidebar Notepad Component - Mathematical Calculator and Note-Taking Interface
 *
 * This component provides a persistent notepad interface within the application
 * sidebar, featuring automatic mathematical computation capabilities. Users can
 * take notes and perform calculations seamlessly by typing mathematical expressions
 * followed by "=" to trigger automatic result insertion.
 *
 * Features:
 * - Persistent text storage across browser sessions
 * - Real-time mathematical expression evaluation
 * - Automatic calculation results on "=" key press
 * - Responsive textarea with proper theming
 * - Clear functionality for quick content reset
 * - Error handling for invalid mathematical expressions
 * - Keyboard shortcuts for enhanced productivity
 *
 * Mathematical Operations:
 * - Basic arithmetic: addition (+), subtraction (-), multiplication (*), division (/)
 * - Advanced operations: modulo (%), exponentiation (^ or **)
 * - Parentheses for operation precedence grouping
 * - Decimal number support with precision handling
 * - Multi-line calculations with individual line processing
 *
 * User Interaction:
 * - Type mathematical expressions followed by "=" to calculate
 * - Use Ctrl/Cmd + Enter to trigger calculations manually
 * - Click Clear button to reset all content
 * - Standard text editing features (copy, paste, select)
 *
 * Keyboard Shortcuts:
 * - "=" key: Automatic calculation trigger
 * - Ctrl/Cmd + Enter: Manual calculation processing
 * - Standard text editing shortcuts supported
 *
 * Dependencies:
 * - Notepad state management hook for persistence
 * - UI components for consistent styling and theming
 * - React hooks for component lifecycle management
 * - TypeScript for type safety and developer experience
 *
 * @fileoverview Sidebar notepad with mathematical computation capabilities
 * @author BIT Focus Development Team
 * @since v0.10.1-alpha
 */

"use client";

import { useCallback, useRef, type JSX, type KeyboardEvent } from "react";
import { FaTrash } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNotepad } from "@/hooks/useNotepad";
import { KeyboardKey } from "../ui/keyboard-key";

/**
 * Notepad Component Props Interface
 */
interface NotepadProps {
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Sidebar Notepad Component
 *
 * Renders a complete notepad interface with mathematical computation
 * capabilities optimized for sidebar placement. The component handles
 * text input, calculation processing, and content persistence automatically.
 *
 * The notepad automatically processes mathematical expressions when the user
 * types "=" or uses keyboard shortcuts. Results are inserted inline,
 * maintaining the context of calculations within notes.
 *
 * @component
 * @param {NotepadProps} props - Component configuration options
 * @returns {JSX.Element} Complete notepad interface with calculation features
 *
 * @example
 * ```tsx
 * // Basic usage in sidebar
 * <Notepad />
 *
 * // With custom styling and placeholder
 * <Notepad
 *   className="custom-notepad"
 * />
 * ```
 */
export default function Notepad({
  className = "",
}: NotepadProps): JSX.Element {
  const { content, setContent, clearContent, processCalculation } =
    useNotepad();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Handle Calculation Processing
   *
   * Processes the current notepad content for mathematical expressions
   * and updates the content with calculated results. This function
   * maintains cursor position and provides smooth user experience.
   *
   * @callback
   */
  const handleCalculation = useCallback(() => {
    const processed = processCalculation(content);
    if (processed !== content) {
      setContent(processed);

      // Focus back to textarea after calculation
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [content, processCalculation, setContent]);

  /**
   * Handle Keyboard Events
   *
   * Processes keyboard input for calculation triggers and shortcuts.
   * Supports automatic calculation on "=" key and manual processing
   * with Ctrl/Cmd + Enter for enhanced productivity.
   *
   * @param {KeyboardEvent<HTMLTextAreaElement>} event - Keyboard event object
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Trigger calculation on "=" key
      if (event.key === "=") {
        // Add a small delay to let the "=" character be added first
        setTimeout(() => {
          handleCalculation();
        }, 10);
      }

      // Manual calculation with Ctrl/Cmd + Enter
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
   * Updates the notepad content when user types or modifies text.
   * Maintains real-time persistence and state synchronization.
   *
   * @param {React.ChangeEvent<HTMLTextAreaElement>} event - Change event object
   */
  const handleContentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(event.target.value);
    },
    [setContent]
  );

  /**
   * Handle Clear Content
   *
   * Clears all notepad content and focuses the textarea for immediate
   * new input. Provides smooth user experience for content reset.
   */
  const handleClear = useCallback(() => {
    clearContent();
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [clearContent]);

  return (
    <div className={`space-y-2 ${className}`}>

      {/* Main Textarea */}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        placeholder="6*(4+27) = "
        className={`resize-none text-xs leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0`}
        rows={8}
      />
      {/* Help Text */}
      <div className="text-xs opacity-50 flex items-center justify-between">
        <div className="flex items-center gap-0.25">
          <KeyboardKey className="text-[10px]">CTRL</KeyboardKey> +{" "}
          <KeyboardKey className="text-[10px]">Enter</KeyboardKey>
          <span>Calculate</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="p-0 hover:bg-destructive/10 hover:text-destructive"
        >
          <FaTrash className="size-2.75" />
        </Button>
      </div>
    </div>
  );
}
