/**
 * Individual Project Page - Comprehensive Project Management Interface
 *
 * This page provides detailed management capabilities for individual projects
 * including project information, milestones, and issues. Features separate
 * dialog for project editing and drawer for notes management.
 *
 * Features:
 * - Project details editing via dialog (title, status, version)
 * - Notes management via right-side drawer with markdown support
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
 * @fileoverview Individual project management interface with enhanced editing
 * @author BIT Focus Development Team
 * @since v0.9.0-alpha
 * @updated v0.9.4-alpha - Fixed state management and dialog issues
 */

"use client";

import { useState, type JSX } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast, Toaster } from "sonner";
import { GoDotFill } from "react-icons/go";
import {
  FaArrowLeft,
  FaEdit,
  FaPlus,
  FaTrash,
  FaClock,
  FaDollarSign,
  FaFlag,
  FaExclamationCircle,
  FaStickyNote,
  FaChevronUp,
  FaChevronDown,
} from "react-icons/fa";
import { MdSchedule, MdPlayArrow, MdCheck, MdMoney } from "react-icons/md";

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { cn, formatDate, formatNumber, getCurrencySymbol } from "@/lib/utils";
import StatusBadge from "../StatusBadge";
import Markdown from "react-markdown";
import { FaCalendar, FaRegCircle, FaRegCircleCheck } from "react-icons/fa6";

/**
 * Project Edit Dialog Component
 *
 * Provides a modal interface for editing project title, status, and version.
 * Separated from notes editing for better UX and focused editing experience.
 *
 * @param {Object} props - Component props
 * @param {Project} props.project - Project data to edit
 * @returns {JSX.Element} Project edit dialog
 */
function ProjectEditDialog({ project }: { project: Project }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [status, setStatus] = useState(project.status);
  const [version, setVersion] = useState(project.version);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateProject } = useProjects();

  /**
   * Handles form submission for project updates
   * Updates title, status, and version only
   */
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProject(project.id!, {
        title: title.trim(),
        status,
        version: version.trim(),
      });
      toast.success("Project updated successfully!");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update project:", error);
      toast.error("Failed to update project");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Resets form to original values when dialog opens
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTitle(project.title);
      setStatus(project.status);
      setVersion(project.version);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <FaEdit className="mr-2" />
          Edit Project
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update the project title, status, and version.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Project Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
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
              <Label htmlFor="edit-version">Version</Label>
              <Input
                id="edit-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Project version..."
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Project Notes Drawer Component
 *
 * Provides a right-side drawer for viewing and editing project notes
 * with markdown support and dedicated editing interface.
 *
 * @param {Object} props - Component props
 * @param {Project} props.project - Project data containing notes
 * @returns {JSX.Element} Project notes drawer
 */
function ProjectNotesDrawer({ project }: { project: Project }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(project.notes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateProject } = useProjects();

  /**
   * Handles saving updated notes
   */
  const handleSaveNotes = async () => {
    setIsSubmitting(true);
    try {
      await updateProject(project.id!, { notes: notes.trim() });
      toast.success("Notes updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update notes:", error);
      toast.error("Failed to update notes");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles drawer state changes and resets editing mode
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setNotes(project.notes);
      setIsEditing(false);
    }
  };

  /**
   * Cancels editing and reverts to original notes
   */
  const handleCancelEdit = () => {
    setNotes(project.notes);
    setIsEditing(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FaStickyNote />
          Project Notes
          {project.notes && (
            <Badge variant="secondary" className="ml-1">
              ●
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg px-2 py-6">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Project Notes</span>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1"
              >
                <FaEdit className="h-3 w-3" />
                Edit
              </Button>
            )}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Edit your project notes with markdown support."
              : "View project notes and documentation."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 py-6 overflow-y-auto">
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes-textarea">
                  Notes (Markdown supported)
                </Label>
                <Textarea
                  id="notes-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter your project notes here... You can use markdown formatting."
                  rows={15}
                  className="resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveNotes}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? "Saving..." : "Save Notes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              {project.notes ? (
                <div className="md">
                  <Markdown>{project.notes}</Markdown>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <FaStickyNote className="mx-auto h-12 w-12 mb-4 opacity-30" />
                  <p>No notes yet</p>
                  <p className="text-sm">Click Edit to add project notes</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Project Header Component
 *
 * Displays project title, status, and basic information with separated
 * edit controls for project details and notes management.
 *
 * @param {Object} props - Component props
 * @param {Project} props.project - Project data to display
 * @returns {JSX.Element} Project header with action controls
 */
function ProjectHeader({ project }: { project: Project }): JSX.Element {
  const router = useRouter();
  const { deleteProject } = useProjects();

  /**
   * Handles project deletion with confirmation
   */
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
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="space-y-6">
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
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProjectNotesDrawer project={project} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <FaEdit />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <ProjectEditDialog project={project} />
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <FaTrash className="mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

/**
 * Milestone Card Component
 *
 * Displays milestone information with progress and issue management.
 *
 * @param {Object} props - Component props
 * @param {MilestoneWithProgress} props.milestone - Milestone data with progress
 * @returns {JSX.Element} Milestone card with management controls
 */
function MilestoneCard({
  milestone,
}: {
  milestone: MilestoneWithProgress;
}): JSX.Element {
  const { currency } = useConfig();
  const { deleteMilestone } = useProjects();

  /**
   * Handles milestone deletion with confirmation
   */
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
    } catch (error) {
      console.error("Failed to delete milestone:", error);
      toast.error("Failed to delete milestone");
    }
  };

  const statusConfigs = {
    Scheduled: { icon: <MdSchedule />, variant: "outline" as const },
    Active: { icon: <MdPlayArrow />, variant: "default" as const },
    Closed: { icon: <MdCheck />, variant: "secondary" as const },
    Paid: { icon: <MdMoney />, variant: "default" as const },
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
              <EditMilestoneDialog milestone={milestone} />
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <FaTrash className="mr-2" />
                Delete Milestone
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            {getCurrencySymbol(currency)}
            <span>{formatNumber(milestone.budget)}</span>
          </div>
          <div className="flex items-center gap-2">
            <FaClock className="text-muted-foreground" />
            <span>
              {milestone.deadline
                ? `Due ${formatDate(milestone.deadline)}`
                : "No deadline"}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>
              {milestone.progress}% ({milestone.completedIssues}/
              {milestone.totalIssues})
            </span>
          </div>
          <div className="w-full bg-accent rounded-full h-2">
            <div
              className="bg-accent-foreground h-2 rounded-full transition-all"
              style={{ width: `${milestone.progress}%` }}
            />
          </div>
        </div>

        {/* Issues Toggle */}
        <div className="flex items-center justify-between">
          <IssuesDrawer milestone={milestone} />
          <CreateIssueDialog milestoneId={milestone.id!} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Issue Item Component
 *
 * Displays individual issue with status management and actions.
 *
 * @param {Object} props - Component props
 * @param {Issue} props.issue - Issue data to display
 * @returns {JSX.Element} Issue item with management controls
 */
function IssueItem({ issue }: { issue: Issue }): JSX.Element {
  const { updateIssue, deleteIssue } = useProjects();
  const [showDescription, setShowDescription] = useState(false);

  /**
   * Toggles issue status between Open and Close
   */
  const handleStatusToggle = async () => {
    const newStatus = issue.status === "Open" ? "Close" : "Open";
    try {
      await updateIssue(issue.id!, { status: newStatus });
    } catch (error) {
      console.error("Failed to update issue status:", error);
      toast.error("Failed to update issue status");
    }
  };

  /**
   * Handles issue deletion with confirmation
   */
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this issue?")) return;

    try {
      await deleteIssue(issue.id!);
      toast.success("Issue deleted successfully!");
    } catch (error) {
      console.error("Failed to delete issue:", error);
      toast.error("Failed to delete issue");
    }
  };

  return (
    <div className={cn("flex flex-col justify-between p-3 border rounded-md", issue.status==="Close" && "opacity-60")}>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleStatusToggle}>
          {issue.status === "Open" ? <FaRegCircle /> : <FaRegCircleCheck />}
        </Button>
        <span
          className={cn(
            "font-semibold",
            issue.status === "Close" && "line-through text-muted-foreground"
          )}
        >
          {issue.title}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 pl-2.25 opacity-80">
          {issue.dueDate && (
            <>
              <FaCalendar />
              <span>{formatDate(issue.dueDate)}</span>
              <div className="w-2"></div>
              <GoDotFill className="w-2 h-2 opacity-60" />
              <div className="w-2"></div>
            </>
          )}
          <Badge variant="outline" className="text-xs">
            {issue.label}
          </Badge>
        </div>
        <div className="flex gap-1">
          {issue.description && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowDescription(!showDescription);
              }}
            >
              {showDescription ? <FaChevronUp /> : <FaChevronDown />}
            </Button>
          )}
          <EditIssueDialog issue={issue} />
          <Button onClick={handleDelete} variant="ghost" size="icon">
            <FaTrash />
          </Button>
        </div>
      </div>
      <div className={cn("transition-all overflow-hidden text-muted-foreground", showDescription ? "max-h-20 py-2" : "max-h-0 py-0")}>
        {issue.description}
      </div>
    </div>
  );
}

/**
 * Create Milestone Dialog Component
 *
 * Provides a modal interface for creating new milestones within a project.
 *
 * @param {Object} props - Component props
 * @param {number} props.projectId - ID of the parent project
 * @returns {JSX.Element} Milestone creation dialog
 */
function CreateMilestoneDialog({
  projectId,
}: {
  projectId: number;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Milestone["status"]>("Scheduled");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addMilestone } = useProjects();

  /**
   * Handles milestone creation form submission
   */
  const handleSubmit = async () => {
    if (!title.trim() || !budget) {
      toast.error("Please fill in title and budget");
      return;
    }

    setIsSubmitting(true);
    try {
      await addMilestone(
        projectId,
        title.trim(),
        status,
        deadline ? new Date(deadline) : undefined,
        parseFloat(budget)
      );
      toast.success("Milestone created successfully!");
      setOpen(false);
      setTitle("");
      setStatus("Scheduled");
      setDeadline("");
      setBudget("");
    } catch (error) {
      console.error("Failed to create milestone:", error);
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
            <Label htmlFor="milestone-title">Title *</Label>
            <Input
              id="milestone-title"
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
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-deadline">Deadline</Label>
              <Input
                id="milestone-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone-budget">Budget *</Label>
            <Input
              id="milestone-budget"
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
 *
 * Provides a modal interface for creating new issues within a milestone.
 *
 * @param {Object} props - Component props
 * @param {number} props.milestoneId - ID of the parent milestone
 * @returns {JSX.Element} Issue creation dialog
 */
function CreateIssueDialog({
  milestoneId,
}: {
  milestoneId: number;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [label, setLabel] = useState<IssueLabel>(ISSUE_LABELS[0]);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addIssue } = useProjects();

  /**
   * Handles issue creation form submission
   */
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please fill in the title");
      return;
    }

    setIsSubmitting(true);
    try {
      await addIssue(
        milestoneId,
        title.trim(),
        label,
        dueDate ? new Date(dueDate) : undefined,
        description.trim()
      );
      toast.success("Issue created successfully!");
      setOpen(false);
      setTitle("");
      setLabel(ISSUE_LABELS[0]);
      setDueDate("");
      setDescription("");
    } catch (error) {
      console.error("Failed to create issue:", error);
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
            <Label htmlFor="issue-title">Title *</Label>
            <Input
              id="issue-title"
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
              <Label htmlFor="issue-dueDate">Due Date</Label>
              <Input
                id="issue-dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue-description">Description</Label>
            <Textarea
              id="issue-description"
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
 *
 * Renders the complete project management interface with reactive
 * state management that doesn't cause unnecessary re-renders.
 *
 * @returns {JSX.Element} Complete project detail page
 */
export default function ProjectDetailPage(): JSX.Element {
  const { theme } = useTheme();
  const params = useParams();
  const projectId = parseInt(params.id as string);

  const { getProjectWithStats, loadingProjects } = useProjects();

  const project = getProjectWithStats(projectId);

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
      <ProjectHeader project={project} />

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">%</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.progress}%</div>
            <div className="w-full bg-accent rounded-full h-2 mt-2">
              <div
                className="bg-accent-foreground h-2 rounded-full transition-all"
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
            <div className="text-2xl font-bold">
              {formatNumber(project.totalBudget)}
            </div>
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
          <CreateMilestoneDialog projectId={projectId} />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {project.milestones.map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

/**
 * Issues Drawer Component
 *
 * Provides a right-side drawer for viewing and managing issues within a milestone.
 * Displays all issues with their status, labels, and management controls.
 */
function IssuesDrawer({
  milestone,
}: {
  milestone: MilestoneWithProgress;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const { getIssuesForMilestone } = useProjects();
  const issues = getIssuesForMilestone(milestone.id!);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          {issues.length === 0 ? "No Issues" : `Show Issues (${issues.length})`}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl px-2 py-6">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Issues - {milestone.title}</span>
            <CreateIssueDialog milestoneId={milestone.id!} />
          </SheetTitle>
          <SheetDescription>
            Manage issues within this milestone. Track progress and completion
            status.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 py-6 overflow-y-auto">
          {issues.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <FaExclamationCircle className="mx-auto h-12 w-12 mb-4 opacity-30" />
              <p>No issues yet</p>
              <p className="text-sm">
                Create your first issue to start tracking tasks
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => (
                <IssueItem key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Edit Issue Dialog Component
 *
 * Provides a modal interface for editing existing issues.
 * Allows modification of title, label, due date, description, and status.
 */
function EditIssueDialog({ issue }: { issue: Issue }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [label, setLabel] = useState<IssueLabel>(issue.label as IssueLabel);
  const [dueDate, setDueDate] = useState(
    issue.dueDate ? issue.dueDate.toISOString().split("T")[0] : ""
  );
  const [description, setDescription] = useState(issue.description);
  const [status, setStatus] = useState(issue.status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateIssue } = useProjects();

  /**
   * Handles form submission for issue updates
   */
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: Partial<Issue> = {
        title: title.trim(),
        label,
        description: description.trim(),
        status,
      };

      if (dueDate) {
        updateData.dueDate = new Date(dueDate);
      } else {
        updateData.dueDate = undefined;
      }

      await updateIssue(issue.id!, updateData);
      toast.success("Issue updated successfully!");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update issue:", error);
      toast.error("Failed to update issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Resets form to original values when dialog opens
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTitle(issue.title);
      setLabel(issue.label as IssueLabel);
      setDueDate(
        issue.dueDate ? issue.dueDate.toISOString().split("T")[0] : ""
      );
      setDescription(issue.description);
      setStatus(issue.status);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          onSelect={(e) => e.preventDefault()}
          variant="ghost"
          size="icon"
        >
          <FaEdit />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Issue</DialogTitle>
          <DialogDescription>
            Update the issue details and tracking information.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-issue-title">Title *</Label>
            <Input
              id="edit-issue-title"
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
              <Label htmlFor="edit-issue-dueDate">Due Date</Label>
              <Input
                id="edit-issue-dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as Issue["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Close">Close</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-issue-description">Description</Label>
            <Textarea
              id="edit-issue-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Issue description..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Edit Milestone Dialog Component
 *
 * Provides a modal interface for editing existing milestones.
 * Allows modification of title, status, deadline, and budget.
 */
function EditMilestoneDialog({
  milestone,
}: {
  milestone: MilestoneWithProgress;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [status, setStatus] = useState(milestone.status);
  const [deadline, setDeadline] = useState(
    milestone.deadline ? milestone.deadline.toISOString().split("T")[0] : ""
  );
  const [budget, setBudget] = useState(milestone.budget.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateMilestone } = useProjects();

  /**
   * Handles form submission for milestone updates
   */
  const handleSave = async () => {
    if (!title.trim() || !budget) {
      toast.error("Please fill in title and budget");
      return;
    }

    const budgetValue = parseFloat(budget);
    if (isNaN(budgetValue) || budgetValue < 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: Partial<Milestone> = {
        title: title.trim(),
        status,
        budget: budgetValue,
      };

      if (deadline) {
        updateData.deadline = new Date(deadline);
      } else {
        updateData.deadline = undefined;
      }

      await updateMilestone(milestone.id!, updateData);
      toast.success("Milestone updated successfully!");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update milestone:", error);
      toast.error("Failed to update milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Resets form to original values when dialog opens
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTitle(milestone.title);
      setStatus(milestone.status);
      setDeadline(
        milestone.deadline ? milestone.deadline.toISOString().split("T")[0] : ""
      );
      setBudget(milestone.budget.toString());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <FaEdit className="mr-2" />
          Edit Milestone
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Milestone</DialogTitle>
          <DialogDescription>
            Update the milestone details and tracking information.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-milestone-title">Title *</Label>
            <Input
              id="edit-milestone-title"
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
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-milestone-deadline">Deadline</Label>
              <Input
                id="edit-milestone-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-milestone-budget">Budget *</Label>
            <Input
              id="edit-milestone-budget"
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
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
