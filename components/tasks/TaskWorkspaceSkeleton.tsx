import { Skeleton } from "@/components/ui/skeleton";

export function TaskWorkspaceSkeleton() {
  return (
    <div
      aria-label="Loading projects and tasks"
      className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 items-start gap-5 px-3 pb-3 pt-2 sm:p-6 [&_[data-slot=skeleton]]:animate-none motion-safe:[&_[data-slot=skeleton]]:animate-pulse"
    >
      <div className="hidden w-64 shrink-0 rounded-2xl border bg-card p-5 shadow-xs lg:block xl:w-72">
        <Skeleton className="mb-5 h-8 w-full rounded-lg" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="mb-3 flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
            <Skeleton className="size-5 rounded-full" />
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 lg:rounded-2xl lg:border lg:bg-card lg:p-5 lg:shadow-xs">
        <div className="mb-4 flex gap-2 overflow-hidden py-1 lg:hidden">
          {[20, 24, 28, 24].map((w, i) => (
            <Skeleton
              key={i}
              className="h-9 shrink-0 rounded-full"
              style={{ width: `${w * 0.25}rem` }}
            />
          ))}
        </div>
        <div className="mb-5 flex items-center gap-3 lg:mb-6">
          <Skeleton className="size-10 shrink-0 rounded-xl lg:size-12" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="mb-5 flex gap-1 rounded-xl bg-muted/60 p-1">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-20 min-w-0 flex-1 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mb-6 hidden h-12 w-full rounded-xl md:block" />
        <Skeleton className="mb-3 h-3 w-24" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <Skeleton className="size-5 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="size-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
