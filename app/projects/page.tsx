/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { FaPlus, FaProjectDiagram } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useProjects, type Project, type ProjectWithStats } from "@/hooks/useProjects";
import { cn, formatNumber, setClipboard } from "@/lib/utils";
import { FaClipboard } from "react-icons/fa6";
import getIconFromLink from "@/lib/getIconFromLink";

function CreateProjectDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Project["status"]>("Scheduled");
  const [notes, setNotes] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addProject } = useProjects();

  const handleSubmit = async (): Promise<void> => {
    if (!title.trim()) {
      toast.error("Please enter a project title");
      return;
    }
    setIsSubmitting(true);
    try {
      await addProject(title.trim(), status, version.trim(), notes.trim());
      toast.success("Project created!");
      setOpen(false);
      setTitle("");
      setStatus("Scheduled");
      setNotes("");
      setVersion("1.0.0");
    } catch {
      toast.error("Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FaPlus className="mr-1.5 h-3 w-3" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project to track milestones and issues
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Project Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter project title"
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as Project["status"])}
              disabled={isSubmitting}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g., 1.0.0"
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add project notes..."
              className="min-h-[100px]"
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyProjectToText(): JSX.Element {
  const { getAllProjectsWithStats } = useProjects();
  const projects = getAllProjectsWithStats();

  function getEmojiByStatus(
    text: "Scheduled" | "Active" | "Closed" | "Paid"
  ): string {
    if (text === "Active") return "‼️";
    if (text === "Closed") return "❓";
    if (text === "Paid") return "✅";
    return "";
  }

  async function handleClick(): Promise<void> {
    const text: string[] = [];
    let pending = 0;

    projects.forEach((project) => {
      text.push(`\n*${project.title}*`);
      project.milestones.forEach((milestone) => {
        if (milestone.budget === 0) return;
        if (milestone.status === "Scheduled") return;
        const emoji = getEmojiByStatus(milestone.status);
        text.push(`- ${milestone.title} - Rs ${formatNumber(milestone.budget)} ${emoji}`);
        if (milestone.status === "Closed") pending += milestone.budget;
      });
    });

    text.push(`\n\n*Pending: Rs ${formatNumber(pending)}*`);
    const isCopied = await setClipboard(text.join("\n"));
    if (isCopied) toast.success("Copied to clipboard");
    else toast.error("Failed to copy");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <FaClipboard className="mr-1.5 h-3 w-3" />
      Copy Earnings
    </Button>
  );
}

function ProjectCard({ project }: { project: ProjectWithStats }): JSX.Element {
  const completedMilestones = project.milestones.filter(
    (m) => m.status === "Closed" || m.status === "Paid"
  ).length;
  const totalMilestones = project.milestones.length;
  const progress =
    totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;
  const openIssues = project.milestones.reduce(
    (sum, m) => sum + (m.totalIssues - m.completedIssues),
    0
  );

  const statusDot: Record<Project["status"], string> = {
    Active: "bg-emerald-500",
    Scheduled: "bg-amber-500",
    Closed: "bg-muted-foreground",
  };
  const statusText: Record<Project["status"], string> = {
    Active: "text-emerald-600 dark:text-emerald-400",
    Scheduled: "text-amber-600 dark:text-amber-400",
    Closed: "text-muted-foreground",
  };

  return (
    <Link href={`/projects/${project.id}`} prefetch={true} className="block group">
      <div className="border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer h-full flex flex-col hover:border-foreground/20">
        {/* Status */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusDot[project.status])} />
          <span className={cn("text-xs font-semibold uppercase tracking-widest", statusText[project.status])}>
            {project.status}
          </span>
        </div>

        {/* Title + version */}
        <h3 className="text-lg font-semibold tracking-tight leading-snug">{project.title}</h3>
        <p className="text-xs font-mono text-muted-foreground mt-0.5 mb-4">v{project.version}</p>

        {/* Progress */}
        <div className="mb-1.5">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {completedMilestones}/{totalMilestones} milestones complete
        </p>

        {/* Footer */}
        <div className="border-t mt-auto pt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {openIssues} open {openIssues === 1 ? "issue" : "issues"}
          </span>
          {project.quickLinks && project.quickLinks.length > 0 && (
            <div className="flex gap-1">
              {project.quickLinks.slice(0, 3).map((link: any) => (
                <Button
                  key={link.id}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(link.url, "_blank");
                  }}
                  title={link.title}
                >
                  {getIconFromLink(link.url)}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ProjectsPage(): JSX.Element {
  const { theme } = useTheme();
  const { getAllProjectsWithStats, loadProjects } = useProjects();
  const [activeFilter, setActiveFilter] = useState<Project["status"] | "All">("All");

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const allProjects = getAllProjectsWithStats();

  const counts: Record<Project["status"], number> = {
    Active: allProjects.filter((p) => p.status === "Active").length,
    Scheduled: allProjects.filter((p) => p.status === "Scheduled").length,
    Closed: allProjects.filter((p) => p.status === "Closed").length,
  };

  const filtered =
    activeFilter === "All"
      ? allProjects
      : allProjects.filter((p) => p.status === activeFilter);

  const chipDot: Record<Project["status"], string> = {
    Active: "bg-emerald-500",
    Scheduled: "bg-amber-500",
    Closed: "bg-muted-foreground/60",
  };

  return (
    <div className="flex-1 p-6 md:p-8 container mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 pb-6 border-b">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage milestones and track progress
          </p>
        </div>

        {/* Status chips (desktop) */}
        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          {(["Active", "Scheduled", "Closed"] as const).map((status) => (
            <button
              key={status}
              onClick={() =>
                setActiveFilter(activeFilter === status ? "All" : status)
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                activeFilter === status
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", chipDot[status])} />
              {counts[status]} {status}
            </button>
          ))}
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-3 mb-6">
        {/* Status chips (mobile) */}
        <div className="flex md:hidden items-center gap-1.5 flex-1 overflow-x-auto pb-1">
          {(["Active", "Scheduled", "Closed"] as const).map((status) => (
            <button
              key={status}
              onClick={() =>
                setActiveFilter(activeFilter === status ? "All" : status)
              }
              className={cn(
                "flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                activeFilter === status
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border"
              )}
            >
              {counts[status]} {status}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <CopyProjectToText />
          <CreateProjectDialog />
        </div>
      </div>

      {/* Content */}
      {allProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FaProjectDiagram className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <h3 className="text-base font-semibold mb-1">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Get started by creating your first project
          </p>
          <CreateProjectDialog />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            No {activeFilter} projects
          </p>
          <button
            onClick={() => setActiveFilter("All")}
            className="text-xs text-primary hover:underline"
          >
            Show all projects
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}
