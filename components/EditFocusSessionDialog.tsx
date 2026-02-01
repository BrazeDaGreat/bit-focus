/**
 * Edit Focus Session Dialog Component - Standalone Modal for Editing Focus Sessions
 *
 * This component provides a reusable dialog for editing focus sessions that can be
 * controlled externally via props. It's designed to be used in various contexts like
 * the calendar view or anywhere else session editing is needed.
 *
 * @fileoverview Standalone edit focus session dialog component
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FocusSession, useFocus } from "@/hooks/useFocus";
import { calculateTime } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

/**
 * Zod schema for form validation
 */
const formSchema = z.object({
  tag: z.string().min(1, "Tag is required"),
  startDate: z.string().min(1, "Start date is required"),
  startHour: z.coerce.number().min(1).max(12),
  startMinute: z.coerce.number().min(0).max(59),
  startPeriod: z.enum(["AM", "PM"]),
  minutes: z.coerce.number().min(0, "Minutes must be a positive number"),
  seconds: z.coerce.number().min(0, "Seconds must be a positive number"),
});

type FormData = z.infer<typeof formSchema>;

/**
 * Props interface for the EditFocusSessionDialog component
 */
interface EditFocusSessionDialogProps {
  /** The focus session to edit */
  session: FocusSession | null;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Standalone Edit Focus Session Dialog
 *
 * A reusable dialog component for editing focus sessions that can be
 * controlled externally. This is useful for contexts where the trigger
 * is not a dropdown menu item (e.g., calendar view).
 */
export function EditFocusSessionDialog({
  session,
  open,
  onOpenChange,
}: EditFocusSessionDialogProps): JSX.Element | null {
  const { editFocusSession } = useFocus();

  // Calculate defaults from session
  const getDefaults = (item: FocusSession) => {
    const time = calculateTime(item.startTime, item.endTime, "M:S");
    const defaultMinutes = "minutes" in time ? time.minutes : 0;
    const defaultSeconds = time.seconds;

    const existingHours = item.startTime.getHours();
    const defaultHour =
      existingHours === 0
        ? 12
        : existingHours > 12
          ? existingHours - 12
          : existingHours;
    const defaultMinute = item.startTime.getMinutes();
    const defaultPeriod: "AM" | "PM" = existingHours >= 12 ? "PM" : "AM";

    return {
      tag: item.tag,
      startDate: item.startTime.toISOString().split("T")[0],
      startHour: defaultHour,
      startMinute: defaultMinute,
      startPeriod: defaultPeriod,
      minutes: defaultMinutes,
      seconds: defaultSeconds,
    };
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: session ? getDefaults(session) : undefined,
  });

  // Reset form when session changes
  useEffect(() => {
    if (session) {
      reset(getDefaults(session));
    }
  }, [session, reset]);

  const onSubmit = (data: FormData): void => {
    if (!session?.id) return;

    // Convert 12-hour format to 24-hour format
    let hour24 = data.startHour;
    if (data.startPeriod === "AM") {
      hour24 = data.startHour === 12 ? 0 : data.startHour;
    } else {
      hour24 = data.startHour === 12 ? 12 : data.startHour + 12;
    }

    // Create new start time with both date and time
    const newStartTime = new Date(data.startDate);
    newStartTime.setHours(hour24, data.startMinute, 0, 0);

    const newEndTime = new Date(
      newStartTime.getTime() + data.minutes * 60000 + data.seconds * 1000,
    );

    editFocusSession(session.id, {
      id: session.id,
      tag: data.tag,
      startTime: newStartTime,
      endTime: newEndTime,
    });

    onOpenChange(false);
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Focus Session</DialogTitle>
          <DialogDescription>
            Modify your focus session details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-2 pb-4">
            {/* Tag Field */}
            <div className="space-y-2">
              <Label htmlFor="edit-tag">Tag</Label>
              <Controller
                name="tag"
                control={control}
                render={({ field }) => (
                  <Input
                    id="edit-tag"
                    placeholder="Enter tag"
                    {...field}
                    className={errors.tag ? "border-red-500" : ""}
                  />
                )}
              />
              {errors.tag && (
                <p className="text-sm text-red-500">{errors.tag.message}</p>
              )}
            </div>

            {/* Start Date Field */}
            <div className="space-y-2">
              <Label htmlFor="edit-startDate">Start Date</Label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <Input
                    id="edit-startDate"
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
                      id="edit-startHour"
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
                      id="edit-startMinute"
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
                <Label htmlFor="edit-minutes">Minutes</Label>
                <Controller
                  name="minutes"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="edit-minutes"
                      type="number"
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
                <Label htmlFor="edit-seconds">Seconds</Label>
                <Controller
                  name="seconds"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="edit-seconds"
                      type="number"
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
            <Button type="submit">Save Changes</Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
