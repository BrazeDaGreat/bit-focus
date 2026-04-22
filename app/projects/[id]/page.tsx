"use client";

import { useEffect, useState, type JSX } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  FaEdit,
  FaPlus,
  FaTrash,
  FaFlag,
  FaStickyNote,
  FaChevronUp,
  FaChevronDown,
  FaChevronRight,
  FaCheck,
} from "react-icons/fa";

import { Button } from "@/components/ui/button";
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
  type ProjectWithStats,
  ISSUE_LABELS,
  IssueLabel,
} from "@/hooks/useProjects";
import { useConfig } from "@/hooks/useConfig";
import { cn, formatDate, formatNumber, getCurrencySymbol } from "@/lib/utils";
import StatusBadge from "../StatusBadge";
import Markdown from "react-markdown";
import {
  FaLink,
  FaRegCircle,
  FaRegCircleCheck,
  FaX,
  FaEllipsis,
} from "react-icons/fa6";
import getIconFromLink from "@/lib/getIconFromLink";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Dialog / Drawer Components (functional, kept from original)
// ---------------------------------------------------------------------------

function ProjectEditDialog({ project }: { project: Project }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [status, setStatus] = useState(project.status);
  const [version, setVersion] = useState(project.version);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateProject } = useProjects();

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateProject(project.id!, { title: title.trim(), status, version: version.trim() });
      toast.success("Project updated!");
      setIsOpen(false);
    } catch {
      toast.error("Failed to update project");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <FaEdit className="mr-2 h-3 w-3" />
          Edit Project
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update title, status, and version.</DialogDescription>
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
                placeholder="Version..."
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
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

function ProjectNotesDrawer({ project }: { project: Project }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(project.notes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateProject } = useProjects();

  const handleSaveNotes = async () => {
    setIsSubmitting(true);
    try {
      await updateProject(project.id!, { notes: notes.trim() });
      toast.success("Notes updated!");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update notes");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setNotes(project.notes);
      setIsEditing(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <FaStickyNote className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Notes</span>
          {project.notes && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg px-4 py-6">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between pr-6">
            <span>Project Notes</span>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1">
                <FaEdit className="h-3 w-3" />
                Edit
              </Button>
            )}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? "Edit notes (Markdown supported)." : "View project notes."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 py-6 overflow-y-auto">
          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter project notes... Markdown supported."
                rows={15}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveNotes} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Saving..." : "Save Notes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setNotes(project.notes); setIsEditing(false); }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              {project.notes ? (
                <Markdown>{project.notes}</Markdown>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <FaStickyNote className="mx-auto h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">No notes yet</p>
                  <p className="text-xs">Click Edit to add project notes</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreateMilestoneDialog({ projectId }: { projectId: number }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Milestone["status"]>("Scheduled");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addMilestone } = useProjects();

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
      toast.success("Milestone created!");
      setOpen(false);
      setTitle("");
      setStatus("Scheduled");
      setDeadline("");
      setBudget("");
    } catch {
      toast.error("Failed to create milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 w-full border-dashed">
          <FaPlus className="h-3 w-3" />
          Add Milestone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Milestone</DialogTitle>
          <DialogDescription>Add a milestone to track progress.</DialogDescription>
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
                onValueChange={(value) => setStatus(value as Milestone["status"])}
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

function CreateIssueDialog({ milestoneId }: { milestoneId: number }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [label, setLabel] = useState<IssueLabel>(ISSUE_LABELS[0]);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addIssue } = useProjects();

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
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
      toast.success("Issue created!");
      setOpen(false);
      setTitle("");
      setLabel(ISSUE_LABELS[0]);
      setDueDate("");
      setDescription("");
    } catch {
      toast.error("Failed to create issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
        >
          <FaPlus className="h-3 w-3" />
          Add Issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>Add a new issue to this milestone.</DialogDescription>
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
              <Select value={label} onValueChange={(value) => setLabel(value as IssueLabel)}>
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
        dueDate: dueDate ? new Date(dueDate) : undefined,
      };
      await updateIssue(issue.id!, updateData);
      toast.success("Issue updated!");
      setIsOpen(false);
    } catch {
      toast.error("Failed to update issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTitle(issue.title);
      setLabel(issue.label as IssueLabel);
      setDueDate(issue.dueDate ? issue.dueDate.toISOString().split("T")[0] : "");
      setDescription(issue.description);
      setStatus(issue.status);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit issue">
          <FaEdit className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Issue</DialogTitle>
          <DialogDescription>Update issue details.</DialogDescription>
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
              <Select value={label} onValueChange={(value) => setLabel(value as IssueLabel)}>
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
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
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

function EditMilestoneDialog({ milestone }: { milestone: MilestoneWithProgress }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [status, setStatus] = useState(milestone.status);
  const [deadline, setDeadline] = useState(
    milestone.deadline ? milestone.deadline.toISOString().split("T")[0] : ""
  );
  const [budget, setBudget] = useState(milestone.budget.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateMilestone } = useProjects();

  const handleSave = async () => {
    if (!title.trim() || !budget) {
      toast.error("Please fill in title and budget");
      return;
    }
    const budgetValue = parseFloat(budget);
    if (isNaN(budgetValue) || budgetValue < 0) {
      toast.error("Enter a valid budget");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateMilestone(milestone.id!, {
        title: title.trim(),
        status,
        budget: budgetValue,
        deadline: deadline ? new Date(deadline) : undefined,
      });
      toast.success("Milestone updated!");
      setIsOpen(false);
    } catch {
      toast.error("Failed to update milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <FaEdit className="mr-2 h-3 w-3" />
          Edit Milestone
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Milestone</DialogTitle>
          <DialogDescription>Update milestone details.</DialogDescription>
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
                onValueChange={(value) => setStatus(value as Milestone["status"])}
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
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
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

function AddQuickLinkDialog({ projectId }: { projectId: number }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addQuickLink } = useProjects();

  const handleSave = async () => {
    if (!url.trim() || !title.trim()) {
      toast.error("Please fill in both URL and title");
      return;
    }
    setIsSubmitting(true);
    try {
      await addQuickLink(projectId, { url, title, id: title });
      toast.success("Quick link added!");
      setIsOpen(false);
      setUrl("");
      setTitle("");
    } catch {
      toast.error("Failed to add quick link");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" title="Add Quick Link">
          <FaLink className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Quick Link</DialogTitle>
          <DialogDescription>Add a quick link to this project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quick-link-url">URL *</Label>
            <Input
              id="quick-link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-link-title">Title *</Label>
            <Input
              id="quick-link-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Link title"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Add Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Issue Row — inline issue item for milestone accordion
// ---------------------------------------------------------------------------

function IssueRow({ issue }: { issue: Issue }): JSX.Element {
  const { updateIssue, deleteIssue } = useProjects();
  const [showDesc, setShowDesc] = useState(false);

  const toggleStatus = async () => {
    const newStatus = issue.status === "Open" ? "Close" : "Open";
    try {
      await updateIssue(issue.id!, { status: newStatus });
    } catch {
      toast.error("Failed to update issue");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this issue?")) return;
    try {
      await deleteIssue(issue.id!);
      toast.success("Issue deleted");
    } catch {
      toast.error("Failed to delete issue");
    }
  };

  return (
    <div className={cn("group", issue.status === "Close" && "opacity-50")}>
      <div className="flex items-center gap-3 py-2 border-b border-dashed last:border-0">
        <button
          onClick={toggleStatus}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title={issue.status === "Open" ? "Mark done" : "Reopen"}
        >
          {issue.status === "Open" ? (
            <FaRegCircle className="h-3.5 w-3.5" />
          ) : (
            <FaRegCircleCheck className="h-3.5 w-3.5" />
          )}
        </button>

        <span
          className={cn(
            "text-sm flex-1 min-w-0 truncate",
            issue.status === "Close" && "line-through text-muted-foreground"
          )}
        >
          {issue.title}
        </span>

        <span className="text-xs px-1.5 py-0.5 rounded-full border text-muted-foreground flex-shrink-0 hidden sm:inline-flex">
          {issue.label}
        </span>

        {issue.dueDate && (
          <span className="text-xs font-mono text-muted-foreground flex-shrink-0 hidden sm:inline">
            {formatDate(issue.dueDate)}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {issue.description && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowDesc(!showDesc)}
              title={showDesc ? "Hide description" : "Show description"}
            >
              {showDesc ? (
                <FaChevronUp className="h-3 w-3" />
              ) : (
                <FaChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
          <EditIssueDialog issue={issue} />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            title="Delete issue"
          >
            <FaTrash className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {showDesc && issue.description && (
        <p className="text-xs text-muted-foreground pl-7 pb-2 pr-2 leading-relaxed">
          {issue.description}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Milestone Accordion Row
// ---------------------------------------------------------------------------

function MilestoneAccordion({
  milestone,
  isExpanded,
  onToggle,
}: {
  milestone: MilestoneWithProgress;
  isExpanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const { getIssuesForMilestone, deleteMilestone } = useProjects();
  const issues = getIssuesForMilestone(milestone.id!);

  const statusStyles: Record<Milestone["status"], string> = {
    Scheduled: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
    Active: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    Closed: "text-muted-foreground bg-muted",
    Paid: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
  };

  const handleDelete = async () => {
    if (!confirm("Delete this milestone and all its issues?")) return;
    try {
      await deleteMilestone(milestone.id!);
      toast.success("Milestone deleted");
    } catch {
      toast.error("Failed to delete milestone");
    }
  };

  return (
    <div className="border-b last:border-b-0">
      {/* Accordion header */}
      <div
        className="flex items-center gap-3 py-3 px-4 cursor-pointer hover:bg-accent/30 transition-colors group"
        onClick={onToggle}
      >
        <span className="text-muted-foreground flex-shrink-0 w-3">
          {isExpanded ? (
            <FaChevronDown className="h-3 w-3" />
          ) : (
            <FaChevronRight className="h-3 w-3" />
          )}
        </span>

        <span className="text-sm font-semibold flex-1 min-w-0 truncate">
          {milestone.title}
        </span>

        <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">
          {milestone.completedIssues}/{milestone.totalIssues}
        </span>

        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${milestone.progress}%` }}
          />
        </div>

        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline",
            statusStyles[milestone.status]
          )}
        >
          {milestone.status}
        </span>

        <div
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Milestone actions"
              >
                <FaEllipsis className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <EditMilestoneDialog milestone={milestone} />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <FaTrash className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded issues */}
      {isExpanded && (
        <div className="pl-10 pr-4 pb-3">
          {issues.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No issues yet</p>
          ) : (
            <div>
              {issues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </div>
          )}
          <div className="pt-2">
            <CreateIssueDialog milestoneId={milestone.id!} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProjectDetailPage(): JSX.Element {
  const { theme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const projectId = parseInt(params.id as string);
  const [linkDelMode, setLinkDelMode] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(new Set());

  const { getProjectWithStats, loadingProjects, deleteQuickLink, loadProjects, deleteProject } =
    useProjects();
  const { currency } = useConfig();

  useEffect(() => {
    const load = async () => {
      if (!dataLoaded) {
        await loadProjects();
        setDataLoaded(true);
      }
    };
    load();
  }, [loadProjects, dataLoaded]);

  const project = getProjectWithStats(projectId) as ProjectWithStats | undefined;

  if (!dataLoaded || loadingProjects) {
    return (
      <div className="flex-1 p-6 md:p-8 space-y-6 max-w-screen-xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Project Not Found</h1>
          <p className="text-sm text-muted-foreground mb-4">
            The project you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href="/projects" prefetch={true}>
            <Button>Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const completedMilestones = project.milestones.filter(
    (m) => m.status === "Closed" || m.status === "Paid"
  ).length;

  const toggleMilestone = (id: number) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteProject = async () => {
    if (
      !confirm(
        "Delete this project and all its milestones and issues? This cannot be undone."
      )
    )
      return;
    try {
      await deleteProject(project.id!);
      router.push("/projects");
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 container mx-auto">
      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between mb-6">
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold truncate max-w-[200px] sm:max-w-none">
            {project.title}
          </span>
        </nav>

        <div className="flex items-center gap-1">
          <ProjectNotesDrawer project={project} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <FaEdit className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ProjectEditDialog project={project} />
              <DropdownMenuItem
                onClick={handleDeleteProject}
                className="text-destructive focus:text-destructive"
              >
                <FaTrash className="mr-2 h-3 w-3" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Project Meta Strip */}
      <div className="flex items-center gap-4 md:gap-6 py-3 border-b border-t text-sm flex-wrap mb-6">
        <StatusBadge status={project.status} />
        <span className="font-mono text-muted-foreground text-xs">v{project.version}</span>
        {project.totalBudget > 0 && (
          <span className="text-muted-foreground text-xs">
            {getCurrencySymbol(currency)}{formatNumber(project.totalBudget)} total
          </span>
        )}
        <span className="text-muted-foreground text-xs">
          {completedMilestones}/{project.milestones.length} milestones done
        </span>
        <span className="text-muted-foreground text-xs font-mono">{project.progress}%</span>
      </div>

      {/* Quick Links Row */}
      <div className="flex items-center gap-2 py-3 border-b mb-8 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mr-1">
          Links
        </span>
        {project.quickLinks?.map((link) => (
          <Button
            key={link.url}
            variant="outline"
            size="icon"
            className={cn(
              "h-8 w-8 relative",
              linkDelMode && "border-destructive/40"
            )}
            onClick={() => {
              if (linkDelMode) {
                deleteQuickLink(projectId, link.title);
                toast.success("Quick link deleted");
              } else {
                window.open(link.url, "_blank");
              }
            }}
            title={linkDelMode ? `Delete ${link.title}` : link.title}
          >
            {linkDelMode && (
              <div className="w-3 h-3 bg-destructive absolute -top-1 -right-1 rounded-full flex items-center justify-center pointer-events-none">
                <FaX className="!w-2 !h-2 text-white" />
              </div>
            )}
            {getIconFromLink(link.url)}
          </Button>
        ))}
        <AddQuickLinkDialog projectId={projectId} />
        {project.quickLinks && project.quickLinks.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", linkDelMode && "text-destructive")}
            onClick={() => setLinkDelMode(!linkDelMode)}
            title={linkDelMode ? "Done" : "Remove links"}
          >
            {linkDelMode ? (
              <FaCheck className="h-3.5 w-3.5" />
            ) : (
              <FaTrash className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Milestones */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Milestones
          </h2>
          {project.milestones.length > 1 && (
            <button
              onClick={() => {
                const allIds = project.milestones.map((m) => m.id!);
                const allExpanded = allIds.every((id) => expandedMilestones.has(id));
                if (allExpanded) {
                  setExpandedMilestones(new Set());
                } else {
                  setExpandedMilestones(new Set(allIds));
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {project.milestones.every((m) => expandedMilestones.has(m.id!))
                ? "Collapse all"
                : "Expand all"}
            </button>
          )}
        </div>

        {project.milestones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FaFlag className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <h3 className="text-sm font-semibold mb-1">No milestones yet</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first milestone to start tracking progress
            </p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            {project.milestones.map((milestone) => (
              <MilestoneAccordion
                key={milestone.id}
                milestone={milestone}
                isExpanded={expandedMilestones.has(milestone.id!)}
                onToggle={() => toggleMilestone(milestone.id!)}
              />
            ))}
          </div>
        )}

        <div className="mt-4">
          <CreateMilestoneDialog projectId={projectId} />
        </div>
      </div>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}
