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
  formatTimeNew,
  reduceSessions,
  whiteText,
} from "@/lib/utils";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { MdTimelapse } from "react-icons/md";
import { TbClockHeart } from "react-icons/tb";

import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FaHashtag, FaPlus, FaTrash } from "react-icons/fa6";
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
import { type JSX, useState } from "react";

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

  return (
    <div className="">
      <div
        className={cn("flex-1 p-4 gap-4 flex flex-col", "container mx-auto")}
      >
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">BIT Focus</h1>
          <span>Your minimalist productivity workspace.</span>
        </div>

        {/* Analytics Cards Section */}
        <div className={cn("flex gap-4", "flex-wrap", "my-8")}>
          <CardTimeFocused />
        </div>

        {/* Tag Management Section */}
        <div className={cn("flex")}>
          <SavedTags />
        </div>

        {/* Development Notice */}
        <h1 className="text-sm opacity-60 my-8">
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
    <Card className="px-4 py-6">
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
                <Button variant={"ghost"} type="button" onClick={() => setOpen(!open)} className="flex-1">
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
      <CardDescription className="flex flex-col gap-2 items-center max-h-32 overflow-y-auto">
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
      <Card className="w-64">
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
      <Card className="w-64">
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
      <Card className="w-64">
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