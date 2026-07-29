/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { FaEdit, FaPlus, FaProjectDiagram } from "react-icons/fa";

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

type SemVerRelease = "major" | "minor" | "patch";

interface ParsedSemVer {
  major: string;
  minor: string;
  patch: string;
  hasPrerelease: boolean;
}

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parseSemVer(version: string): ParsedSemVer | null {
  const match = version.trim().match(SEMVER_PATTERN);
  if (!match) return null;

  return {
    major: match[1],
    minor: match[2],
    patch: match[3],
    hasPrerelease: match[4] !== undefined,
  };
}

function incrementNumericIdentifier(value: string): string {
  const digits = value.split("");
  let carry = 1;

  for (let index = digits.length - 1; index >= 0 && carry; index -= 1) {
    const nextDigit = Number(digits[index]) + carry;
    digits[index] = String(nextDigit % 10);
    carry = nextDigit >= 10 ? 1 : 0;
  }

  if (carry) digits.unshift("1");
  return digits.join("");
}

function incrementSemVer(
  version: string,
  release: SemVerRelease
): string | null {
  const parsed = parseSemVer(version);
  if (!parsed) return null;

  let { major, minor, patch } = parsed;

  if (release === "major") {
    if (minor !== "0" || patch !== "0" || !parsed.hasPrerelease) {
      major = incrementNumericIdentifier(major);
    }
    minor = "0";
    patch = "0";
  } else if (release === "minor") {
    if (patch !== "0" || !parsed.hasPrerelease) {
      minor = incrementNumericIdentifier(minor);
    }
    patch = "0";
  } else if (!parsed.hasPrerelease) {
    patch = incrementNumericIdentifier(patch);
  }

  return `${major}.${minor}.${patch}`;
}

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

function ProjectVersionDialog({
  project,
}: {
  project: ProjectWithStats;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(project.version);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateProject } = useProjects();

  const trimmedVersion = version.trim();
  const isValidVersion = parseSemVer(trimmedVersion) !== null;
  const versionChanged = trimmedVersion !== project.version;
  const releases: {
    release: SemVerRelease;
    label: string;
  }[] = [
    {
      release: "major",
      label: "Major",
    },
    {
      release: "minor",
      label: "Minor",
    },
    {
      release: "patch",
      label: "Patch",
    },
  ];

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);
    if (nextOpen) setVersion(project.version);
  };

  const handleSave = async (): Promise<void> => {
    if (!isValidVersion) {
      toast.error("Enter a valid semantic version");
      return;
    }

    if (project.id === undefined) {
      toast.error("Failed to identify project");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProject(project.id, { version: trimmedVersion });
      toast.success(`Version updated to v${trimmedVersion}`);
      setOpen(false);
    } catch {
      toast.error("Failed to update project version");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group/version -ml-1 mb-4 mt-0.5 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Edit ${project.title} version, currently ${project.version}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleOpenChange(true);
          }}
        >
          v{project.version}
          <FaEdit className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/version:opacity-100 group-focus-visible/version:opacity-100" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[480px]"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Update project version</DialogTitle>
          <DialogDescription>
            Enter a version manually or choose a SemVer increment for{" "}
            {project.title}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`project-version-${project.id}`}>Version</Label>
                <span className="text-xs text-muted-foreground">
                  Current:{" "}
                  <span className="font-mono">v{project.version}</span>
                </span>
              </div>
              <Input
                id={`project-version-${project.id}`}
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="1.0.0"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!isValidVersion}
                aria-describedby={`project-version-help-${project.id}`}
                disabled={isSubmitting}
              />
              <p
                id={`project-version-help-${project.id}`}
                className={cn(
                  "text-xs",
                  isValidVersion
                    ? "text-muted-foreground"
                    : "text-destructive"
                )}
              >
                {isValidVersion
                  ? "Use SemVer without a leading v, for example 2.1.0 or 2.1.0-beta.1."
                  : "Enter a valid SemVer value in major.minor.patch format."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Quick increment</Label>
              <div className="grid grid-cols-3 gap-2">
                {releases.map(({ release, label }) => {
                  const nextVersion = incrementSemVer(
                    trimmedVersion,
                    release
                  );

                  return (
                    <Button
                      key={release}
                      type="button"
                      variant="outline"
                      className="h-auto min-w-0 flex-col items-center gap-1 px-3 py-2.5 text-center"
                      onClick={() => {
                        if (nextVersion) setVersion(nextVersion);
                      }}
                      disabled={!nextVersion || isSubmitting}
                    >
                      <span>{label}</span>
                      <span className="w-full truncate font-mono text-xs font-normal text-muted-foreground">
                        {nextVersion ? `v${nextVersion}` : "—"}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValidVersion || !versionChanged || isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save version"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
        <ProjectVersionDialog project={project} />

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
