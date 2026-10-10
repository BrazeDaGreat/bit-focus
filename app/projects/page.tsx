import { Suspense } from "react";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import { TaskWorkspaceSkeleton } from "@/components/tasks/TaskWorkspaceSkeleton";
export default function ProjectsPage() {
  return (
    <Suspense fallback={<TaskWorkspaceSkeleton />}>
      <TaskWorkspace />
    </Suspense>
  );
}
