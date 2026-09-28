/**
 * PiP Host
 *
 * Renders the {@link PipTimer} into the Picture-in-Picture window while one
 * is open. Mounted once in the app frame, so the window survives page
 * changes, and it portals from the main tree so the timer context and theme
 * are shared. Space in the PiP window starts or pauses the timer.
 *
 * @fileoverview Portal from the app into the Document PiP window
 * @author BIT Focus Development Team
 * @since v0.23.0
 */

"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePipWindow } from "@/hooks/usePipWindow";
import { usePomo } from "@/hooks/PomoContext";
import PipTimer from "@/components/PipTimer";

export default function PipHost() {
  const pipWindow = usePipWindow((s) => s.pipWindow);
  const { state, start, pause } = usePomo();
  const isRunning = state.isRunning;

  useEffect(() => {
    if (!pipWindow) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      if (isRunning) pause();
      else start();
    };
    pipWindow.document.addEventListener("keydown", onKeyDown);
    return () => pipWindow.document.removeEventListener("keydown", onKeyDown);
  }, [pipWindow, isRunning, start, pause]);

  if (!pipWindow) return null;
  return createPortal(<PipTimer />, pipWindow.document.body);
}
