// components/ui/keyboard-key.tsx
import { cn } from "@/lib/utils"

export function KeyboardKey({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn(
      "rounded border bg-muted px-1.5 py-0.5 font-mono text-xs uppercase text-muted-foreground",
      className
    )}>
      {children}
    </kbd>
  )
}
