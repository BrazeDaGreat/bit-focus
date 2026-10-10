"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import { TaskWorkspaceSkeleton } from "@/components/tasks/TaskWorkspaceSkeleton";
export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<TaskWorkspaceSkeleton />}>
      <TaskWorkspace initialProjectId={Number(params.id)} />
    </Suspense>
  );
}
