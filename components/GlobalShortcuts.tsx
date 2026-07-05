/**
 * Global Keyboard Shortcuts - Listener and Help Dialog
 *
 * Mounts a single window-level `keydown` listener implementing every
 * application-wide shortcut defined in `hooks/useShortcuts.ts`, and renders
 * the screen-centered help dialog listing them.
 *
 * Behavior rules:
 * - Shortcuts are ignored while typing in inputs, textareas, selects, or
 *   contenteditable regions (e.g. the Tiptap notepad), so plain letter keys
 *   are safe to use as bindings.
 * - Shortcuts gated behind a disabled feature toggle are inert and hidden
 *   from the help dialog.
 * - The sidebar toggle (Ctrl/⌘+B) is implemented by the sidebar primitive
 *   itself; it is only documented here.
 *
 * @fileoverview Global shortcut handling and shortcuts help dialog
 * @author BIT Focus Development Team
 * @since v0.18.5
 */

"use client";

import { Fragment, useEffect, useMemo, type JSX } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useConfig } from "@/hooks/useConfig";
import { usePomo } from "@/hooks/PomoContext";
import { useNotepad } from "@/hooks/useNotepad";
import {
  activeShortcuts,
  useShortcutsDialog,
  type ShortcutCategory,
  type ShortcutDef,
} from "@/hooks/useShortcuts";

/** True when the keystroke originates from a text-editing context */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Global Shortcuts Component
 *
 * Attaches the window keydown listener and renders the help dialog. Mount
 * once inside the app frame (requires Pomo and Sidebar providers above it).
 *
 * @returns The shortcuts help dialog (listener has no visual output)
 */
export default function GlobalShortcuts(): JSX.Element {
  const router = useRouter();
  const { start, pause, reset, state } = usePomo();
  const { featureToggles } = useConfig();
  const { setHelpOpen } = useShortcutsDialog();

  const shortcuts = useMemo(
    () => activeShortcuts(featureToggles),
    [featureToggles]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;

      // ── Notepad (Alt+N works even when typing) ──
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const store = useNotepad.getState();
        store.setIsOpen(!store.isOpen);
        return;
      }

      if (isTypingTarget(e.target)) return;
      // Leave browser/OS combos alone (sidebar's own Ctrl+B included)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // ── Help dialog ──
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(!useShortcutsDialog.getState().helpOpen);
        return;
      }

      // ── Timer ──
      if (e.code === "Space" && !e.shiftKey) {
        e.preventDefault();
        if (state.isRunning) pause();
        else start();
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        reset();
        return;
      }

      // ── Navigation (plain letter keys) ──
      if (e.shiftKey) return;
      const nav = shortcuts.find(
        (s) => s.action === "nav" && s.keys[0].toLowerCase() === e.key.toLowerCase()
      );
      if (nav?.href) {
        e.preventDefault();
        router.push(nav.href);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, router, start, pause, reset, state.isRunning, setHelpOpen]);

  return <ShortcutsDialog shortcuts={shortcuts} />;
}


/**
 * Shortcuts Help Dialog
 *
 * Screen-centered dialog listing all currently active shortcuts, grouped
 * by category with kbd-styled key caps.
 */
function ShortcutsDialog({ shortcuts }: { shortcuts: ShortcutDef[] }): JSX.Element {
  const { helpOpen, setHelpOpen } = useShortcutsDialog();

  const renderCategory = (category: ShortcutCategory) => {
    const group = shortcuts.filter((s) => s.category === category);
    if (group.length === 0) return null;
    return (
      <div key={category} className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 px-1">
          {category}
        </h3>
        <div className="rounded-lg border bg-card text-card-foreground shadow-xs divide-y divide-border/50 overflow-hidden">
          {group.map((s) => (
            <div
              key={s.description}
              className="flex items-center justify-between px-3.5 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              <span className="text-muted-foreground/90 font-medium">{s.description}</span>
              <KbdGroup>
                {s.keys.map((k, i) => (
                  <Fragment key={k}>
                    {i > 0 && (
                      <span className="text-muted-foreground/60 text-xs font-bold">+</span>
                    )}
                    <Kbd className="bg-background shadow-xs font-mono font-bold border-muted-foreground/20">{k}</Kbd>
                  </Fragment>
                ))}
              </KbdGroup>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts work anywhere in the app, except while typing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[65vh] overflow-y-auto pr-1 animate-in fade-in-50 duration-200">
          {/* Column 1: Navigation */}
          <div className="flex flex-col gap-4">
            {renderCategory("Navigation")}
          </div>

          {/* Column 2: Timer & General */}
          <div className="flex flex-col gap-6">
            {renderCategory("Timer")}
            {renderCategory("General")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
