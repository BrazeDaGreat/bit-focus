/* eslint-disable @typescript-eslint/no-explicit-any */

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
 * - Navigation to individual project details with prefetching
 * - Responsive grid layout for project cards
 * - Real-time progress calculations
 *
 * Dependencies:
 * - Project management hook for data operations
 * - UI components for consistent styling
 * - Navigation system for project details
 * - Theme-aware toast notifications
 *
 * @fileoverview Main project management page interface with optimized navigation
 * @author BIT Focus Development Team
 * @since v0.9.0-alpha
 */

"use client";

import { useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
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
import { cn, formatNumber, getCurrencySymbol, setClipboard } from "@/lib/utils";
import { FaClipboard } from "react-icons/fa6";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Project Card Component with Optimized Navigation
 *
 * Renders an individual project card with statistics, progress, and instant navigation.
 * Uses Next.js Link component for route prefetching and optimized transitions.
 *
 * @param {Object} props - Component props
 * @param {ProjectWithStats} props.project - Project data with statistics
 * @returns {JSX.Element} Project card component with prefetch navigation
 */
function ProjectCard({ project }: { project: any }): JSX.Element {
  const { currency } = useConfig();

  return (
    <Link 
      href={`/projects/${project.id}`}
      prefetch={true}
      className="block"
    >
      <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
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
    </Link>
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

  /**
   * Handles form submission for creating a new project
   * 
   * @async
   * @returns {Promise<void>}
   */
  const handleSubmit = async (): Promise<void> => {
    if (!title.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    setIsSubmitting(true);
    try {
      await addProject(title.trim(), status, version.trim(), notes.trim());
      toast.success("Project created successfully!");
      setOpen(false);
      // Reset form
      setTitle("");
      setStatus("Scheduled");
      setNotes("");
      setVersion("1.0.0");
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
        <Button>
          <FaPlus className="mr-2" />
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Copy Projects to Text Component
 * 
 * Generates and copies a formatted text summary of project earnings
 * 
 * @returns {JSX.Element} Copy button component
 */
function CopyProjectToText(): JSX.Element {
  const { getAllProjectsWithStats } = useProjects();
  const projects = getAllProjectsWithStats();

  /**
   * Gets emoji indicator based on milestone status
   * 
   * @param {string} text - Status text
   * @returns {string} Emoji indicator
   */
  function getEmojiByStatus(text: "Scheduled" | "Active" | "Closed" | "Paid"): string {
    if (text === "Scheduled") return "";
    if (text === "Active") return "‼️";
    if (text === "Closed") return "❓";
    if (text === "Paid") return "✅";
    return "";
  }

  /**
   * Handles copying project earnings summary to clipboard
   * 
   * @async
   * @returns {Promise<void>}
   */
  async function handleClick(): Promise<void> {
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

  return (
    <Button onClick={handleClick}>
      <FaClipboard />
      <span>Copy Earnings</span>
    </Button>
  );
}

/**
 * Main Projects Page Component
 *
 * Renders the complete projects management interface with overview statistics
 * and project listing capabilities with optimized navigation.
 *
 * @returns {JSX.Element} Complete projects page interface
 */
export default function ProjectsPage(): JSX.Element {
  const { theme } = useTheme();
  const { getAllProjectsWithStats, loadProjects } = useProjects();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const projects = getAllProjectsWithStats();

  /**
   * Renders project category title
   * 
   * @param {Object} props - Component props
   * @param {string} props.text - Category title text
   * @returns {JSX.Element} Category title element
   */
  function ProjectCategoryTitle({ text }: { text: string }): JSX.Element {
    return <h2 className="text-sm text-muted-foreground">{text}</h2>;
  }

  return (
    <div className="flex-1 p-8 space-y-8 container mx-auto">
      {/* Header */}
      <div className={cn("flex items-center justify-between", isMobile ? "flex-col gap-2" : "")}>
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