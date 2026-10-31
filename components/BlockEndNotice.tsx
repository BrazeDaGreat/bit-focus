"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePomo } from "@/hooks/PomoContext";
import { useActiveBlock } from "@/hooks/useCurrentBlock";

/** One end-of-block prompt for timers started from a calendar block. */
export default function BlockEndNotice() {
  const { state, reset } = usePomo();
  const active = useActiveBlock((s) => s.active);
  const setActive = useActiveBlock((s) => s.setActive);
  const resetRef = useRef(reset);
  const [ready, setReady] = useState(false);
  const isRunning = state.isRunning;
  const isReset = !isRunning && state.elapsedSeconds === 0;

  useEffect(() => {
    resetRef.current = reset;
  }, [reset]);

  // The provider restores the saved timer in its mount effect. Wait a render
  // before deciding whether its initial zero means the user reset the timer.
  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !active) return;

    const check = () => {
      // The store is cleared before the toast, so visibility events and React
      // effect replays cannot announce the same occurrence twice.
      if (useActiveBlock.getState().active !== active) return;
      if (isReset) {
        setActive(null);
        return;
      }
      if (!isRunning || Date.now() < active.endsAt) return;

      setActive(null);
      const toastId = `block-ended:${active.key}`;
      toast(`${active.title} block ended`, {
        id: toastId,
        duration: Infinity,
        action: { label: "Stop timer", onClick: () => resetRef.current() },
        cancel: { label: "Keep going", onClick: () => { toast.dismiss(toastId); } },
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    // Defer the first check until pending provider/store updates have landed.
    const initial = window.setTimeout(check, 0);
    const interval = window.setInterval(check, 15_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, active, setActive, isRunning, isReset]);

  return null;
}
