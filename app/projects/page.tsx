import { Suspense } from "react";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading tasks…</div>
      }
    >
      <TaskWorkspace />
    </Suspense>
  );
}
