"use client";

/**
 * AI Chat - Composer Controls
 *
 * Context and model pickers beside the message box.
 */

import { useState, useMemo, type JSX } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Sparkles, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTEXT_SOURCES, buildContextBlock, estimateTokens, type ContextInput, type ContextSourceId } from "@/lib/ai-context";

// ── Composer controls ─────────────────────────────────────────────────────────

export function ContextPicker({
  sources,
  onChange,
  tokens,
  contextInput,
}: {
  sources: ContextSourceId[];
  onChange: (next: ContextSourceId[]) => void;
  tokens: number;
  contextInput: ContextInput;
}): JSX.Element {
  const toggle = (id: ContextSourceId) =>
    onChange(
      sources.includes(id) ? sources.filter((s) => s !== id) : [...sources, id]
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
            sources.length
              ? "bg-primary/12 text-primary hover:bg-primary/20"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          title="Choose what data is attached"
        >
          <Sparkles className="size-3" />
          Context
          {sources.length > 0 && (
            <span className="font-mono font-normal opacity-70">
              ~{tokens}t
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl p-2">
        <p className="px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Attached to this chat
        </p>
        <div className="flex flex-col gap-0.5">
          {CONTEXT_SOURCES.map((source) => {
            const active = sources.includes(source.id);
            const block = buildContextBlock(source.id, contextInput);
            const cost = block ? estimateTokens(block) : 0;
            return (
              <button
                key={source.id}
                onClick={() => toggle(source.id)}
                disabled={!block}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors disabled:opacity-40",
                  active ? "bg-primary/12" : "hover:bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  )}
                >
                  {active && <Check className="size-2.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">
                    {source.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {block ? source.description : "Nothing recorded yet"}
                  </span>
                </span>
                {block && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    ~{cost}t
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 border-t px-1.5 pt-2 text-[11px] leading-relaxed text-muted-foreground">
          Anything not attached can still be fetched by the assistant with a tool
          when it needs it.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(term) ||
            m.name.toLowerCase().includes(term)
        )
      : models;
  }, [models, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-9 min-w-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Model for this chat"
        >
          <span className="max-w-40 truncate font-mono">{value}</span>
          <ChevronDown className="size-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models"
          className="mb-1.5 h-8 rounded-lg text-xs"
        />
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No models match. Fetch the list in settings.
            </p>
          ) : (
            filtered.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onChange(model.id);
                  setOpen(false);
                }}
                className={cn(
                  "shrink-0 truncate rounded-lg px-2 py-2 text-left font-mono text-xs leading-5 transition-colors",
                  model.id === value
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {model.id}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
