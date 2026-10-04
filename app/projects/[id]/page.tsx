"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Loading project…
        </div>
      }
    >
      <TaskWorkspace initialProjectId={Number(params.id)} />
    </Suspense>
  );
}
