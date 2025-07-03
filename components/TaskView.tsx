/**
 * 
 * @deprecated Replaced with new QuickTaskAdd component, will be removed in v0.8.4-alpha
 */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { FaCheck, FaPlus } from "react-icons/fa6";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { useTask } from "@/hooks/useTask";
import { useEffect } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { useForm } from "react-hook-form";
import { FaTrash } from "react-icons/fa";
import { Card } from "./ui/card";
import TagBadge from "./TagBadge";
import { useConfig } from "@/hooks/useConfig";
import { sendMessage } from "@/lib/webhook";

export default function TaskView() {
  const { loadTasks, addTask, removeTask, tasks } = useTask();
  const { name, webhook } = useConfig();

  useEffect(() => {
    async function load() {
      await loadTasks();
      console.log("Loaded tasks", tasks);
    }
    load();
  }, [loadTasks]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="self-end text-xs">
          <FaCheck />
          Todo
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className={cn("my-1.5 mx-4")}>
        <TaskViewTopBar addTask={addTask} />
        <Separator className="my-2" />

        {tasks.length < 1 ? (
          <div className="text-muted-foreground text-xs text-center">
            <span>Nothing to see here.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task, index) => (
              <Card
                key={task.id ?? index}
                className="border-accent border-2 py-2 px-3 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{task.task}</span>
                  {task.duedate && (
                    <span className="text-xs text-muted-foreground">
                      Due: {new Date(task.duedate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {task.tags.map((t) => (
                    <TagBadge noHover tag={t} key={t} />
                  ))}
                </div>
                <ol>
                  {task.subtasks.map((subtask, index) => (
                    <li
                      className="list-decimal list-inside text-xs"
                      key={index}
                    >
                      {subtask}
                    </li>
                  ))}
                </ol>
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-end text-xs"
                  onClick={() => {
                    removeTask(task.id!);
                    sendMessage(
                      `${name} marked a task as completed: ${task.task}`,
                      webhook
                    );
                  }}
                >
                  <FaTrash /> Complete
                </Button>
              </Card>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
function TaskViewTopBar({
  addTask,
}: {
  addTask: (
    task: string,
    subtasks: string[],
    duedate: Date,
    tags: string[]
  ) => Promise<void>;
}) {
  const { register, handleSubmit, reset, formState } = useForm<{
    task: string;
    subtasks: string;
    duedate: string;
    tags: string;
  }>({
    defaultValues: {
      task: "",
      subtasks: "",
      duedate: "",
      tags: "",
    },
  });
  const { name, webhook } = useConfig();

  const onSubmit = async (data: {
    task: string;
    subtasks: string;
    duedate: string;
    tags: string;
  }) => {
    const { task, subtasks, duedate, tags } = data;
    const parsedSubtasks = subtasks
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await addTask(task.trim(), parsedSubtasks, new Date(duedate), parsedTags);
    sendMessage(`${name} added a new task: ${task}.`, webhook);
    reset(); // clear the form
  };

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-semibold">Todo List</h1>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant={"ghost"} className="size-7">
            <FaPlus />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" className={cn("mx-1.5 my-2.5")}>
          <form
            className="flex flex-col gap-2 w-64"
            onSubmit={handleSubmit(onSubmit)}
          >
            <Label>Task Name</Label>
            <Input {...register("task", { required: true })} />

            <Label>Subtasks (comma-separated)</Label>
            <Input {...register("subtasks")} />

            <Label>Due Date</Label>
            <Input type="date" {...register("duedate", { required: true })} />

            <Label>Tags (comma-separated)</Label>
            <Input {...register("tags")} />

            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Creating..." : "Create"}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
