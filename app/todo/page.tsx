/**
 * Todo Page Component - Comprehensive Task Management Interface
 * 
 * This page provides a complete task management system with advanced sorting,
 * filtering, and organization capabilities. Updated to follow the consistent
 * card-based design system used throughout the BIT Focus application.
 * 
 * Features:
 * - Multiple sorting views (Time, Tags, Priority)
 * - Priority-based task organization (1-4 scale)
 * - Time-based categorization (Due Today, Tomorrow, etc.)
 * - Tag-based grouping for project organization
 * - Editable tasks with comprehensive form interface
 * - Checkable subtasks with progress tracking
 * - Visual priority indicators and due date warnings
 * - Consistent card-based layout design
 * - Real-time task statistics
 * 
 * View Modes:
 * - Time View: Groups tasks by due date categories
 * - Tags View: Groups tasks by assigned tags
 * - Priority View: Groups tasks by priority levels (4-1)
 * 
 * Dependencies:
 * - Enhanced useTask hook for state management
 * - UI components for consistent styling
 * - React Hook Form for task editing
 * - Theme system for consistent appearance
 * 
 * @fileoverview Comprehensive todo page with enhanced UI and task management
 * @author BIT Focus Development Team
 * @since v0.7.1-alpha
 * @updated v0.7.1-alpha - Enhanced UI consistency and edit capabilities
 */

"use client";

import { useEffect, useState, type JSX } from "react";
import { useTask, Task, TaskTimeCategory } from "@/hooks/useTask";
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
} from "react-icons/fa";
import { MdPriorityHigh } from "react-icons/md";
import { TbClockHeart } from "react-icons/tb";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import TagBadge from "@/components/TagBadge";

/**
 * View Mode Enumeration
 */
enum ViewMode {
  Time = "time",
  Tags = "tags", 
  Priority = "priority"
}

/**
 * Priority Label Mapping
 */
const PRIORITY_LABELS = {
  4: { label: "Urgent", color: "bg-red-500", textColor: "text-red-700" },
  3: { label: "High", color: "bg-orange-500", textColor: "text-orange-700" },
  2: { label: "Medium", color: "bg-yellow-500", textColor: "text-yellow-700" },
  1: { label: "Low", color: "bg-green-500", textColor: "text-green-700" }
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
 * Main Todo Page Component
 */
export default function TodoPage(): JSX.Element {
  const { theme } = useTheme();
  const {
    tasks,
    loadingTasks,
    loadTasks,
    removeTask,
    updateTask,
    getTasksByTimeCategory,
    getTasksByTag,
    getTasksByPriority
  } = useTask();

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Time);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Load tasks on component mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  /**
   * Calculates task statistics for the dashboard summary
   */
  const getTaskStats = () => {
    const timeGroups = getTasksByTimeCategory();
    const total = tasks.length;
    const overdue = timeGroups[TaskTimeCategory.Overdue].length;
    const dueToday = timeGroups[TaskTimeCategory.DueToday].length;
    const urgent = tasks.filter(task => task.priority === 4).length;
    
    return { total, overdue, dueToday, urgent };
  };

  const stats = getTaskStats();

  if (loadingTasks) {
    return <TodoPageSkeleton />;
  }

  return (
    <div className="flex-1 p-8 gap-8 flex flex-col">
      {/* Page Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">Todo</CardTitle>
              <CardDescription>
                Manage your tasks and stay organized
              </CardDescription>
            </div>
            
            {/* View Mode Selector */}
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <SelectTrigger className="w-48">
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
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <FaCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <TbClockHeart className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dueToday}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <FaExclamationTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <MdPriorityHigh className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urgent}</div>
          </CardContent>
        </Card>
      </div>

      {/* Task Groups Display */}
      <div className="space-y-6">
        {viewMode === ViewMode.Time && <TimeView />}
        {viewMode === ViewMode.Tags && <TagsView />}
        {viewMode === ViewMode.Priority && <PriorityView />}
      </div>

      {/* Edit Task Dialog */}
      <EditTaskDialog 
        task={editingTask} 
        onClose={() => setEditingTask(null)}
      />

      {/* Toast Notifications */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );

  /**
   * Time-based View Component
   */
  function TimeView(): JSX.Element {
    const timeGroups = getTasksByTimeCategory();

    return (
      <div className="space-y-4">
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
   */
  function TagsView(): JSX.Element {
    const tagGroups = getTasksByTag();

    return (
      <div className="space-y-4">
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
   */
  function PriorityView(): JSX.Element {
    const priorityGroups = getTasksByPriority();

    return (
      <div className="space-y-4">
        {Object.entries(priorityGroups)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([priority, tasks]) => {
            const priorityInfo = PRIORITY_LABELS[Number(priority) as keyof typeof PRIORITY_LABELS];
            return (
              <TaskGroup 
                key={priority} 
                title={`${priorityInfo.label} Priority`} 
                tasks={tasks}
                icon={<MdPriorityHigh />}
                badgeColor={priorityInfo.color}
                onEditTask={setEditingTask}
              />
            );
          })}
      </div>
    );
  }
}

/**
 * Task Group Component
 */
interface TaskGroupProps {
  title: string;
  tasks: Task[];
  icon: JSX.Element;
  isOverdue?: boolean;
  badgeColor?: string;
  onEditTask: (task: Task) => void;
}

function TaskGroup({ title, tasks, icon, isOverdue, badgeColor, onEditTask }: TaskGroupProps): JSX.Element {
  if (tasks.length === 0) return <></>;

  return (
    <Card className={cn(isOverdue && "border-red-500")}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span>{title}</span>
            <Badge variant="secondary" className={badgeColor}>
              {tasks.length}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onEdit={onEditTask} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Individual Task Card Component
 */
interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

function TaskCard({ task, onEdit }: TaskCardProps): JSX.Element {
  const { removeTask, updateTask } = useTask();
  const priorityInfo = PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS];
  const isOverdue = new Date(task.duedate) < new Date();
  const [completedSubtasks, setCompletedSubtasks] = useState<boolean[]>(
    new Array(task.subtasks.length).fill(false)
  );

  /**
   * Handles subtask completion toggle
   */
  const handleSubtaskToggle = (index: number) => {
    const newCompletedSubtasks = [...completedSubtasks];
    newCompletedSubtasks[index] = !newCompletedSubtasks[index];
    setCompletedSubtasks(newCompletedSubtasks);
  };

  /**
   * Calculates subtask progress
   */
  const getSubtaskProgress = () => {
    const completed = completedSubtasks.filter(Boolean).length;
    const total = task.subtasks.length;
    return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
  };

  const progress = getSubtaskProgress();

  return (
    <Card className={cn(
      "border-l-4",
      isOverdue && "border-l-red-500",
      task.priority === 4 && "border-l-red-400",
      task.priority === 3 && "border-l-orange-400",
      task.priority === 2 && "border-l-yellow-400",
      task.priority === 1 && "border-l-green-400"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{task.task}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={priorityInfo.textColor}>
                {priorityInfo.label}
              </Badge>
              <span className="text-sm">
                Due: {new Date(task.duedate).toLocaleDateString()}
              </span>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Subtasks */}
        {task.subtasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Subtasks</h4>
              <span className="text-xs text-muted-foreground">
                {progress.completed}/{progress.total} completed
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            
            {/* Subtask List */}
            <div className="space-y-2">
              {task.subtasks.map((subtask, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    id={`subtask-${task.id}-${index}`}
                    checked={completedSubtasks[index]}
                    onCheckedChange={() => handleSubtaskToggle(index)}
                  />
                  <label
                    htmlFor={`subtask-${task.id}-${index}`}
                    className={cn(
                      "text-sm cursor-pointer flex-1",
                      completedSubtasks[index] && "line-through text-muted-foreground"
                    )}
                  >
                    {subtask}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map(tag => (
              <TagBadge key={tag} tag={tag} noHover />
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(task)}
            className="gap-1"
          >
            <FaEdit className="h-3 w-3" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => removeTask(task.id!)}
            className="gap-1"
          >
            <FaTrash className="h-3 w-3" />
            Delete
          </Button>
        </div>
        <Button
          size="sm"
          onClick={() => removeTask(task.id!)}
          className="gap-1"
        >
          <FaCheck className="h-3 w-3" />
          Complete
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Edit Task Dialog Component
 */
interface EditTaskDialogProps {
  task: Task | null;
  onClose: () => void;
}

function EditTaskDialog({ task, onClose }: EditTaskDialogProps): JSX.Element {
  const { updateTask } = useTask();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue
  } = useForm<TaskEditForm>({
    resolver: zodResolver(taskEditSchema),
  });

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      reset({
        task: task.task,
        duedate: task.duedate.toISOString().split('T')[0],
        priority: task.priority,
        tags: task.tags.join(", "),
        subtasks: task.subtasks.join(", "),
      });
    }
  }, [task, reset]);

  /**
   * Handles form submission
   */
  const onSubmit = async (data: TaskEditForm) => {
    if (!task) return;

    setIsSubmitting(true);
    try {
      const tags = data.tags 
        ? data.tags.split(",").map(tag => tag.trim()).filter(Boolean)
        : [];
      
      const subtasks = data.subtasks
        ? data.subtasks.split(",").map(subtask => subtask.trim()).filter(Boolean)
        : [];

      await updateTask(task.id!, {
        task: data.task,
        duedate: new Date(data.duedate),
        priority: data.priority,
        tags,
        subtasks,
      });

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
          <DialogDescription>
            Update your task details below
          </DialogDescription>
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
 */
function TodoPageSkeleton(): JSX.Element {
  return (
    <div className="flex-1 p-8 gap-8 flex flex-col">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-48" />
          </div>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}