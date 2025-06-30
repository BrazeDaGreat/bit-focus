/**
 * Edit Focus Session Component - Modal Form for Modifying Focus Session Data
 *
 * This component provides a dialog-based interface for editing existing focus sessions.
 * It allows users to modify session tags, start dates, and duration (minutes/seconds).
 * The component integrates with React Hook Form for form management and Zod for
 * validation, ensuring data integrity and user-friendly error handling.
 *
 * Features:
 * - Modal dialog interface with form validation
 * - Real-time form validation with error messages
 * - Integration with focus sessions database
 * - Automatic calculation of end time based on duration
 * - Responsive form layout with proper accessibility
 *
 * Dependencies:
 * - React Hook Form for form state management
 * - Zod for schema validation
 * - Radix UI components for dialog and form elements
 *
 * @fileoverview Edit focus session modal dialog component
 * @author BIT Focus Development Team
 * @since v0.2.0-alpha
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FocusSession, useFocus } from "@/hooks/useFocus";
import { calculateTime } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import type { JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { FaPencil } from "react-icons/fa6";
import { z } from "zod";

/**
 * Zod schema for form validation
 * Defines validation rules for all form fields including required fields
 * and minimum value constraints for numeric inputs
 */
const formSchema = z.object({
  tag: z.string().min(1, "Tag is required"),
  startDate: z.string().min(1, "Start date is required"),
  minutes: z.coerce.number().min(0, "Minutes must be a positive number"),
  seconds: z.coerce.number().min(0, "Seconds must be a positive number"),
});

/**
 * Type definition for form data based on the Zod schema
 */
type FormData = z.infer<typeof formSchema>;

/**
 * Props interface for the EditFocusSession component
 */
interface EditFocusSessionProps {
  /** The focus session item to be edited */
  item: FocusSession;
  /** Callback function to control the parent dropdown state */
  setIsDropdownOpen: (state: boolean) => void;
}

/**
 * Edit Focus Session Component
 *
 * Renders a modal dialog form that allows users to edit existing focus sessions.
 * The component calculates the current session duration and pre-fills the form
 * with existing values. On submission, it updates the session in the database
 * with the new values and closes both the dialog and parent dropdown.
 *
 * The form includes validation for all fields and provides real-time feedback
 * for validation errors. The start date and duration are used to calculate
 * the new end time for the session.
 *
 * @component
 * @param {EditFocusSessionProps} props - Component props
 * @param {FocusSession} props.item - The focus session to edit
 * @param {function} props.setIsDropdownOpen - Function to control dropdown state
 * @returns {JSX.Element} The edit focus session dialog component
 *
 * @example
 * ```tsx
 * <EditFocusSession
 *   item={focusSession}
 *   setIsDropdownOpen={setDropdownOpen}
 * />
 * ```
 *
 * @see {@link FocusSession} for the session data structure
 * @see {@link useFocus} for focus session management hooks
 */
export function EditFocusSession({
  item,
  setIsDropdownOpen,
}: EditFocusSessionProps): JSX.Element {
  const { editFocusSession } = useFocus();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Calculate current session duration for form defaults
  const time = calculateTime(item.startTime, item.endTime, "M:S");
  const defaultMinutes = time.minutes || 0;
  const defaultSeconds = time.seconds;

  // Initialize form with React Hook Form and Zod validation
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tag: item.tag,
      startDate: item.startTime.toISOString().split("T")[0],
      minutes: defaultMinutes,
      seconds: defaultSeconds,
    },
  });

  /**
   * Form submission handler
   *
   * Processes the form data and updates the focus session in the database.
   * Calculates the new end time based on the start date and duration,
   * then calls the edit function and closes all dialogs.
   *
   * @param {FormData} data - The validated form data
   * @returns {void}
   *
   * @example
   * ```tsx
   * // Called automatically when form is submitted
   * onSubmit({
   *   tag: "Work",
   *   startDate: "2024-01-15",
   *   minutes: 45,
   *   seconds: 30
   * });
   * ```
   */
  const onSubmit = (data: FormData): void => {
    const newStartTime = new Date(data.startDate);
    const newEndTime = new Date(
      newStartTime.getTime() + data.minutes * 60000 + data.seconds * 1000
    );

    editFocusSession(item.id!, {
      id: item.id,
      tag: data.tag,
      startTime: newStartTime,
      endTime: newEndTime,
    });

    setIsDialogOpen(false);
    setIsDropdownOpen(false);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      {/* Dialog Trigger - Dropdown Menu Item */}
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setIsDialogOpen(true);
          }}
        >
          <FaPencil />
          <span>Edit</span>
        </DropdownMenuItem>
      </DialogTrigger>

      {/* Dialog Content */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Focus Session</DialogTitle>
          <DialogDescription>
            Modify your focus session details below.
          </DialogDescription>
        </DialogHeader>

        {/* Edit Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-2 pb-4">
            {/* Tag Field */}
            <div className="space-y-2">
              <Label htmlFor="tag">Tag</Label>
              <Controller
                name="tag"
                control={control}
                render={({ field }) => (
                  <Input
                    id="tag"
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
              <Label htmlFor="startDate">Start Date</Label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <Input
                    id="startDate"
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

            {/* Duration Fields Container */}
            <div className="flex items-center gap-4">
              {/* Minutes Field */}
              <div className="space-y-2 flex-1">
                <Label htmlFor="minutes">Minutes</Label>
                <Controller
                  name="minutes"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="minutes"
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
                <Label htmlFor="seconds">Seconds</Label>
                <Controller
                  name="seconds"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="seconds"
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

          {/* Dialog Footer with Action Buttons */}
          <DialogFooter>
            <Button type="submit">Save Changes</Button>
            <DialogClose asChild onClick={() => setIsDropdownOpen(false)}>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
