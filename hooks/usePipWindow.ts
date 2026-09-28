/**
 * Picture-in-Picture Window Store
 *
 * Opens a Document Picture-in-Picture window and dresses it as part of the
 * app: every stylesheet is copied across, and the page's theme and font
 * classes are mirrored (and kept in sync if the theme changes), so the
 * window renders with the same Tailwind tokens as the page behind it.
 *
 * The window's contents are rendered by {@link PipHost}, which portals into
 * the window from the main React tree. Because it is a portal and not a
 * separate React root, the PiP timer reads the same timer context as every
 * other surface, and it stays open while you move between pages.
 *
 * @fileoverview Document PiP window lifecycle
 * @author BIT Focus Development Team
 * @since v0.23.0
 */

import { create } from "zustand";

/** Default window size: wide enough for the ring, clock and controls */
export const PIP_SIZE = { width: 340, height: 164 };

interface DocumentPictureInPicture {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
  window: Window | null;
}

function pipApi(): DocumentPictureInPicture | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture })
    .documentPictureInPicture ?? null;
}

/** True when this browser supports Document Picture-in-Picture. */
export function pipSupported(): boolean {
  return pipApi() !== null;
}

/** Copy every stylesheet from the page into the PiP document. */
function copyStyles(target: Document): void {
  // Inline stylesheet text resolves url() against the document base, which
  // in a PiP window is about:blank. Point it at the app instead.
  const base = target.createElement("base");
  base.href = window.location.origin + "/";
  target.head.appendChild(base);

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      const style = target.createElement("style");
      style.textContent = css;
      target.head.appendChild(style);
    } catch {
      // Cross-origin sheets can't be read; link to them instead.
      if (sheet.href) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}

/** Mirror the theme (html) and font (body) classes, now and on change. */
function mirrorClasses(target: Document): MutationObserver {
  const apply = () => {
    target.documentElement.className = document.documentElement.className;
    target.documentElement.style.cssText = document.documentElement.style.cssText;
    target.body.className = `${document.body.className} bg-background text-foreground antialiased`;
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  return observer;
}

interface PipWindowState {
  /** The open PiP window, if any */
  pipWindow: Window | null;
  /** Open the PiP window (or focus it if already open) */
  open: () => Promise<boolean>;
  /** Close the PiP window */
  close: () => void;
}

export const usePipWindow = create<PipWindowState>((set, get) => ({
  pipWindow: null,

  open: async () => {
    const api = pipApi();
    if (!api) return false;

    const existing = get().pipWindow;
    if (existing && !existing.closed) {
      existing.focus();
      return true;
    }

    try {
      const pipWindow = await api.requestWindow(PIP_SIZE);
      pipWindow.document.title = "BIT Focus";
      copyStyles(pipWindow.document);
      const observer = mirrorClasses(pipWindow.document);

      pipWindow.addEventListener("pagehide", () => {
        observer.disconnect();
        set({ pipWindow: null });
      });

      set({ pipWindow });
      return true;
    } catch (error) {
      console.error("Error opening Picture-in-Picture window:", error);
      return false;
    }
  },

  close: () => {
    get().pipWindow?.close();
    set({ pipWindow: null });
  },
}));
