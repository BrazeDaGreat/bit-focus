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
import { Controller, useForm } from "react-hook-form";
import { FaPencil } from "react-icons/fa6";
import { z } from "zod";

const formSchema = z.object({
  tag: z.string().min(1, "Tag is required"),
  startDate: z.string().min(1, "Start date is required"),
  minutes: z.coerce.number().min(0, "Minutes must be a positive number"),
  seconds: z.coerce.number().min(0, "Seconds must be a positive number"),
});

type FormData = z.infer<typeof formSchema>;

interface EditFocusSessionProps {
  item: FocusSession;
  setIsDropdownOpen: (state: boolean) => void;
}

export function EditFocusSession({
  item,
  setIsDropdownOpen,
}: EditFocusSessionProps) {
  const { editFocusSession } = useFocus();
  const [isDialogOpen, setIsDialogOpen] = useState(false);


  const time = calculateTime(item.startTime, item.endTime, "M:S");
  const defaultMinutes = time.minutes || 0;
  const defaultSeconds = time.seconds;

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

  const onSubmit = (data: FormData) => {
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
