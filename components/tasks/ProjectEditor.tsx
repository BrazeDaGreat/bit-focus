"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { useProjects, type Project } from "@/hooks/useProjects";
import { ProjectIconPicker } from "./ProjectIconPicker";

const fieldClass =
  "mt-1.5 w-full min-w-0 rounded-lg border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function ProjectEditor({
  project,
  onClose,
  onCreated,
}: {
  project?: Project;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { addProject, updateProject } = useProjects();
  const [title, setTitle] = useState(project?.title || "");
  const [notes, setNotes] = useState(project?.notes || "");
  const [icon, setIcon] = useState(project?.icon);
  const [busy, setBusy] = useState(false);
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={project ? "Edit project" : "New project"}
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim() || busy) return;
          setBusy(true);
          try {
            if (project)
              await updateProject(project.id!, {
                title: title.trim(),
                notes,
                icon,
              });
            else {
              const previousIds = new Set(
                useProjects.getState().projects.map((p) => p.id),
              );
              await addProject(title.trim(), "Active", "", notes);
              const created = useProjects
                .getState()
                .projects.find(
                  (p) => !previousIds.has(p.id) && p.title === title.trim(),
                );
              if (created?.id) {
                if (icon) await updateProject(created.id, { icon });
                onCreated(created.id);
              }
            }
            onClose();
          } catch {
            toast.error("Could not save project");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <ProjectIconPicker
            value={icon}
            onChange={setIcon}
            label="Choose project icon"
          />
          <div>
            <p className="text-sm font-medium">Project icon</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make it easy to find at a glance.
            </p>
          </div>
        </div>
        <label className="block text-xs text-muted-foreground">
          Name
          <input
            aria-label="Project name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className={fieldClass}
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Notes (optional)
          <textarea
            aria-label="Project notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${fieldClass} min-h-24 resize-y`}
          />
        </label>
        <button
          type="submit"
          disabled={!title.trim() || busy}
          className="flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {project ? "Save project" : "Create project"}
        </button>
      </form>
    </ResponsiveDialog>
  );
}
