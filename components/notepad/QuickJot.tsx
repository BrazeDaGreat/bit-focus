/**
 * QuickJot Component - Distraction Jot ("Parking Lot") Capture
 *
 * Lightweight, instant quick-capture HUD invoked via global hotkey (J).
 * Allows the user to capture stray thoughts mid-focus in one keystroke
 * without pausing the timer or leaving their flow.
 *
 * Appends formatted timestamped bullets directly to the Notepad:
 *   `- 3:42 PM  call the bank`
 *   `- 3:42 PM #uni  call the bank` (when focus session with tag is running)
 *
 * @fileoverview Quick capture overlay for distraction jots
 * @author BIT Focus Development Team
 */

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { FaStickyNote } from "react-icons/fa";
import { CornerDownLeft, X } from "lucide-react";
import { toast } from "sonner";
import { useNotepad } from "@/hooks/useNotepad";
import { usePomo } from "@/hooks/PomoContext";
import { useTag } from "@/hooks/useTag";
import { KeyboardKey } from "@/components/ui/keyboard-key";
import { formatJotLine } from "./jot-utils";
import { cn } from "@/lib/utils";

export function QuickJot(): JSX.Element | null {
  const { isJotOpen, setIsJotOpen, appendJot } = useNotepad();
  const { state: pomoState } = usePomo();
  const { tag } = useTag();

  const [text, setText] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine if a focus session is actively running
  const isFocusing =
    pomoState.isRunning &&
    (pomoState.mode === "standard" || pomoState.phase === "focus");
  const activeTag = isFocusing && tag?.trim() ? tag.trim().replace(/^#/, "") : null;

  // Autofocus input whenever dialog opens
  useEffect(() => {
    if (isJotOpen) {
      setText("");
      // Small tick to ensure portal is mounted and visible
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isJotOpen]);

  const handleClose = useCallback(() => {
    setText("");
    setIsJotOpen(false);
  }, [setIsJotOpen]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      handleClose();
      return;
    }
    appendJot(trimmed, activeTag);
    toast("Jotted to notepad", { duration: 1800 });
    handleClose();
  }, [text, activeTag, appendJot, handleClose]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  if (!mounted || !isJotOpen) return null;

  const preview = formatJotLine(text.trim() || "call the bank", {
    tag: activeTag,
  });

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="fixed inset-0 bg-background/50 backdrop-blur-xs motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      />

      {/* Floating Spotlight Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Distraction jot"
        className={cn(
          "relative z-10 w-full max-w-lg rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-lg",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-150"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <div className="flex min-w-0 items-center gap-2">
            <FaStickyNote className="size-3.5 shrink-0 text-primary" />
            <span className="text-xs font-semibold tracking-tight">
              Distraction jot
            </span>

            {isFocusing && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/12 px-2 py-0.5 font-mono text-[11px] font-medium text-primary tabular-nums">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeTag ? `#${activeTag}` : "Focusing"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClose}
              className="grid size-6 place-items-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              aria-label="Close jot input"
              title="Close (Esc)"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Input Well */}
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 ring-offset-background transition-all focus-within:ring-2 focus-within:ring-ring/60">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Capture stray thought... (Enter to save)"
            aria-label="Distraction note text"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent font-normal text-foreground placeholder:text-muted-foreground outline-none text-base md:text-sm"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors",
              text.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground/50 hover:bg-transparent"
            )}
            aria-label="Save jot"
          >
            <CornerDownLeft className="size-3" />
            <span>Jot</span>
          </button>
        </div>

        {/* Footer info & preview */}
        <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
          <span className="truncate font-mono tabular-nums text-muted-foreground/80">
            {preview}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <KeyboardKey className="text-[10px]">Enter</KeyboardKey>
            <span>save</span>
            <span className="mx-0.5 text-muted-foreground/40">·</span>
            <KeyboardKey className="text-[10px]">Esc</KeyboardKey>
            <span>cancel</span>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
