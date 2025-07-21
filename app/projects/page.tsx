/**
 * Projects Page - Main Project Management Interface
 *
 * This page provides the main interface for project management including
 * project listing, creation, and overview statistics. It serves as the
 * entry point for the comprehensive project management system.
 *
 * Features:
 * - Project listing with status indicators and progress
 * - Quick project creation interface
 * - Project statistics and overview cards
 * - Navigation to individual project details
 * - Responsive grid layout for project cards
 * - Real-time progress calculations
 *
 * Dependencies:
 * - Project management hook for data operations
 * - UI components for consistent styling
 * - Navigation system for project details
 * - Theme-aware toast notifications
 *
 * @fileoverview Main project management page interface
 * @author BIT Focus Development Team
 * @since v0.9.0-alpha
 */

"use client";

import { useEffect, useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast, Toaster } from "sonner";
import { FaPlus, FaClock, FaProjectDiagram } from "react-icons/fa";
import { VscSourceControl } from "react-icons/vsc";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

import { useProjects, type Project } from "@/hooks/useProjects";
import { useConfig } from "@/hooks/useConfig";
import StatusBadge from "./StatusBadge";
import { formatNumber, getCurrencySymbol, setClipboard } from "@/lib/utils";
import { FaClipboard } from "react-icons/fa6";

/**
 * Project Card Component
 *
 * Renders an individual project card with statistics, progress, and navigation.
 *
 * @param {Object} props - Component props
 * @param {ProjectWithStats} props.project - Project data with statistics
 * @returns {JSX.Element} Project card component
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProjectCard({ project }: { project: any }): JSX.Element {
  const router = useRouter();
  const { currency } = useConfig();

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{project.title}</CardTitle>
          <StatusBadge status={project.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{project.progress}%</span>
            </div>
            <div className="w-full bg-accent rounded-full h-2">
              <div
                className="bg-accent-foreground h-2 rounded-full transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <VscSourceControl className="text-muted-foreground" />
              <span>v{project.version}</span>
            </div>
            <div className="flex items-center gap-2">
              {getCurrencySymbol(currency)}
              <span>{formatNumber(project.totalBudget)}</span>
            </div>
          </div>

          {/* Creation Date */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FaClock />
            <span>
              Created {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Create Project Dialog Component
 *
 * Provides a modal interface for creating new projects with form validation.
 *
 * @returns {JSX.Element} Project creation dialog
 */
function CreateProjectDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Project["status"]>("Scheduled");
  const [notes, setNotes] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addProject } = useProjects();

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    setIsSubmitting(true);
    try {
      await addProject(title.trim(), status, version.trim(), notes.trim());
      toast.success("Project created successfully!");
      setOpen(false);
      setTitle("");
      setStatus("Scheduled");
      setNotes("");
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FaPlus />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a new project to organize your milestones and issues.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input
              id="title"
              placeholder="Enter project title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as Project["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              placeholder="Enter project version..."
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Project description and notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
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

  function getEmojiByStatus(text: "Scheduled" | "Active" | "Closed" | "Paid") {
    if (text === "Scheduled") return "";
    if (text === "Active") return "‼️";
    if (text === "Closed") return "❓";
    if (text === "Paid") return "✅";
  }

  async function handleClick() {
    const text: string[] = [];
    let pending: number = 0;

    projects.forEach(project => {
      text.push(`\n*${project.title}*`)
      project.milestones.forEach(milestone => {
        if (milestone.budget === 0) return;
        if (milestone.status === "Scheduled") return;
        const emoji = getEmojiByStatus(milestone.status);
        text.push(`- ${milestone.title} - Rs ${formatNumber(milestone.budget)} ${emoji}`);
        if (milestone.status === "Closed") pending += milestone.budget
      })
    })

    text.push(`\n\n*Pending: Rs ${formatNumber(pending)}*`)

    const isCopied = await setClipboard(text.join("\n"));
    if (isCopied) toast.success("Copied to clipboard");
    else toast.error("Failed to copy to clipboard");
  }

  return <Button onClick={handleClick}>
    <FaClipboard />
    <span>Copy Earnings</span>
  </Button>;
}

/**
 * Main Projects Page Component
 *
 * Renders the complete projects management interface with overview statistics
 * and project listing capabilities.
 *
 * @returns {JSX.Element} Complete projects page interface
 */
export default function ProjectsPage(): JSX.Element {
  const { theme } = useTheme();
  const { getAllProjectsWithStats, loadProjects, loadingProjects } =
    useProjects();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const projects = getAllProjectsWithStats();
  // const activeProjects = projects.filter(p => p.status === "Active");
  // const totalBudget = projects.reduce((sum, p) => sum + p.totalBudget, 0);
  // const avgProgress = projects.length > 0
  //   ? projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
  //   : 0;

  if (loadingProjects) {
    return (
      <div className="flex-1 p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  function ProjectCategoryTitle({ text }: { text: string }) {
    return <h2 className="text-sm text-muted-foreground">{text}</h2>;
  }

  return (
    <div className="flex-1 p-8 space-y-8 container mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage your projects, milestones, and issues
          </p>
        </div>

        <div className="flex gap-2">
          <CopyProjectToText />
          <CreateProjectDialog />
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="p-12 py-36 text-center">
          <CardDescription>
            <FaProjectDiagram className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first project
            </p>
            {/* <CreateProjectDialog /> */}
          </CardDescription>
        </Card>
      ) : (
        <div className="space-y-6">
          <ProjectCategoryTitle text="Active Projects" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects
              .filter((i) => i.status === "Active")
              .map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
          </div>
          <ProjectCategoryTitle text="Scheduled Projects" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects
              .filter((i) => i.status === "Scheduled")
              .map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
          </div>
          <ProjectCategoryTitle text="Closed Projects" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects
              .filter((i) => i.status === "Closed")
              .map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}
