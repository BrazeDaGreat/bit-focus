/**
 * Home Page Component - Main Dashboard and Analytics Overview
 *
 * This is the primary dashboard page that provides users with a comprehensive
 * overview of their productivity metrics and tag management. It displays focus
 * time statistics across multiple time periods and offers tag management
 * functionality for organizing focus sessions.
 *
 * Features:
 * - Multi-period focus time analytics (24h, 7 days, 30 days)
 * - Interactive focus time cards with loading states
 * - Saved tags management with color customization
 * - Real-time data processing and visualization
 * - Theme-aware toast notifications
 * - Responsive card-based layout
 * - Tag creation and deletion functionality
 *
 * Analytics Periods:
 * - Last 24 hours: Recent daily productivity
 * - Last 168 hours (7 days): Weekly productivity trends
 * - Last 720 hours (30 days): Monthly productivity overview
 *
 * Dependencies:
 * - Day.js for advanced date calculations and comparisons
 * - Focus sessions database for analytics data
 * - Tag management system for organization
 * - React Hook Form for tag creation forms
 * - Theme system for consistent UI appearance
 *
 * @fileoverview Main dashboard page with productivity analytics and tag management
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { FocusSession, useFocus } from "@/hooks/useFocus";
import {
  cn,
  durationFromSeconds,
  formatDate,
  formatTimeNew,
  reduceSessions,
  whiteText,
} from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { MdTimelapse } from "react-icons/md";
import { TbClockHeart } from "react-icons/tb";

import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FaCalendar,
  FaChevronDown,
  FaChevronUp,
  FaHashtag,
  FaPlus,
  FaRegCircle,
  FaRegCircleCheck,
  FaSpinner,
  FaTrash,
} from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { useTag } from "@/hooks/useTag";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { type JSX, useState, useEffect } from "react";
import { FaProjectDiagram } from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { GoDotFill } from "react-icons/go";
import { Issue, Milestone, Project, useProjects } from "@/hooks/useProjects";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";

// Extend dayjs with required plugins for date range calculations
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);

/**
 * Main Home Dashboard Component
 *
 * Renders the primary dashboard interface with productivity analytics
 * and tag management features. The component orchestrates multiple
 * sub-components to provide a comprehensive overview of user activity
 * and productivity metrics.
 *
 * The dashboard includes focus time statistics across different time
 * periods and provides tools for managing tags used to categorize
 * focus sessions. All components are theme-aware and responsive.
 *
 * @component
 * @returns {JSX.Element} The complete dashboard interface
 *
 * @example
 * ```tsx
 * // Automatically rendered when navigating to the root path
 * <Home />
 * ```
 *
 * @see {@link CardTimeFocused} for focus time analytics display
 * @see {@link SavedTags} for tag management functionality
 */
export default function Home(): JSX.Element {
  const { theme } = useTheme();
  const { loadFocusSessions } = useFocus();

  /**
   * Load focus sessions on component mount
   * Ensures dashboard analytics have data to display
   */
  useEffect(() => {
    loadFocusSessions();
  }, [loadFocusSessions]);

  return (
    <div className={cn("flex-1 container mx-auto")}>
      <div className={cn("p-8", "flex flex-col gap-8")}>
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">BIT Focus</h1>
          <span>Your minimalist productivity workspace.</span>
        </div>

        <div className={cn("flex gap-4", "flex-col lg:flex-row")}>
          <UpcomingIssuesCard />
          <div className={cn("flex flex-col gap-4")}>
            <SavedTags />
            <CardTimeFocused />
          </div>
        </div>

        {/* Development Notice */}
        <h1 className="text-sm opacity-60 my-2">
          This feature is under development.
        </h1>
      </div>

      {/* Theme-aware Toast Notifications */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

/**
 * Saved Tags Management Component
 *
 * Provides a comprehensive interface for managing saved tags that can be
 * used to categorize focus sessions. Users can create custom tags with
 * specific colors and delete existing tags. The component includes form
 * validation and real-time color preview functionality.
 *
 * Features:
 * - Tag creation with custom names and HEX colors
 * - Form validation for tag names and color formats
 * - Visual tag display with custom colors and proper contrast
 * - Tag deletion functionality with hover effects
 * - Popover-based creation interface
 * - Real-time form state management
 *
 * @component
 * @returns {JSX.Element} Tag management card with creation and deletion tools
 *
 * @example
 * ```tsx
 * // Used within the home dashboard
 * <SavedTags />
 * ```
 *
 * @see {@link useTag} for tag state management
 * @see {@link useForm} for form handling
 */
function SavedTags(): JSX.Element {
  const { savedTags, addSavedTag, removeSavedTag } = useTag();
  const [open, setOpen] = useState(false);

  // Form management with React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  /**
   * Handles tag creation form submission
   *
   * Processes the form data to create a new saved tag with the specified
   * name and color. Validates the input and adds the tag to the saved
   * tags collection, then closes the creation popover.
   *
   * @param {any} data - Form data containing tagname and color
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Called when form is submitted
   * create({
   *   tagname: "Work",
   *   color: "#3b82f6"
   * });
   * ```
   */
  const create = (data: any): void => {
    const { tagname, color } = data;
    console.log(data);
    addSavedTag(tagname, color);
    setOpen(!open);
  };

  return (
    <Card className="px-4 py-6 w-full lg:w-72">
      <CardTitle className="flex gap-12 items-center justify-between">
        {/* Header Section */}
        <div className="flex gap-2">
          <FaHashtag />
          <span>Saved Tags</span>
        </div>

        {/* Add Tag Button */}
        <Popover open={open}>
          <PopoverTrigger asChild>
            <Button variant={"ghost"} onClick={() => setOpen(!open)}>
              <FaPlus />
              <span>Add</span>
            </Button>
          </PopoverTrigger>

          {/* Tag Creation Form */}
          <PopoverContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={handleSubmit(create)}
            >
              {/* Tag Name Field */}
              <Label htmlFor="tagname">Tag Name</Label>
              <Input
                id="tagname"
                {...register("tagname", { required: "Tag name is required." })}
              />
              {errors.tagname && (
                <span className="text-red-500 text-xs">
                  {`${errors.tagname.message}`}
                </span>
              )}

              {/* Color Selection Field */}
              <Label htmlFor="color" id="color_hex">
                Color HEX
              </Label>
              <Input
                id="color"
                {...register("color", {
                  pattern: {
                    value: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
                    message: "Enter a valid HEX color (e.g. #fff or #ffffff).",
                  },
                })}
              />
              {errors.color && (
                <span className="text-red-500 text-xs">
                  {`${errors.color.message}`}
                </span>
              )}

              <div></div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant={"ghost"}
                  type="button"
                  onClick={() => setOpen(!open)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button variant={"outline"} type="submit" className="flex-1">
                  Create
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </CardTitle>

      {/* Saved Tags Display */}
      {
        
      }
      <CardDescription className="flex flex-col gap-2 px-2 items-center overflow-y-auto">
        {savedTags.map((t) => {
          return (
            <div
              key={t.t}
              className="w-full py-2 px-2 rounded-sm font-semibold flex items-center justify-between"
              style={{
                backgroundColor: t.c,
                color: whiteText(t.c) ? "white" : "black",
              }}
            >
              {/* Tag Name Display */}
              <span className="flex items-center text-md italic">
                <FaHashtag /> {t.t}
              </span>

              {/* Delete Button */}
              <span
                onClick={() => removeSavedTag(t.t)}
                className="hover:-translate-y-0.5 cursor-pointer transition-all"
              >
                <FaTrash />
              </span>
            </div>
          );
        })}
      </CardDescription>
    </Card>
  );
}

/**
 * Focus Time Analytics Cards Component
 *
 * Renders multiple analytics cards displaying focus time statistics across
 * different time periods (24 hours, 7 days, 30 days). Each card shows
 * formatted focus time with appropriate icons and time period labels.
 *
 * The component processes focus session data using dayjs for date calculations
 * and provides loading states with skeleton components. Focus times are
 * calculated by filtering sessions within specific date ranges and summing
 * their durations.
 *
 * Time Periods:
 * - Last 24 hours: Recent daily activity
 * - Last 168 hours: Weekly productivity (7 days)
 * - Last 720 hours: Monthly overview (30 days)
 *
 * @component
 * @returns {JSX.Element} Three analytics cards showing focus time statistics
 *
 * @example
 * ```tsx
 * // Used within the home dashboard analytics section
 * <CardTimeFocused />
 * ```
 *
 * @see {@link useFocus} for focus sessions data
 * @see {@link reduceSessions} for time calculation utilities
 * @see {@link formatTimeNew} for time formatting
 */
function CardTimeFocused(): JSX.Element {
  const { focusSessions, loadingFocusSessions } = useFocus();

  // Initialize arrays for different time periods
  const today: FocusSession[] = [];
  const week: FocusSession[] = [];
  const month: FocusSession[] = [];

  /**
   * Process focus sessions into time period categories
   *
   * Iterates through all focus sessions and categorizes them based on
   * their start time relative to the current date. Uses dayjs for
   * accurate date comparisons and range checking.
   */
  focusSessions.forEach((session) => {
    const start = dayjs(session.startTime);

    // Last 24 hours
    if (start.isSameOrAfter(dayjs().subtract(1, "day"))) {
      today.push(session);
    }

    // Last 7 days (168 hours)
    if (start.isBetween(dayjs().subtract(7, "day"), dayjs())) {
      week.push(session);
    }

    // Last 30 days (720 hours)
    if (start.isBetween(dayjs().subtract(30, "day"), dayjs())) {
      month.push(session);
    }
  });

  // Calculate total times for each period
  const todayTotal = formatTimeNew(
    durationFromSeconds(reduceSessions(today)),
    "H:M:S",
    "text"
  );
  const weekTotal = formatTimeNew(
    durationFromSeconds(reduceSessions(week)),
    "H:M:S",
    "text"
  );
  const monthTotal = formatTimeNew(
    durationFromSeconds(reduceSessions(month)),
    "H:M:S",
    "text"
  );

  return (
    <>
      {/* 24 Hour Focus Time Card */}
      <Card>
        <div className="px-4 space-y-3">
          <div className="flex items-center gap-2">
            <MdTimelapse />
            <span className="text-xl font-bold">Focus Time</span>
            <span className="text-xs opacity-70">(Last 24h)</span>
          </div>
          <span className="text-3xl font-bold">
            {loadingFocusSessions ? <Skeleton className="h-10" /> : todayTotal}
          </span>
        </div>
      </Card>

      {/* 7 Day Focus Time Card */}
      <Card>
        <div className="px-4 space-y-3">
          <div className="flex items-center gap-2">
            <TbClockHeart />
            <span className="text-xl font-bold">Focus Time</span>
            <span className="text-xs opacity-70">(Last 168h)</span>
          </div>
          <span className="text-3xl font-bold">
            {loadingFocusSessions ? <Skeleton className="h-10" /> : weekTotal}
          </span>
        </div>
      </Card>

      {/* 30 Day Focus Time Card */}
      <Card>
        <div className="px-4 space-y-3">
          <div className="flex items-center gap-2">
            <TbClockHeart />
            <span className="text-xl font-bold">Focus Time</span>
            <span className="text-xs opacity-70">(Last 720h)</span>
          </div>
          <span className="text-3xl font-bold">
            {loadingFocusSessions ? <Skeleton className="h-10" /> : monthTotal}
          </span>
        </div>
      </Card>
    </>
  );
}

/**
 * Upcoming Issues Card Component with Categories
 *
 * Displays issues categorized by time periods: today, tomorrow, and next 7 days.
 * Each category is clearly labeled and can be collapsed/expanded for better UX.
 *
 * Features:
 * - Categorized issue display by time period
 * - Collapsible sections for each category
 * - Issue count indicators for each category
 * - Consistent styling across categories
 * - Empty state handling per category
 *
 * @component
 * @returns {JSX.Element} Categorized issues overview card
 */
function UpcomingIssuesCard(): JSX.Element {
  const { getUpcomingIssues, loadingProjects } = useProjects();

  // Show skeleton during loading
  if (loadingProjects) {
    return (
      <Card className="px-4 py-6 flex-1">
        <CardTitle className="flex gap-2 items-center">
          <FaCalendar />
          <span>Ongoing Issues</span>
        </CardTitle>
        <CardDescription className="text-center py-8 h-full flex flex-col items-center justify-center">
          <FaSpinner className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-30 animate-spin" />
          <p>Loading Issues</p>
          <p className="text-xs mt-1">Hang on a moment ...</p>
        </CardDescription>
      </Card>
    );
  }

  const { overdue, today, tomorrow, next7days } = getUpcomingIssues();
  const totalIssues = today.length + tomorrow.length + next7days.length;

  // Show empty state when no upcoming issues
  if (totalIssues === 0) {
    return (
      <Card className="px-4 py-6 flex-1">
        <CardTitle className="flex gap-2 items-center">
          <FaCalendar />
          <span>Ongoing Issues</span>
        </CardTitle>
        <CardDescription className="text-center py-8 h-full flex flex-col items-center justify-center">
          <FaCalendar className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-30" />
          <p>No issues due in the next 7 days</p>
          <p className="text-xs mt-1">You&apos;re all caught up!</p>
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="px-4 py-6 flex-1">
      <CardTitle className="flex gap-2 items-center mb-4">
        <FaCalendar />
        <span>Ongoing Issues</span>
        <Badge variant="secondary" className="ml-2">
          {totalIssues}
        </Badge>
      </CardTitle>
      <CardDescription className="space-y-4 overflow-y-auto">
        {/* Overdue Section */}
        <IssueCategorySection
          title="Overdue"
          count={overdue.length}
          issues={overdue}
        />


        {/* Today Section */}
        <IssueCategorySection
          title="Today"
          count={today.length}
          issues={today}
        />

        {/* Tomorrow Section */}
        <IssueCategorySection
          title="Tomorrow"
          count={tomorrow.length}
          issues={tomorrow}
        />

        {/* Next 7 Days Section */}
        <IssueCategorySection
          title="Next 7 days"
          count={next7days.length}
          issues={next7days}
        />
      </CardDescription>
    </Card>
  );
}

/**
 * Issue Category Section Component
 *
 * Renders a collapsible section for a specific time period category.
 * Displays the category title, issue count, and toggleable issue list.
 *
 * @component
 * @param {Object} props - Component props
 * @param {string} props.title - Category title (e.g., "Today", "Tomorrow")
 * @param {number} props.count - Number of issues in this category
 * @param {Array} props.issues - Array of issues for this category
 * @param {boolean} props.isExpanded - Whether the section is expanded
 * @param {() => void} props.onToggle - Function to toggle section expansion
 * @param {"destructive" | "default" | "secondary"} props.variant - Badge styling variant
 * @returns {JSX.Element} Category section with collapsible content
 */
function IssueCategorySection({
  title,
  count,
  issues,
}: {
  title: string;
  count: number;
  issues: (Issue & { milestone: Milestone; project: Project })[];
}): JSX.Element {
  // Don't render empty categories
  if (count === 0) return <></>;

  return (
    <>
      <div className="flex items-center text-xs text-muted-foreground">
        <span>{title}</span>
      </div>
      {issues.map((issue) => (
        <UpcomingIssueItem key={issue.id} issue={issue} />
      ))}
    </>
  );
}

/**
 * Individual Upcoming Issue Item Component
 *
 * Renders a single issue item similar to the project page design but
 * optimized for the homepage with project navigation functionality.
 *
 * Features:
 * - Issue status toggle (Open/Close)
 * - Due date and label display
 * - Project and milestone context
 * - Description toggle functionality
 * - Direct navigation to parent project
 * - Consistent styling with project page
 *
 * @component
 * @param {Object} props - Component props
 * @param {Issue & { milestone: Milestone; project: Project }} props.issue - Issue with context
 * @returns {JSX.Element} Individual issue item with navigation
 *
 * @example
 * ```tsx
 * {upcomingIssues.map((issue) => (
 *   <UpcomingIssueItem key={issue.id} issue={issue} />
 * ))}
 * ```
 *
 * @see {@link useProjects} for issue management operations
 */
function UpcomingIssueItem({
  issue,
}: {
  issue: Issue & { milestone: Milestone; project: Project };
}): JSX.Element {
  const { updateIssue } = useProjects();
  const router = useRouter();
  const [showDescription, setShowDescription] = useState(false);
  const isMobile = useIsMobile();

  /**
   * Toggles issue status between Open and Close
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleStatusToggle = async (): Promise<void> => {
    const newStatus = issue.status === "Open" ? "Close" : "Open";
    try {
      await updateIssue(issue.id!, { status: newStatus });
      toast.success(`Issue marked as ${newStatus.toLowerCase()}`);
    } catch (error) {
      console.error("Failed to update issue status:", error);
      toast.error("Failed to update issue status");
    }
  };

  /**
   * Navigates to the parent project page
   *
   * @returns {void}
   */
  const handleNavigateToProject = (): void => {
    router.push(`/projects/${issue.project.id}`);
  };

  return (
    <div
      className={cn(
        "flex flex-col justify-between p-3 border rounded-md transition-all",
        issue.status === "Close" && "opacity-60"
      )}
    >
      {/* Issue Title and Status Toggle */}
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

      {/* Project and Milestone Context */}
      {!isMobile && (
        <div className="flex items-center text-xs text-muted-foreground pl-10 py-1">
          <FaProjectDiagram className="mr-1 h-3 w-3" />
          <span>{issue.project.title}</span>
          <span className="mx-1">→</span>
          <span>{issue.milestone.title}</span>
        </div>
      )}

      {/* Issue Details and Actions */}
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-2 opacity-80", isMobile ? "text-xs" : "pl-10")}>
          {issue.dueDate && (
            <>
              <FaCalendar />
              <span>{formatDate(issue.dueDate)}</span>
              {!isMobile && <div className={cn("w-2")}></div>}
              <GoDotFill className="w-2 h-2 opacity-60" />
              {!isMobile && <div className={cn("w-2")}></div>}
            </>
          )}
          {
            isMobile ?
            <span className="text-xs">{issue.label}</span>
            :
            <Badge variant="outline" className="text-xs">
              {issue.label}
            </Badge>
          }
          </div>

        {/* Action Buttons */}
        <div className="flex gap-1">
          {issue.description && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDescription(!showDescription)}
              title={showDescription ? "Hide description" : "Show description"}
            >
              {showDescription ? <FaChevronUp /> : <FaChevronDown />}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigateToProject}
            className="gap-1"
            title={`Go to ${issue.project.title} project`}
          >
            <FaProjectDiagram className="h-3 w-3" />
            {!isMobile && "View Project"}
          </Button>
        </div>
      </div>

      {/* Expandable Description */}
      <div
        className={cn(
          "transition-all overflow-hidden text-muted-foreground pl-10",
          showDescription ? "max-h-20 py-2" : "max-h-0 py-0"
        )}
      >
        {issue.description}
      </div>
    </div>
  );
}
