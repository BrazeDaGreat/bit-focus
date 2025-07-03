/**
 * Enhanced Todo Page Component - Microsoft Todo Inspired Design with Comprehensive Webhook Integration
 *
 * This page provides a clean, compact task management interface inspired by
 * Microsoft Todo with comprehensive webhook notifications for all task actions.
 * Features enhanced webhook integration for task lifecycle events including
 * creation, completion, editing, deletion, and subtask milestones.
 *
 * Features:
 * - Microsoft Todo-inspired compact design
 * - Comprehensive webhook notifications for all actions
 * - Smart subtask milestone notifications
 * - Priority-aware webhook messages
 * - Tag-based notifications
 * - Overdue task alerts
 * - Centered layout with max-width constraints
 * - Compact, scannable task items
 * - Efficient sidebar for controls and stats
 * - Clean visual hierarchy
 * - Responsive design
 *
 * Webhook Integration:
 * - Task completion/incompletion notifications
 * - Task deletion confirmations
 * - Task editing updates
 * - Subtask milestone achievements
 * - Priority and due date context in messages
 *
 * Design Principles:
 * - Compact task items for easy scanning
 * - Proper spacing and typography
 * - Clear visual hierarchy
 * - Efficient use of horizontal space
 *
 * @fileoverview Microsoft Todo-inspired task management interface with comprehensive webhook integration
 * @author BIT Focus Development Team
 * @since v0.8.0-alpha
 * @updated v0.8.0-alpha - Added comprehensive webhook integration
 */

"use client";

import { useEffect, useState, type JSX } from "react";
import { useTask, Task, TaskTimeCategory } from "@/hooks/useTask";
import { useConfig } from "@/hooks/useConfig";
import { sendMessage } from "@/lib/webhook";
import { useTheme } from "next-themes";
import { Toaster, toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FaClock,
  FaHashtag,
  FaExclamationTriangle,
  FaTrash,
  FaEdit,
  FaCheck,
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaCircle,
  FaCheckCircle,
} from "react-icons/fa";
import { MdPriorityHigh } from "react-icons/md";
import { TbClockHeart } from "react-icons/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import TagBadge from "@/components/TagBadge";
import { FaListCheck } from "react-icons/fa6";

/**
 * View Mode Enumeration
 */
enum ViewMode {
  Time = "time",
  Tags = "tags",
  Priority = "priority",
}

/**
 * Priority Label Mapping with better colors
 */
const PRIORITY_LABELS = {
  4: {
    label: "Urgent",
    color: "bg-red-500",
    textColor: "text-red-100",
    borderColor: "border-red-400",
  },
  3: {
    label: "High",
    color: "bg-orange-500",
    textColor: "text-orange-100",
    borderColor: "border-orange-400",
  },
  2: {
    label: "Medium",
    color: "bg-yellow-500",
    textColor: "text-yellow-100",
    borderColor: "border-yellow-400",
  },
  1: {
    label: "Low",
    color: "bg-green-500",
    textColor: "text-green-100",
    borderColor: "border-green-400",
  },
};

/**
 * Task Edit Form Schema
 */
const taskEditSchema = z.object({
  task: z.string().min(1, "Task title is required"),
  duedate: z.string().min(1, "Due date is required"),
  priority: z.coerce.number().min(1).max(4),
  tags: z.string(),
  subtasks: z.string(),
});

type TaskEditForm = z.infer<typeof taskEditSchema>;

/**
 * Main Todo Page Component with Enhanced Webhook Integration
 * 
 * Renders the complete todo interface with comprehensive webhook notifications
 * for all task lifecycle events. Integrates with Discord webhooks to provide
 * real-time updates about task management activities.
 * 
 * @component
 * @returns {JSX.Element} Complete todo interface with webhook integration
 */
export default function TodoPage(): JSX.Element {
  const { theme } = useTheme();
  const { name, webhook } = useConfig();
  const {
    loadingTasks,
    loadTasks,
    searchQuery,
    setSearchQuery,
    getActiveTasks,
    getCompletedTasks,
    getTasksByTimeCategory,
    getTasksByTag,
    getTasksByPriority,
  } = useTask();

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Time);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completedTasksOpen, setCompletedTasksOpen] = useState(false);

  // Load tasks on component mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  /**
   * Calculates task statistics for the dashboard summary
   * 
   * @returns {Object} Task statistics including totals, completion counts, and priorities
   */
  const getTaskStats = () => {
    const activeTasks = getActiveTasks();
    const completedTasks = getCompletedTasks();
    const timeGroups = getTasksByTimeCategory();

    const total = activeTasks.length;
    const completed = completedTasks.length;
    const overdue = timeGroups[TaskTimeCategory.Overdue].length;
    const dueToday = timeGroups[TaskTimeCategory.DueToday].length;
    const urgent = activeTasks.filter((task) => task.priority === 4).length;

    return { total, completed, overdue, dueToday, urgent };
  };

  /**
   * Sends webhook notification for task-related events with enhanced context
   * 
   * @param {string} message - The message to send
   * @param {Task} task - The task object for additional context
   * @param {string} action - The action performed (completed, deleted, etc.)
   */
  const sendTaskWebhook = async (message: string, task?: Task, action?: string) => {
    if (name && webhook) {
      try {
        await sendMessage(message, webhook);
      } catch (error) {
        console.error(`Failed to send ${action} webhook:`, error);
      }
    }
  };

  /**
   * Generates a formatted task description for webhook messages
   * 
   * @param {Task} task - The task to describe
   * @returns {string} Formatted task description with priority and due date
   */
  const getTaskDescription = (task: Task): string => {
    const priorityInfo = PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS];
    const dueDate = new Date(task.duedate).toLocaleDateString();
    const today = new Date().toISOString().split("T")[0];
    const taskDueDate = new Date(task.duedate).toISOString().split("T")[0];
    
    let dueDateContext = `due ${dueDate}`;
    if (taskDueDate < today) {
      dueDateContext = `overdue (was due ${dueDate})`;
    } else if (taskDueDate === today) {
      dueDateContext = `due today`;
    }
    
    const tagsContext = task.tags.length > 0 ? ` with tags: ${task.tags.map(t => `#${t}`).join(", ")}` : "";
    
    return `${priorityInfo.label.toLowerCase()} priority task "${task.task}" ${dueDateContext}${tagsContext}`;
  };

  const stats = getTaskStats();

  if (loadingTasks) {
    return <TodoPageSkeleton />;
  }

  return (
    <div className="flex-1 p-6 container mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Todo</h1>
        <p className="text-muted-foreground">
          Manage your tasks and stay organized
        </p>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search tasks or #tagname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>

          {/* Task Lists */}
          <div className="space-y-6 overflow-auto max-h-[70vh] pr-4">
            {viewMode === ViewMode.Time && <TimeView />}
            {viewMode === ViewMode.Tags && <TagsView />}
            {viewMode === ViewMode.Priority && <PriorityView />}
          </div>

          {/* Completed Tasks Section */}
          {stats.completed > 0 && (
            <Collapsible
              open={completedTasksOpen}
              onOpenChange={setCompletedTasksOpen}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FaCheck className="text-green-600" />
                        <span>Completed Tasks</span>
                        <Badge variant="secondary">{stats.completed}</Badge>
                      </div>
                      {completedTasksOpen ? <FaChevronUp /> : <FaChevronDown />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-2">
                    {getCompletedTasks().map((task) => (
                      <CompletedTaskCard key={task.id} task={task} />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* View Mode Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">View</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={viewMode}
                onValueChange={(value) => setViewMode(value as ViewMode)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select view mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ViewMode.Time}>
                    <div className="flex items-center gap-2">
                      <FaClock />
                      By Time
                    </div>
                  </SelectItem>
                  <SelectItem value={ViewMode.Tags}>
                    <div className="flex items-center gap-2">
                      <FaHashtag />
                      By Tags
                    </div>
                  </SelectItem>
                  <SelectItem value={ViewMode.Priority}>
                    <div className="flex items-center gap-2">
                      <MdPriorityHigh />
                      By Priority
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaListCheck className="text-blue-600" />
                  <span className="text-sm">Active Tasks</span>
                </div>
                <span className="font-bold">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaCheck className="text-green-600" />
                  <span className="text-sm">Completed</span>
                </div>
                <span className="font-bold">{stats.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TbClockHeart className="text-orange-600" />
                  <span className="text-sm">Due Today</span>
                </div>
                <span className="font-bold">{stats.dueToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaExclamationTriangle className="text-red-600" />
                  <span className="text-sm">Overdue</span>
                </div>
                <span className="font-bold text-red-600">{stats.overdue}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MdPriorityHigh className="text-purple-600" />
                  <span className="text-sm">Urgent</span>
                </div>
                <span className="font-bold text-purple-600">
                  {stats.urgent}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Task Dialog */}
      <EditTaskDialog task={editingTask} onClose={() => setEditingTask(null)} />

      {/* Toast Notifications */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );

  /**
   * Time-based View Component
   * 
   * @returns {JSX.Element} Time-categorized task groups
   */
  function TimeView(): JSX.Element {
    const timeGroups = getTasksByTimeCategory();

    return (
      <div className="space-y-6">
        {Object.entries(timeGroups).map(([category, tasks]) => (
          <TaskGroup
            key={category}
            title={category}
            tasks={tasks}
            icon={<FaClock />}
            isOverdue={category === TaskTimeCategory.Overdue}
            onEditTask={setEditingTask}
          />
        ))}
      </div>
    );
  }

  /**
   * Tags-based View Component
   * 
   * @returns {JSX.Element} Tag-categorized task groups
   */
  function TagsView(): JSX.Element {
    const tagGroups = getTasksByTag();

    return (
      <div className="space-y-6">
        {Object.entries(tagGroups).map(([tag, tasks]) => (
          <TaskGroup
            key={tag}
            title={tag}
            tasks={tasks}
            icon={<FaHashtag />}
            onEditTask={setEditingTask}
          />
        ))}
      </div>
    );
  }

  /**
   * Priority-based View Component
   * 
   * @returns {JSX.Element} Priority-categorized task groups
   */
  function PriorityView(): JSX.Element {
    const priorityGroups = getTasksByPriority();

    return (
      <div className="space-y-6">
        {Object.entries(priorityGroups)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([priority, tasks]) => {
            const priorityInfo =
              PRIORITY_LABELS[Number(priority) as keyof typeof PRIORITY_LABELS];
            return (
              <TaskGroup
                key={priority}
                title={`${priorityInfo.label} Priority`}
                tasks={tasks}
                icon={<MdPriorityHigh />}
                onEditTask={setEditingTask}
              />
            );
          })}
      </div>
    );
  }

  /**
   * Task Group Component
   * 
   * @param {Object} props - Component props
   * @param {string} props.title - Group title
   * @param {Task[]} props.tasks - Tasks in this group
   * @param {JSX.Element} props.icon - Group icon
   * @param {boolean} props.isOverdue - Whether this is an overdue group
   * @param {Function} props.onEditTask - Callback for editing tasks
   * @returns {JSX.Element} Task group container
   */
  function TaskGroup({
    title,
    tasks,
    icon,
    isOverdue,
    onEditTask,
  }: {
    title: string;
    tasks: Task[];
    icon: JSX.Element;
    isOverdue?: boolean;
    onEditTask: (task: Task) => void;
  }): JSX.Element {
    if (tasks.length === 0) return <></>;

    return (
      <div className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center gap-2 pb-2">
          {icon}
          <h2
            className={cn("text-lg font-semibold", isOverdue && "text-red-600")}
          >
            {title}
          </h2>
          <Badge variant="secondary" className="ml-auto">
            {tasks.length}
          </Badge>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onEdit={onEditTask}
              sendTaskWebhook={sendTaskWebhook}
              getTaskDescription={getTaskDescription}
            />
          ))}
        </div>
      </div>
    );
  }

  /**
   * Completed Task Card Component with Webhook Integration
   * 
   * @param {Object} props - Component props
   * @param {Task} props.task - The completed task
   * @returns {JSX.Element} Completed task card
   */
  function CompletedTaskCard({ task }: { task: Task }): JSX.Element {
    const { removeTask, uncompleteTask } = useTask();

    /**
     * Handles task restoration with webhook notification
     */
    const handleUncompleteTask = async () => {
      try {
        await uncompleteTask(task.id!);
        await sendTaskWebhook(
          `${name} restored ${getTaskDescription(task)} back to active tasks`,
          task,
          "restoration"
        );
        toast.success("Task restored to active list!");
      } catch (error) {
        console.error("Failed to uncomplete task:", error);
        toast.error("Failed to restore task");
      }
    };

    /**
     * Handles task deletion with webhook notification
     */
    const handleDeleteTask = async () => {
      try {
        await removeTask(task.id!);
        await sendTaskWebhook(
          `${name} permanently deleted completed ${getTaskDescription(task)}`,
          task,
          "deletion"
        );
        toast.success("Task permanently deleted!");
      } catch (error) {
        console.error("Failed to delete task:", error);
        toast.error("Failed to delete task");
      }
    };

    return (
      <div className="group bg-muted/30 border rounded-lg p-3 opacity-75">
        <div className="flex items-start gap-3">
          <Button
            variant={"ghost"}
            size={"icon"}
            onClick={handleUncompleteTask}
          >
            <FaCheckCircle className="text-green-600" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base line-through text-muted-foreground truncate">
              {task.task}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span>Due: {new Date(task.duedate).toLocaleDateString()}</span>
              <Badge variant="secondary" className="text-xs">
                Completed
              </Badge>
            </div>
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {task.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} noHover />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="destructive"
              size="icon"
              onClick={handleDeleteTask}
            >
              <FaTrash />
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Individual Task Card Component with Enhanced Webhook Integration
 * 
 * @param {Object} props - Component props
 * @param {Task} props.task - The task to display
 * @param {Function} props.onEdit - Callback for editing tasks
 * @param {Function} props.sendTaskWebhook - Function to send webhook notifications
 * @param {Function} props.getTaskDescription - Function to format task descriptions
 * @returns {JSX.Element} Task card with webhook-enabled actions
 */
function TaskCard({ 
  task, 
  onEdit, 
  sendTaskWebhook, 
  getTaskDescription 
}: { 
  task: Task; 
  onEdit: (task: Task) => void;
  sendTaskWebhook: (message: string, task?: Task, action?: string) => Promise<void>;
  getTaskDescription: (task: Task) => string;
}): JSX.Element {
  const { removeTask, completeTask, updateSubtaskCompletion } = useTask();
  const { name } = useConfig();
  const priorityInfo =
    PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS];
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = new Date(task.duedate).toISOString().split("T")[0] < today;
  const isDueToday =
    new Date(task.duedate).toISOString().split("T")[0] === today;

  /**
   * Handles subtask completion toggle with milestone notifications
   * 
   * @param {number} index - Index of the subtask to toggle
   */
  const handleSubtaskToggle = async (index: number) => {
    try {
      const newState = !task.completedSubtasks[index];
      await updateSubtaskCompletion(task.id!, index, newState);

      // Check for milestone achievements
      const newCompletedSubtasks = [...task.completedSubtasks];
      newCompletedSubtasks[index] = newState;
      const completedCount = newCompletedSubtasks.filter(Boolean).length;
      const totalSubtasks = task.subtasks.length;

      // Send webhook for subtask milestones
      if (newState && completedCount === totalSubtasks) {
        await sendTaskWebhook(
          `${name} completed all subtasks for ${getTaskDescription(task)} 🎉`,
          task,
          "subtask_milestone"
        );
      } else if (newState && completedCount === Math.ceil(totalSubtasks / 2) && totalSubtasks > 2) {
        await sendTaskWebhook(
          `${name} reached halfway point (${completedCount}/${totalSubtasks} subtasks) for "${task.task}"`,
          task,
          "subtask_progress"
        );
      }
    } catch (error) {
      console.error("Failed to update subtask:", error);
      toast.error("Failed to update subtask");
    }
  };

  /**
   * Handles task completion with webhook notification
   */
  const handleCompleteTask = async () => {
    try {
      await completeTask(task.id!);
      await sendTaskWebhook(
        `${name} completed ${getTaskDescription(task)} ✅`,
        task,
        "completion"
      );
      toast.success("Task completed!");
    } catch (error) {
      console.error("Failed to complete task:", error);
      toast.error("Failed to complete task");
    }
  };

  /**
   * Handles task deletion with webhook notification
   */
  const handleDeleteTask = async () => {
    try {
      await removeTask(task.id!);
      await sendTaskWebhook(
        `${name} deleted ${getTaskDescription(task)} 🗑️`,
        task,
        "deletion"
      );
      toast.success("Task deleted!");
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("Failed to delete task");
    }
  };

  /**
   * Calculates subtask progress
   * 
   * @returns {Object} Progress statistics
   */
  const getSubtaskProgress = () => {
    const completed = task.completedSubtasks.filter(Boolean).length;
    const total = task.subtasks.length;
    return {
      completed,
      total,
      percentage: total > 0 ? (completed / total) * 100 : 0,
    };
  };

  const progress = getSubtaskProgress();

  return (
    <div
      className={cn(
        "group bg-background border rounded-lg p-4 hover:shadow-md transition-all duration-200",
        "border-l-6",
        isOverdue && "border-l-red-900",
        isDueToday && "border-l-orange-200"
      )}
    >
      {/* Main Task Row */}
      <div className="flex items-start gap-3">
        {/* Complete Button */}
        <Button
          variant={"outline"}
          size={"sm"}
          className="w-8 h-8"
          onClick={handleCompleteTask}
        >
          <FaCircle className="opacity-0" />
        </Button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          {/* Task Title and Priority */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-base truncate">{task.task}</h3>
            {task.priority > 2 && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  priorityInfo.textColor,
                  priorityInfo.color
                )}
              >
                {priorityInfo.label}
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                Overdue
              </Badge>
            )}
            {isDueToday && (
              <Badge className="text-xs bg-orange-100 text-orange-800">
                Due Today
              </Badge>
            )}
          </div>

          {/* Task Meta */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
            <span
              className={cn(
                isOverdue && "text-red-600 font-medium",
                isDueToday && "text-orange-600 font-medium"
              )}
            >
              Due: {new Date(task.duedate).toLocaleDateString()}
            </span>
          </div>

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} noHover />
              ))}
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks.length > 0 && (
            <div className="space-y-2">
              {/* Progress Bar */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 bg-muted rounded-full h-1">
                  <div
                    className="bg-primary h-1 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                <span>
                  {progress.completed}/{progress.total}
                </span>
              </div>

              {/* Subtask List */}
              <div className="space-y-1">
                {task.subtasks.map((subtask, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Checkbox
                      checked={task.completedSubtasks[index] || false}
                      onCheckedChange={() => handleSubtaskToggle(index)}
                      className="h-3 w-3"
                      id={`${task.task}-${subtask}`}
                    />
                    <Label
                      htmlFor={`${task.task}-${subtask}`}
                      className={cn(
                        "text-sm flex-1",
                        task.completedSubtasks[index] &&
                          "line-through text-muted-foreground"
                      )}
                    >
                      {subtask}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={() => onEdit(task)}>
            <FaEdit />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDeleteTask}
          >
            <FaTrash />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Edit Task Dialog Component with Webhook Integration
 * 
 * @param {Object} props - Component props
 * @param {Task | null} props.task - Task to edit
 * @param {Function} props.onClose - Close callback
 * @returns {JSX.Element} Edit dialog with webhook notifications
 */
function EditTaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }): JSX.Element {
  const { updateTask } = useTask();
  const { name, webhook } = useConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<TaskEditForm>({
    resolver: zodResolver(taskEditSchema),
  });

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      reset({
        task: task.task,
        duedate: task.duedate.toISOString().split("T")[0],
        priority: task.priority,
        tags: task.tags.join(", "),
        subtasks: task.subtasks.join(", "),
      });
    }
  }, [task, reset]);

  /**
   * Handles form submission with webhook notification
   * 
   * @param {TaskEditForm} data - Form data
   */
  const onSubmit = async (data: TaskEditForm) => {
    if (!task) return;

    setIsSubmitting(true);
    try {
      const tags = data.tags
        ? data.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      const subtasks = data.subtasks
        ? data.subtasks
            .split(",")
            .map((subtask) => subtask.trim())
            .filter(Boolean)
        : [];

      await updateTask(task.id!, {
        task: data.task,
        duedate: new Date(data.duedate),
        priority: data.priority,
        tags,
        subtasks,
      });

      // Send webhook for task update
      if (name && webhook) {
        const priorityInfo = PRIORITY_LABELS[data.priority as keyof typeof PRIORITY_LABELS];
        const dueDate = new Date(data.duedate).toLocaleDateString();
        const tagsContext = tags.length > 0 ? ` with tags: ${tags.map(t => `#${t}`).join(", ")}` : "";
        
        await sendMessage(
          `${name} updated task "${data.task}" - ${priorityInfo.label.toLowerCase()} priority, due ${dueDate}${tagsContext} ✏️`,
          webhook
        );
      }

      toast.success("Task updated successfully!");
      onClose();
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Failed to update task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update your task details below</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="task">Task Title</Label>
            <Input
              id="task"
              {...register("task")}
              className={cn(errors.task && "border-red-500")}
            />
            {errors.task && (
              <p className="text-sm text-red-500">{errors.task.message}</p>
            )}
          </div>

          {/* Due Date and Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duedate">Due Date</Label>
              <Input
                id="duedate"
                type="date"
                {...register("duedate")}
                className={cn(errors.duedate && "border-red-500")}
              />
              {errors.duedate && (
                <p className="text-xs text-red-500">{errors.duedate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={task?.priority.toString()}
                onValueChange={(value) => setValue("priority", parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              placeholder="work, project (comma-separated)"
              {...register("tags")}
            />
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label htmlFor="subtasks">Subtasks</Label>
            <Textarea
              id="subtasks"
              placeholder="Task 1, Task 2 (comma-separated)"
              rows={3}
              {...register("subtasks")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Loading Skeleton Component
 * 
 * @returns {JSX.Element} Loading state skeleton
 */
function TodoPageSkeleton(): JSX.Element {
  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <Skeleton className="h-12 w-full" />

          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-32" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-20 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <Skeleton className="h-6 w-16 mb-4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-6 w-20 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}