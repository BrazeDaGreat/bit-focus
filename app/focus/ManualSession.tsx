/**
 * Manual Session Component - Dialog for Manually Logging Focus Sessions
 *
 * Provides a dialog for adding a focus session after the fact, for cases
 * where a session was not recorded with the timer. Mirrors the form layout
 * of the Edit Focus Session dialog (tag, start date, 12-hour start time,
 * duration) and saves through the useFocus store.
 *
 * @fileoverview Manual focus session entry dialog component
 * @author BIT Focus Development Team
 * @since v0.18.4
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocus } from "@/hooks/useFocus";
import { useTag } from "@/hooks/useTag";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import type { JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { FaPlus } from "react-icons/fa6";
import { z } from "zod";
import dayjs from "dayjs";

/**
 * Zod schema for form validation
 *
 * Same field shape as the edit dialog, with an extra rule that the
 * total duration must be greater than zero.
 */
const formSchema = z
  .object({
    tag: z.string().min(1, "Tag is required"),
    startDate: z.string().min(1, "Start date is required"),
    startHour: z.coerce.number().min(1).max(12),
    startMinute: z.coerce.number().min(0).max(59),
    startPeriod: z.enum(["AM", "PM"]),
    minutes: z.coerce.number().min(0, "Minutes must be a positive number"),
    seconds: z.coerce.number().min(0, "Seconds must be a positive number"),
  })
  .refine((data) => data.minutes > 0 || data.seconds > 0, {
    message: "Duration must be greater than zero",
    path: ["minutes"],
  });

type FormData = z.infer<typeof formSchema>;

/**
 * Builds default form values for a new manual session
 *
 * Defaults to today's date and the current time so the user only
 * needs to adjust what differs from "right now".
 */
const getDefaults = (): FormData => {
  const now = new Date();
  const hours = now.getHours();
  return {
    tag: "",
    startDate: dayjs(now).format("YYYY-MM-DD"),
    startHour: hours === 0 ? 12 : hours > 12 ? hours - 12 : hours,
    startMinute: now.getMinutes(),
    startPeriod: hours >= 12 ? "PM" : "AM",
    minutes: 25,
    seconds: 0,
  };
};

/**
 * Manual Session Dialog
 *
 * Renders a "Manual" trigger button and a dialog form for logging a
 * focus session that was missed. On save, the session is persisted via
 * the useFocus store and appears in the session log immediately.
 *
 * @component
 * @returns {JSX.Element} Dialog trigger button and manual entry form
 *
 * @example
 * ```tsx
 * // Next to the Details button in the session log header
 * <ManualSessionDialog />
 * ```
 */
export default function ManualSessionDialog(): JSX.Element {
  const { addFocusSession } = useFocus();
  const { savedTags } = useTag();
  const [open, setOpen] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(),
  });

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);
    if (nextOpen) {
      reset(getDefaults());
    }
  };

  const onSubmit = (data: FormData): void => {
    // Convert 12-hour format to 24-hour format
    let hour24 = data.startHour;
    if (data.startPeriod === "AM") {
      hour24 = data.startHour === 12 ? 0 : data.startHour;
    } else {
      hour24 = data.startHour === 12 ? 12 : data.startHour + 12;
    }

    const startTime = new Date(data.startDate);
    startTime.setHours(hour24, data.startMinute, 0, 0);

    const endTime = new Date(
      startTime.getTime() + data.minutes * 60000 + data.seconds * 1000,
    );

    addFocusSession(data.tag, startTime, endTime);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size={"sm"} variant={"outline"}>
          <FaPlus /> Manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Session Manually</DialogTitle>
          <DialogDescription>
            Log a focus session you forgot to record with the timer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-2 pb-4">
            {/* Tag Field */}
            <div className="space-y-2">
              <Label htmlFor="manual-tag">Tag</Label>
              <Controller
                name="tag"
                control={control}
                render={({ field }) => (
                  <Input
                    id="manual-tag"
                    placeholder="Enter tag"
                    {...field}
                    className={errors.tag ? "border-red-500" : ""}
                  />
                )}
              />
              {/* Saved tag quick-pick chips */}
              {savedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {savedTags.map((t) => (
                    <button
                      key={t.t}
                      type="button"
                      onClick={() =>
                        setValue("tag", t.t, { shouldValidate: true })
                      }
                      className="text-xs px-2.5 py-1 rounded-full font-medium transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: t.c + "33",
                        color: t.c,
                        border: `1px solid ${t.c}55`,
                      }}
                    >
                      {t.t}
                    </button>
                  ))}
                </div>
              )}
              {errors.tag && (
                <p className="text-sm text-red-500">{errors.tag.message}</p>
              )}
            </div>

            {/* Start Date Field */}
            <div className="space-y-2">
              <Label htmlFor="manual-startDate">Start Date</Label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <Input
                    id="manual-startDate"
                    type="date"
                    {...field}
                    className={errors.startDate ? "border-red-500" : ""}
                  />
                )}
              />
              {errors.startDate && (
                <p className="text-sm text-red-500">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            {/* Start Time Fields (12-hour format) */}
            <div className="space-y-2">
              <Label>Start Time</Label>
              <div className="flex items-center gap-2">
                {/* Hour Field */}
                <Controller
                  name="startHour"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="manual-startHour"
                      type="number"
                      min={1}
                      max={12}
                      placeholder="HH"
                      {...field}
                      className={`w-16 text-center ${errors.startHour ? "border-red-500" : ""}`}
                    />
                  )}
                />
                <span className="text-muted-foreground">:</span>
                {/* Minute Field */}
                <Controller
                  name="startMinute"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="manual-startMinute"
                      type="number"
                      min={0}
                      max={59}
                      placeholder="MM"
                      {...field}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        field.onChange(
                          isNaN(val) ? 0 : Math.min(59, Math.max(0, val)),
                        );
                      }}
                      className={`w-16 text-center ${errors.startMinute ? "border-red-500" : ""}`}
                    />
                  )}
                />
                {/* AM/PM Toggle */}
                <Controller
                  name="startPeriod"
                  control={control}
                  render={({ field }) => (
                    <div className="flex border rounded-md overflow-hidden">
                      <button
                        type="button"
                        onClick={() => field.onChange("AM")}
                        className={`px-3 py-2 text-sm transition-colors ${
                          field.value === "AM"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("PM")}
                        className={`px-3 py-2 text-sm transition-colors ${
                          field.value === "PM"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Duration Fields Container */}
            <div className="flex items-center gap-4">
              {/* Minutes Field */}
              <div className="space-y-2 flex-1">
                <Label htmlFor="manual-minutes">Minutes</Label>
                <Controller
                  name="minutes"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="manual-minutes"
                      type="number"
                      min={0}
                      {...field}
                      className={errors.minutes ? "border-red-500" : ""}
                    />
                  )}
                />
                {errors.minutes && (
                  <p className="text-sm text-red-500">
                    {errors.minutes.message}
                  </p>
                )}
              </div>

              {/* Seconds Field */}
              <div className="space-y-2 flex-1">
                <Label htmlFor="manual-seconds">Seconds</Label>
                <Controller
                  name="seconds"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="manual-seconds"
                      type="number"
                      min={0}
                      {...field}
                      className={errors.seconds ? "border-red-500" : ""}
                    />
                  )}
                />
                {errors.seconds && (
                  <p className="text-sm text-red-500">
                    {errors.seconds.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">Add Session</Button>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
