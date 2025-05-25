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
import { useState } from "react";
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);

export default function Home() {
  const { theme } = useTheme();

  return (
    <div className="">
      <div
        className={cn("flex-1 p-4 gap-4 flex flex-col", "container mx-auto")}
      >
        <div>
          <h1 className="text-3xl font-bold">BIT Focus</h1>
          <span>Your minimalist productivity workspace.</span>
        </div>
        <div className={cn("flex gap-4", "flex-wrap", "my-8")}>
          <CardTimeFocused />
        </div>
        <div className={cn("flex")}>
          <SavedTags />
        </div>
        <h1 className="text-sm opacity-60 my-8">
          This feature is under development.
        </h1>
      </div>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

// Saved Tags
function SavedTags() {
  const { savedTags, addSavedTag, removeSavedTag } = useTag();
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const create = (data: any) => {
    const { tagname, color } = data;
    console.log(data);
    addSavedTag(tagname, color);
    setOpen(!open)
  };

  return (
    <Card className="px-4 py-6">
      <CardTitle className="flex gap-12 items-center justify-between">
        <div className="flex gap-2">
          <FaHashtag />
          <span>Saved Tags</span>
        </div>
        <Popover open={open}>
          <PopoverTrigger asChild>
            <Button variant={"ghost"} onClick={() => setOpen(!open)}>
              <FaPlus />
              <span>Add</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={handleSubmit(create)}
            >
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
                // onChange={() => {
                //   const el = document.querySelector(
                //     `#color_hex`
                //   ) as HTMLBaseElement;
                //   const c = document.querySelector(
                //     `#color`
                //   ) as HTMLInputElement;
                //   el.style.color = c.value;
                // }}
              />
              {errors.color && (
                <span className="text-red-500 text-xs">
                  {`${errors.color.message}`}
                </span>
              )}
              <div></div>
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
              <span className="flex items-center text-md italic">
               <FaHashtag /> {t.t}
              </span>
              <span onClick={() => removeSavedTag(t.t)} className="hover:-translate-y-0.5 cursor-pointer transition-all">
                <FaTrash />
              </span>
            </div>
          );
        })}
      </CardDescription>
    </Card>
  );
}

// Cards
function CardTimeFocused() {
  const { focusSessions, loadingFocusSessions } = useFocus();

  const today: FocusSession[] = [];
  const week: FocusSession[] = [];
  const month: FocusSession[] = [];

  focusSessions.forEach((session) => {
    const start = dayjs(session.startTime);
    if (start.isSameOrAfter(dayjs().subtract(1, "day"))) {
      today.push(session);
    }
    if (start.isBetween(dayjs().subtract(7, "day"), dayjs())) {
      week.push(session);
    }
    if (start.isBetween(dayjs().subtract(30, "day"), dayjs())) {
      month.push(session);
    }
  });

  // Calculate Times
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
