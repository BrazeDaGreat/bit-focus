"use client";

/**
 * Greeting Header
 *
 * The dashboard's date line and time-of-day greeting — the page's largest
 * paint. It is part of the server-rendered HTML so it appears with the first
 * frame instead of waiting for hydration.
 *
 * The page is prerendered, so the server cannot know the visitor's clock. A
 * tiny inline script placed straight after the heading writes the right text
 * before first paint; React then hydrates over the same text (the elements
 * are marked `suppressHydrationWarning`, and both sides compute identical
 * strings). Client-side navigations render the real values directly, with no
 * script involved.
 */

import { useSyncExternalStore, type JSX } from "react";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
};

function greetingFor(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Same logic as above, as source text for the pre-paint script. */
const PATCH_SCRIPT = `(function(){var s=document.currentScript,h=s&&s.parentElement;if(!h)return;var n=new Date(),t=n.getHours(),d=h.querySelector("[data-greeting-date]"),g=h.querySelector("[data-greeting-text]");if(d)d.textContent=n.toLocaleDateString("en-US",${JSON.stringify(
  DATE_OPTIONS
)});if(g)g.textContent=t<12?"Good morning":t<17?"Good afternoon":"Good evening"})()`;

const noopSubscribe = () => () => {};

/** True while rendering on the server and while hydrating; false afterwards. */
function useIsServerRender(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true
  );
}

export default function GreetingHeader(): JSX.Element {
  // The script only exists in the server HTML. Rendering it during hydration
  // keeps the trees identical; it is dropped afterwards (and never created on
  // client navigations, where React would refuse to run it anyway).
  const serverRender = useIsServerRender();

  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const dateStr = now.toLocaleDateString("en-US", DATE_OPTIONS);

  return (
    <header className="mb-6">
      <p
        data-greeting-date
        suppressHydrationWarning
        className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground"
      >
        {dateStr}
      </p>
      <h1
        data-greeting-text
        suppressHydrationWarning
        className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {greeting}
      </h1>
      {serverRender && <script dangerouslySetInnerHTML={{ __html: PATCH_SCRIPT }} />}
    </header>
  );
}
