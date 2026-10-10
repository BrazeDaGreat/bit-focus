"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ProjectIcon,
  humanizeIconName,
  loadProjectIconCatalog,
  suggestedProjectIcons,
} from "./ProjectIcon";

export function ProjectIconPicker({
  value,
  onChange,
  children,
  label = "Change project icon",
  className,
}: {
  value?: string;
  onChange: (icon: string | undefined) => void;
  children?: ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || names.length) return;
    let active = true;
    void loadProjectIconCatalog()
      .then((catalog) => {
        if (active) {
          setNames(Object.keys(catalog).sort());
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [open, names.length]);
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase().replace(/\s/g, "");
    return names.filter((name) =>
      humanizeIconName(name).toLowerCase().replace(/\s/g, "").includes(search),
    );
  }, [query, names]);
  const choose = (name?: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };
  const grid = (icons: string[]) => (
    <div className="grid grid-cols-7 gap-1">
      {icons.map((name) => (
        <button
          key={name}
          type="button"
          aria-label={humanizeIconName(name)}
          title={humanizeIconName(name)}
          aria-pressed={value === name}
          onClick={() => choose(name)}
          className={cn(
            "grid size-9 place-items-center rounded-lg transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary",
            value === name && "bg-primary/12 text-primary",
          )}
        >
          <ProjectIcon name={name} className="size-4" />
        </button>
      ))}
    </div>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={label}
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary",
          className,
        )}
      >
        {children || <ProjectIcon name={value} className="size-6" />}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[296px] max-w-[calc(100vw-24px)] rounded-xl p-2 shadow-xs data-[state=open]:animate-none data-[state=closed]:animate-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out"
      >
        <label className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 focus-within:ring-2 focus-within:ring-primary/40">
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <input
            aria-label="Search project icons"
            placeholder="Search all icons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="max-h-72 overflow-y-auto overscroll-contain">
          {!query.trim() && (
            <>
              <p className="px-1 pb-2 text-xs text-muted-foreground">
                Suggested
              </p>
              {grid(suggestedProjectIcons)}
            </>
          )}
          {names.length > 0 ? (
            <>
              <p className="px-1 pb-2 pt-3 text-xs text-muted-foreground">
                {query.trim()
                  ? `${matches.length} matching icons`
                  : "All icons"}
              </p>
              {matches.length ? (
                grid(
                  (query.trim()
                    ? matches
                    : matches.filter(
                        (name) => !suggestedProjectIcons.includes(name),
                      )
                  ).slice(
                    0,
                    query.trim() ? 240 : 240 - suggestedProjectIcons.length,
                  ),
                )
              ) : (
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-sm font-medium">No icons found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a word like school, code, or health.
                  </p>
                </div>
              )}
              {matches.length > 240 && (
                <p className="p-2 text-xs text-muted-foreground">
                  Showing the first 240. Search to narrow the list.
                </p>
              )}
            </>
          ) : failed ? (
            <p className="p-2 text-xs text-muted-foreground">
              Could not load the full catalog. Reopen to try again.
            </p>
          ) : (
            <Skeleton className="mt-3 h-9 rounded-lg animate-none motion-safe:animate-pulse" />
          )}
        </div>
        <button
          type="button"
          onClick={() => choose()}
          className="mt-2 flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-4" />
          Remove icon
        </button>
      </PopoverContent>
    </Popover>
  );
}
