/**
 * Notes - Heading Outline Rail
 *
 * A row of short marks pinned to the right edge of the screen, one per
 * heading, longest for the top level. They stay faint so they never compete
 * with the page; hovering (or tabbing into) the edge opens the full outline,
 * and a click scrolls that heading to the top. The mark for the section being
 * read is tinted, so the rail doubles as a quiet position indicator.
 *
 * Used by the editor and the shared-page viewer alike: it reads headings from
 * the Tiptap document and follows whichever container is scrolling.
 *
 * @fileoverview Hover-to-reveal heading navigation for Notes pages.
 * @since v0.25.2
 */

"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { cn } from "@/lib/utils";

interface OutlineHeading {
  pos: number;
  level: number;
  text: string;
}

/** Distance from the top of the viewport at which a heading counts as current. */
const ACTIVE_OFFSET = 140;

const MARK_WIDTH = ["w-5", "w-3.5", "w-2.5"];
const ITEM_INDENT = ["pl-2.5", "pl-6", "pl-9"];

function headingText(node: PMNode): string {
  // Page links and equations are atoms with no text of their own.
  return node.textBetween(0, node.content.size, " ", (leaf) => String(leaf.attrs.title ?? leaf.attrs.latex ?? "")).trim();
}

function readHeadings(editor: Editor): OutlineHeading[] {
  const out: OutlineHeading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return true;
    out.push({ pos, level: Math.min(3, Math.max(1, Number(node.attrs.level) || 1)), text: headingText(node) });
    return false;
  });
  return out;
}

export function NoteOutline({ editor }: { editor: Editor }): JSX.Element | null {
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [active, setActive] = useState(0);
  const headingsRef = useRef(headings);
  headingsRef.current = headings;

  const elementAt = useCallback((pos: number): HTMLElement | null => {
    if (editor.isDestroyed) return null;
    const dom = editor.view.nodeDOM(pos);
    return dom instanceof HTMLElement ? dom : null;
  }, [editor]);

  const scroller = useRef<Element | null>(null);

  const measure = useCallback(() => {
    // Headings near the end can never reach the top. Once the page is scrolled
    // all the way down, anything in the upper half of the screen counts.
    const end = scroller.current;
    const atEnd = !!end && end.scrollHeight > end.clientHeight && end.scrollTop + end.clientHeight >= end.scrollHeight - 4;
    const offset = atEnd ? Math.max(ACTIVE_OFFSET, window.innerHeight / 2) : ACTIVE_OFFSET;
    // Before the first heading scrolls past, the first section is the current one.
    let current = 0;
    headingsRef.current.forEach((heading, index) => {
      const element = elementAt(heading.pos);
      // Headings folded inside a closed toggle have no box and are skipped.
      if (!element || !element.getClientRects().length) return;
      if (element.getBoundingClientRect().top <= offset) current = index;
    });
    setActive(current);
  }, [elementAt]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (editor.isDestroyed) return;
        setHeadings((previous) => {
          const next = readHeadings(editor);
          const same = next.length === previous.length && next.every((h, i) => h.pos === previous[i].pos && h.level === previous[i].level && h.text === previous[i].text);
          return same ? previous : next;
        });
      }, 150);
    };
    setHeadings(readHeadings(editor));
    editor.on("update", refresh);
    return () => { editor.off("update", refresh); if (timer) clearTimeout(timer); };
  }, [editor]);

  // Follows whichever container holds the page: the notes pane in the app, the window on a shared page.
  useEffect(() => {
    let frame: number | null = null;
    const onScroll = (event: Event) => {
      if (event.type === "scroll") {
        const target = event.target instanceof Element ? event.target : document.scrollingElement;
        // Only the container holding the page counts; other panes scroll too.
        if (!target || editor.isDestroyed || !target.contains(editor.view.dom)) return;
        scroller.current = target;
      }
      if (frame != null) return;
      frame = requestAnimationFrame(() => { frame = null; measure(); });
    };
    measure();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [measure, headings, editor]);

  if (headings.length < 2) return null;

  const jump = (index: number) => {
    const element = elementAt(headings[index].pos);
    if (!element) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    setActive(index);
  };

  return (
    <nav aria-label="Page outline" className="group/outline fixed right-0 top-1/2 z-20 hidden -translate-y-1/2 md:block">
      <div
        aria-hidden
        className="flex max-h-[60vh] flex-col items-end gap-2.5 overflow-hidden py-4 pl-8 pr-4 transition-opacity delay-150 duration-150 group-has-[:focus-visible]/outline:opacity-0 group-has-[:focus-visible]/outline:delay-0 group-hover/outline:opacity-0 group-hover/outline:delay-0"
      >
        {headings.map((heading, index) => (
          <span
            key={heading.pos}
            className={cn(
              "h-[3px] shrink-0 rounded-full transition-colors duration-150",
              MARK_WIDTH[heading.level - 1],
              index === active ? "bg-primary" : "bg-muted-foreground/25",
            )}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute right-3 top-1/2 w-64 -translate-y-1/2 translate-x-1 opacity-0 transition delay-150 duration-150 group-has-[:focus-visible]/outline:pointer-events-auto group-has-[:focus-visible]/outline:translate-x-0 group-has-[:focus-visible]/outline:opacity-100 group-has-[:focus-visible]/outline:delay-0 group-hover/outline:pointer-events-auto group-hover/outline:translate-x-0 group-hover/outline:opacity-100 group-hover/outline:delay-0 motion-reduce:translate-x-0 motion-reduce:transition-none">
        <ol className="max-h-[70vh] space-y-px overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xs">
          {headings.map((heading, index) => (
            <li key={heading.pos}>
              <button
                type="button"
                onClick={() => jump(index)}
                aria-current={index === active ? "location" : undefined}
                className={cn(
                  "block w-full truncate rounded-lg py-1.5 pr-2.5 text-left text-[13px] leading-5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary",
                  ITEM_INDENT[heading.level - 1],
                  heading.level === 1 && "font-medium",
                  index === active ? "bg-primary/12 text-primary hover:bg-primary/12" : heading.level === 1 ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  !heading.text && "italic",
                )}
              >
                {heading.text || "Untitled heading"}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
