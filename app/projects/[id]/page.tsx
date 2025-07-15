/**
 * Individual Project Page - Comprehensive Project Management Interface
 *
 * This page provides detailed management capabilities for individual projects
 * including project information, milestones, and issues. It serves as the
 * main workspace for project management activities.
 *
 * Features:
 * - Project details editing with markdown support
 * - Milestone management with progress tracking
 * - Issue management within milestones
 * - Real-time progress calculations
 * - Budget tracking and currency display
 * - Responsive layout with organized sections
 *
 * Dependencies:
 * - Project management hook for data operations
 * - UI components for forms and layouts
 * - Markdown editor for project notes
 * - Theme-aware notifications
 *
 * @fileoverview Individual project management interface
 * @author BIT Focus Development Team
 * @since v0.9.0-alpha
 */

"use client";

import { useEffect, useState, type JSX } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast, Toaster } from "sonner";
import {
  FaArrowLeft,
  FaEdit,
  FaPlus,
  FaTrash,
  FaClock,
  FaDollarSign,
  FaFlag,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";
import { MdSchedule, MdPlayArrow, MdCheck } from "react-icons/md";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

import {
  useProjects,
  type Project,
  type Milestone,
  type Issue,
  type MilestoneWithProgress,
  ISSUE_LABELS,
  IssueLabel,
} from "@/hooks/useProjects";
import { useConfig } from "@/hooks/useConfig";
import { cn } from "@/lib/utils";
import StatusBadge from "../StatusBadge";
import Markdown from "react-markdown";

/**
 * Project Header Component
 *
 * Displays project title, status, and basic information with edit capabilities.
 */
function ProjectHeader({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: () => void;
}): JSX.Element {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [status, setStatus] = useState(project.status);
  const [notes, setNotes] = useState(project.notes);
  const [version, setVersion] = useState(project.version);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateProject, deleteProject } = useProjects();

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await updateProject(project.id!, { title, status, notes, version });
      toast.success("Project updated successfully!");
      setIsEditing(false);
      onUpdate();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to update project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this project? This will also delete all milestones and issues."
      )
    ) {
      return;
    }

    try {
      await deleteProject(project.id!);
      toast.success("Project deleted successfully!");
      router.push("/projects");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project title..."
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as Project["status"])}
              >
                <SelectTrigger className="w-40">
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
              <Label>Version</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Project version..."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Project description and notes..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/projects")}
        >
          <FaArrowLeft />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <Badge variant="outline">v{project.version}</Badge>
            <StatusBadge status={project.status} />
            {/* <Badge
              variant={statusConfigs[project.status].variant}
              className="gap-1"
            >
              {statusConfigs[project.status].icon}
              {project.status}
            </Badge> */}
          </div>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <FaEdit />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <FaEdit className="mr-2" />
            Edit Project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-red-600">
            <FaTrash className="mr-2" />
            Delete Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {project.notes &&
    <Card className="p-8">
      <CardDescription className="md">
        <Markdown>{project.notes}</Markdown>
      </CardDescription>
    </Card>
    }
    </>
  );
}

/**
 * Milestone Card Component
 *
 * Displays milestone information with progress and issue management.
 */
function MilestoneCard({
  milestone,
  onUpdate,
}: {
  milestone: MilestoneWithProgress;
  onUpdate: () => void;
}): JSX.Element {
  const { currency } = useConfig();
  const { getIssuesForMilestone, deleteMilestone } = useProjects();
  const [showIssues, setShowIssues] = useState(false);

  const issues = getIssuesForMilestone(milestone.id!);

  const getCurrencySymbol = (curr: string) => {
    switch (curr) {
      case "USD":
        return "$";
      case "AED":
        return "د.إ";
      case "PKR":
        return "₨";
      default:
        return "$";
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this milestone? This will also delete all associated issues."
      )
    ) {
      return;
    }

    try {
      await deleteMilestone(milestone.id!);
      toast.success("Milestone deleted successfully!");
      onUpdate();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to delete milestone");
    }
  };

  const statusConfigs = {
    Scheduled: { icon: <MdSchedule />, variant: "outline" as const },
    Active: { icon: <MdPlayArrow />, variant: "default" as const },
    Closed: { icon: <MdCheck />, variant: "secondary" as const },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{milestone.title}</CardTitle>
            <Badge
              variant={statusConfigs[milestone.status].variant}
              className="gap-1"
            >
              {statusConfigs[milestone.status].icon}
              {milestone.status}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <FaEdit />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <FaEdit className="mr-2" />
                Edit Milestone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <FaTrash className="mr-2" />
                Delete Milestone
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>
              {milestone.progress}% ({milestone.completedIssues}/
              {milestone.totalIssues})
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${milestone.progress}%` }}
            />
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FaClock className="text-muted-foreground" />
            <span>Due {new Date(milestone.deadline).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <FaDollarSign className="text-muted-foreground" />
            <span>
              {getCurrencySymbol(currency)}
              {milestone.budget}
            </span>
          </div>
        </div>

        {/* Issues Toggle */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIssues(!showIssues)}
          >
            {showIssues ? "Hide" : "Show"} Issues ({issues.length})
          </Button>
          <CreateIssueDialog milestoneId={milestone.id!} onUpdate={onUpdate} />
        </div>

        {/* Issues List */}
        {showIssues && (
          <div className="space-y-2 border-t pt-4">
            {issues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No issues yet
              </p>
            ) : (
              issues.map((issue) => (
                <IssueItem key={issue.id} issue={issue} onUpdate={onUpdate} />
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Issue Item Component
 *
 * Displays individual issue with status management.
 */
function IssueItem({
  issue,
  onUpdate,
}: {
  issue: Issue;
  onUpdate: () => void;
}): JSX.Element {
  const { updateIssue, deleteIssue } = useProjects();

  const handleStatusToggle = async () => {
    const newStatus = issue.status === "Open" ? "Close" : "Open";
    try {
      await updateIssue(issue.id!, { status: newStatus });
      onUpdate();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to update issue status");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this issue?")) return;

    try {
      await deleteIssue(issue.id!);
      toast.success("Issue deleted successfully!");
      onUpdate();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to delete issue");
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "font-medium text-sm",
              issue.status === "Close" && "line-through text-muted-foreground"
            )}
          >
            {issue.title}
          </span>
          <Badge variant="outline" className="text-xs">
            {issue.label}
          </Badge>
          {issue.status === "Open" ? (
            <FaExclamationCircle className="text-orange-500 h-3 w-3" />
          ) : (
            <FaCheckCircle className="text-green-500 h-3 w-3" />
          )}
        </div>
        {issue.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {issue.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Due: {new Date(issue.dueDate).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={issue.status === "Open" ? "default" : "outline"}
          onClick={handleStatusToggle}
          className="h-7 px-2 text-xs"
        >
          {issue.status === "Open" ? "Close" : "Reopen"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <FaEdit className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <FaEdit className="mr-2 h-3 w-3" />
              Edit Issue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-red-600">
              <FaTrash className="mr-2 h-3 w-3" />
              Delete Issue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/**
 * Create Milestone Dialog Component
 */
function CreateMilestoneDialog({
  projectId,
  onUpdate,
}: {
  projectId: number;
  onUpdate: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Milestone["status"]>("Scheduled");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addMilestone } = useProjects();

  const handleSubmit = async () => {
    if (!title.trim() || !deadline || !budget) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await addMilestone(
        projectId,
        title.trim(),
        status,
        new Date(deadline),
        parseFloat(budget)
      );
      toast.success("Milestone created successfully!");
      setOpen(false);
      setTitle("");
      setStatus("Scheduled");
      setDeadline("");
      setBudget("");
      onUpdate();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to create milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FaPlus />
          New Milestone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Milestone</DialogTitle>
          <DialogDescription>
            Add a new milestone to track progress within this project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Milestone title..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as Milestone["status"])
                }
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
              <Label htmlFor="deadline">Deadline *</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget">Budget *</Label>
            <Input
              id="budget"
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Milestone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Create Issue Dialog Component
 */
function CreateIssueDialog({
  milestoneId,
  onUpdate,
}: {
  milestoneId: number;
  onUpdate: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [label, setLabel] = useState<IssueLabel>(ISSUE_LABELS[0]);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addIssue } = useProjects();

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate) {
      toast.error("Please fill in title and due date");
      return;
    }

    setIsSubmitting(true);
    try {
      await addIssue(
        milestoneId,
        title.trim(),
        label,
        new Date(dueDate),
        description.trim()
      );
      toast.success("Issue created successfully!");
      setOpen(false);
      setTitle("");
      setLabel(ISSUE_LABELS[0]);
      setDueDate("");
      setDescription("");
      onUpdate();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to create issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <FaPlus className="h-3 w-3" />
          Add Issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>
            Add a new issue to track within this milestone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Select
                value={label}
                onValueChange={(value) => setLabel(value as IssueLabel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_LABELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Issue description..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main Project Detail Page Component
 */
export default function ProjectDetailPage(): JSX.Element {
  const { theme } = useTheme();
  const params = useParams();
  const projectId = parseInt(params.id as string);

  const { getProjectWithStats, loadProjects, loadingProjects } = useProjects();

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, refreshKey]);

  const project = getProjectWithStats(projectId);

  const handleUpdate = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (loadingProjects) {
    return (
      <div className="flex-1 p-8 space-y-8">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The project you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 space-y-8">
      {/* Project Header */}
      <ProjectHeader project={project} onUpdate={handleUpdate} />

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">%</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.progress}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Milestones</CardTitle>
            <FaFlag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.milestones.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.milestones.filter((m) => m.status === "Active").length}{" "}
              active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <FaDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.totalBudget}</div>
            <p className="text-xs text-muted-foreground">
              Across all milestones
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Milestones Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Milestones</h2>
            <p className="text-sm text-muted-foreground">
              Track progress with milestones and issues
            </p>
          </div>
          <CreateMilestoneDialog
            projectId={projectId}
            onUpdate={handleUpdate}
          />
        </div>

        {project.milestones.length === 0 ? (
          <Card className="p-12 text-center">
            <CardDescription>
              <FaFlag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No milestones yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first milestone to start tracking progress
              </p>
            </CardDescription>
          </Card>
        ) : (
          <div className="space-y-4">
            {project.milestones.map((milestone) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}
