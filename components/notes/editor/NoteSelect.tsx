/**
 * Dropdown for editor chrome. Native selects ignore the theme and open OS
 * menus; this one is themed, and mouse use never moves focus out of the
 * editor, so the text selection (and the bubble menu holding it) survives.
 * The list is portalled and fixed-positioned so clipped containers such as
 * code blocks cannot cut it off.
 */
"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NoteSelectOption { value: string; label: string; icon?: ReactNode }

export function NoteSelect({ value, options, onChange, label, disabled, searchable, iconOnly, className }: {
  value: string;
  options: NoteSelectOption[];
  onChange: (value: string) => void;
  /** Accessible name, also the tooltip. */
  label: string;
  disabled?: boolean;
  /** Show a filter field, for long lists. */
  searchable?: boolean;
  /** Trigger shows only the selected option's icon. */
  iconOnly?: boolean;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const filter = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const selected = options.find((option) => option.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = useCallback((refocus = false) => {
    setOpen(false); setQuery(""); setPlace(null);
    if (refocus) trigger.current?.focus();
  }, []);
  const openList = () => {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };
  const choose = (option: NoteSelectOption | undefined) => {
    if (!option) return;
    close();
    if (option.value !== value) onChange(option.value);
  };

  // Place under the trigger, flipping above when the viewport runs out.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = list.current?.offsetWidth ?? 192;
      const wanted = Math.min(320, (list.current?.scrollHeight ?? 320) + 2);
      const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
      const flip = below < Math.min(wanted, 200) && above > below;
      const maxHeight = Math.max(120, Math.min(320, flip ? above : below));
      setPlace({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: flip ? rect.top - 6 - Math.min(wanted, maxHeight) : rect.bottom + 6,
        maxHeight,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, shown.length]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !list.current?.contains(target)) close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open, close]);
  useEffect(() => { setActive(0); }, [query]);
  // The list is parked offscreen until measured (not hidden: hidden inputs
  // cannot take focus).
  // Deferred a task: the click that opened the list is still being handled by
  // the editor, which would take focus straight back.
  const measured = place !== null;
  useEffect(() => {
    if (!measured || !searchable) return;
    const timer = setTimeout(() => filter.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(timer);
  }, [measured, searchable]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKey = (event: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); openList(); }
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") { if (event.key === "Escape") event.preventDefault(); close(event.key === "Escape"); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + shown.length) % Math.max(1, shown.length));
      return;
    }
    if (event.key === "Home" || event.key === "End") { event.preventDefault(); setActive(event.key === "Home" ? 0 : shown.length - 1); return; }
    if (event.key === "Enter") { event.preventDefault(); choose(shown[active]); trigger.current?.focus(); return; }
    // Type-ahead when there is no filter field to type into.
    if (!searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + event.key.toLowerCase(), at: now };
      const hit = shown.findIndex((option) => option.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  return <>
    <button ref={trigger} type="button" aria-label={label} title={label} disabled={disabled}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-activedescendant={open && !searchable && shown[active] ? `${id}-${active}` : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => (open ? close() : openList())} onKeyDown={onKey}
      className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
        open && "bg-muted text-foreground", className)}>
      {selected?.icon}
      {!iconOnly && <span className="truncate">{selected?.label ?? value}</span>}
      <ChevronDown className={cn("size-3.5 shrink-0 opacity-70 transition-transform duration-150", open && "rotate-180")} aria-hidden />
    </button>
    {open && createPortal(
      <div ref={list} style={place ? { left: place.left, top: place.top, maxHeight: place.maxHeight } : { left: -10000, top: 0 }}
        onMouseDown={(event) => { if (!(event.target as HTMLElement).closest("input")) event.preventDefault(); }}
        className="fixed z-[10000] flex min-w-44 max-w-[min(18rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-xs motion-safe:animate-in motion-safe:fade-in motion-safe:duration-100">
        {searchable && <label className="mb-1 flex shrink-0 items-center gap-2 rounded-lg bg-muted/60 px-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input ref={filter} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKey}
            aria-label={`Filter ${label.toLowerCase()}`} placeholder="Filter…" role="combobox" aria-expanded aria-controls={id}
            aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>}
        <div id={id} role="listbox" aria-label={label} className="min-h-0 overflow-y-auto overscroll-contain">
          {shown.map((option, index) => <div key={option.value} id={`${id}-${index}`} data-index={index} role="option" aria-selected={option.value === value}
            onMouseEnter={() => setActive(index)} onClick={() => choose(option)}
            className={cn("flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm", index === active && "bg-muted")}>
            {option.icon && <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">{option.icon}</span>}
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.value === value && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
          </div>)}
          {!shown.length && <p className="px-2 py-2 text-sm text-muted-foreground">No matches</p>}
        </div>
      </div>, document.body)}
  </>;
}
