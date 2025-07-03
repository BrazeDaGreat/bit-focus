/**
 * Quick Task Add Component - Streamlined Task Creation Interface
 * 
 * This component provides a minimal friction interface for quickly creating
 * tasks directly from the top navigation bar. It replaces the previous
 * comprehensive TaskView popover with a focused creation experience that
 * integrates with Discord webhooks for notifications and supports the
 * enhanced task system with completion tracking.
 * 
 * Features:
 * - Minimal friction task creation workflow
 * - Priority selection with visual indicators
 * - Tag assignment with comma-separated input
 * - Subtask creation with simple text input
 * - Due date selection with calendar widget
 * - Discord webhook integration for notifications
 * - Automatic completion tracking initialization
 * - Form validation and error handling
 * - Responsive popover design
 * 
 * Design Philosophy:
 * - Quick access from any page via top bar
 * - Minimal required fields for speed
 * - Smart defaults to reduce decision fatigue
 * - Immediate feedback and success states
 * 
 * Dependencies:
 * - Enhanced useTask hook for task management
 * - React Hook Form for form state management
 * - Zod for input validation
 * - UI components for consistent styling
 * - Webhook integration for notifications
 * 
 * @fileoverview Quick task creation component for minimal friction workflows
 * @author BIT Focus Development Team
 * @since v0.7.1-alpha
 * @updated v0.7.1-alpha - Added completion tracking support
 */

"use client";

import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FaPlus, FaExclamationTriangle, FaClock, FaHashtag } from "react-icons/fa";
import { MdPriorityHigh } from "react-icons/md";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { useTask } from "@/hooks/useTask";
import { useConfig } from "@/hooks/useConfig";
import { sendMessage } from "@/lib/webhook";
import { cn } from "@/lib/utils";

/**
 * Form validation schema using Zod
 * 
 * Defines validation rules for the quick task creation form
 * with appropriate error messages and constraints.
 */
const quickTaskSchema = z.object({
  task: z.string().min(1, "Task title is required"),
  duedate: z.string().min(1, "Due date is required"),
  priority: z.coerce.number().min(1).max(4).default(1),
  tags: z.string().optional(),
  subtasks: z.string().optional(),
});

type QuickTaskForm = z.infer<typeof quickTaskSchema>;

/**
 * Priority configuration for display and selection
 * 
 * Maps priority levels to visual indicators and descriptions
 * for consistent UI representation throughout the component.
 */
const PRIORITY_CONFIG = {
  1: { 
    label: "Low", 
    color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    icon: "●" 
  },
  2: { 
    label: "Medium", 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    icon: "●●" 
  },
  3: { 
    label: "High", 
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
    icon: "●●●" 
  },
  4: { 
    label: "Urgent", 
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
    icon: "●●●●" 
  },
};

/**
 * Quick Task Add Component
 * 
 * Renders a compact button that opens a popover form for quick task creation.
 * Integrates with the enhanced task management system and provides webhook
 * notifications for task creation events.
 * 
 * The component emphasizes speed and minimal friction, requiring only a task
 * title and due date while providing optional fields for comprehensive task
 * definition when needed.
 * 
 * @component
 * @returns {JSX.Element} Quick task creation button and form
 * 
 * @example
 * ```tsx
 * // Used in TopBar for quick access
 * <QuickTaskAdd />
 * ```
 */
export default function QuickTaskAdd(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const { addTask } = useTask();
  const { name, webhook } = useConfig();

  // Form setup with validation
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
    setValue
  } = useForm<QuickTaskForm>({
    resolver: zodResolver(quickTaskSchema),
    defaultValues: {
      priority: 1,
      tags: "",
      subtasks: "",
    }
  });

  const selectedPriority = watch("priority") || 1;

  /**
   * Handles form submission and task creation
   * 
   * Processes the form data, creates the task with completion tracking,
   * sends webhook notifications if configured, and provides user feedback 
   * through toast messages.
   * 
   * @param {QuickTaskForm} data - Validated form data
   * @returns {Promise<void>}
   */
  const onSubmit = async (data: QuickTaskForm): Promise<void> => {
    try {
      // Parse tags and subtasks from comma-separated strings
      const tags = data.tags 
        ? data.tags.split(",").map(tag => tag.trim()).filter(Boolean)
        : [];
      
      const subtasks = data.subtasks
        ? data.subtasks.split(",").map(subtask => subtask.trim()).filter(Boolean)
        : [];

      // Create the task (completion tracking is handled automatically in useTask)
      await addTask(
        data.task,
        subtasks,
        new Date(data.duedate),
        tags,
        data.priority
      );

      // Send webhook notification if configured
      if (name && webhook) {
        const priorityLabel = PRIORITY_CONFIG[data.priority as keyof typeof PRIORITY_CONFIG].label;
        const dueDateStr = new Date(data.duedate).toLocaleDateString();
        const tagString = tags.length > 0 ? ` with tags: ${tags.map(t => `#${t}`).join(", ")}` : "";
        
        await sendMessage(
          `${name} created a new ${priorityLabel.toLowerCase()} priority task: "${data.task}" due ${dueDateStr}${tagString}`,
          webhook
        );
      }

      // Success feedback
      toast.success("Task created successfully!", {
        description: `"${data.task}" has been added to your todo list.`
      });

      // Reset form and close popover
      reset();
      setIsOpen(false);

    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error("Failed to create task", {
        description: "Please try again."
      });
    }
  };

  /**
   * Calculates the minimum date for due date selection
   * 
   * @returns {string} Today's date in YYYY-MM-DD format
   */
  const getMinDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className="gap-2"
        >
          <FaPlus className="h-3 w-3" />
          Quick Task
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-96 p-6" side="bottom" align="end">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header */}
          <div className="space-y-1">
            <h4 className="font-semibold text-lg">Create Quick Task</h4>
            <p className="text-sm text-muted-foreground">
              Add a new task to your todo list
            </p>
          </div>

          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="task" className="flex items-center gap-2">
              <FaClock className="h-3 w-3" />
              Task Title *
            </Label>
            <Input
              id="task"
              placeholder="Enter task title..."
              {...register("task")}
              className={cn(errors.task && "border-red-500")}
            />
            {errors.task && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <FaExclamationTriangle className="h-3 w-3" />
                {errors.task.message}
              </p>
            )}
          </div>

          {/* Due Date and Priority Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="duedate">Due Date *</Label>
              <Input
                id="duedate"
                type="date"
                min={getMinDate()}
                {...register("duedate")}
                className={cn(errors.duedate && "border-red-500")}
              />
              {errors.duedate && (
                <p className="text-xs text-red-500">{errors.duedate.message}</p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MdPriorityHigh className="h-3 w-3" />
                Priority
              </Label>
              <Select
                value={selectedPriority.toString()}
                onValueChange={(value) => setValue("priority", parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={config.color}>
                          {config.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Current Priority Display */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Selected Priority:</span>
            <Badge className={PRIORITY_CONFIG[selectedPriority as keyof typeof PRIORITY_CONFIG].color}>
              {PRIORITY_CONFIG[selectedPriority as keyof typeof PRIORITY_CONFIG].label}
            </Badge>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="flex items-center gap-2">
              <FaHashtag className="h-3 w-3" />
              Tags
            </Label>
            <Input
              id="tags"
              placeholder="work, project, urgent (comma-separated)"
              {...register("tags")}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple tags with commas
            </p>
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label htmlFor="subtasks">Subtasks</Label>
            <Textarea
              id="subtasks"
              placeholder="Research topic, Write outline, Review draft (comma-separated)"
              rows={3}
              {...register("subtasks")}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple subtasks with commas
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <FaPlus className="h-3 w-3" />
                  Create Task
                </>
              )}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}