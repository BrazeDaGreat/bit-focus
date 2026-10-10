"use client";

import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PARSE_EXAMPLES } from "@/lib/task-parse";

export function TaskSyntaxHelp({ onInsert }: { onInsert?: (example: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Quick add syntax" title="Quick add syntax" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-background data-[state=open]:shadow-xs">
          <Sparkles className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Quick add syntax" className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-popover p-4 shadow-xs motion-reduce:animate-none">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Type naturally</h2>
        <div className="max-h-[min(28rem,60vh)] space-y-3 overflow-y-auto overscroll-contain">
          {PARSE_EXAMPLES.map(({ group, items }) => (
            <section key={group}>
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{group}</h3>
              <div className="rounded-xl bg-muted/40 p-1">
                {items.map(({ input, result }) => (
                  <button type="button" key={input} onClick={() => onInsert?.(input)} className="block w-full rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="block break-words font-mono text-sm tabular-nums">{input}</span>
                    <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted-foreground">{result}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
