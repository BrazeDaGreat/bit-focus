import { useIsMobile } from "@/hooks/useIsMobile";
import { useConfig } from "@/hooks/useConfig";
import { useForm } from "react-hook-form";
import { FaPencil } from "react-icons/fa6";
import { toast } from "sonner";
import { LuChevronsUpDown } from "react-icons/lu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import dayjs from "dayjs";


export const EditConfigSkeleton = () => {
  return <div className="h-[74px] flex flex-col items-center justify-center">
    <Skeleton className="w-full h-full" />
  </div>
}

const EditConfig = () => {
  const { name, dob, setConfig, webhook } = useConfig();
  const isMobile = useIsMobile();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: name === "NULL" ? "" : name,
      day: dob ? new Date(dob).getDate() : "",
      month: dob ? new Date(dob).getMonth() + 1 : "",
      webhook: webhook ?? "",
      year: dob ? new Date(dob).getFullYear() : "",
    },
  });

  const calculateAge = () => {
    const today = dayjs();
    const birthDate = dayjs(dob);
  
    const years = today.diff(birthDate, 'year');
    const months = today.diff(birthDate.add(years, 'year'), 'month');
    const days = today.diff(birthDate.add(years, 'year').add(months, 'month'), 'day');
    return { years, months, days}
  };

  const { years, months, days } = calculateAge();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
    const { name, day, month, year, webhook } = data;
    const dateOfBirth = new Date(year, month - 1, day);
    toast("Config updated successfully.", { icon: <FaPencil /> });
    setConfig(name, dateOfBirth, webhook);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full flex h-max items-start justify-between"
        >
          <div className="flex flex-col items-start gap-1 pb-2">
            {name === "NULL" ? (
              <span className="text-lg">Hello</span>
            ) : (
              <div className="flex gap-2 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.dicebear.com/9.x/shapes/svg?seed=${name}`} alt="avatar" className="w-6 h-6 rounded-full shadow-md" />
                <span className="text-lg"> Hello, {name}</span>
              </div>
            )}
            <span className="text-xs">
              Age: {years}y {months}m {days}d
            </span>
          </div>
          <div className="h-full flex items-center">
            <LuChevronsUpDown />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 m-2" side={isMobile ? "bottom" : "right"} sideOffset={10}>
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Edit Details</h4>
          </div>
          <form
            className="flex flex-col gap-2"
            onSubmit={handleSubmit(onSubmit)}
          >
            <Label className="text-xs opacity-90" htmlFor="name">
              Name
            </Label>
            <Input
              id="name"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <span className="text-red-500 text-xs">
                {errors.name.message}
              </span>
            )}

            <Label className="text-xs opacity-90" htmlFor="dob">
              Date of Birth
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="DD"
                {...register("day", {
                  required: "Day is required",
                  valueAsNumber: true,
                  min: { value: 1, message: "Invalid day" },
                  max: { value: 31, message: "Invalid day" },
                })}
              />
              <Input
                type="number"
                placeholder="MM"
                {...register("month", {
                  required: "Month is required",
                  valueAsNumber: true,
                  min: { value: 1, message: "Invalid month" },
                  max: { value: 12, message: "Invalid month" },
                })}
              />
              <Input
                type="number"
                placeholder="YYYY"
                {...register("year", {
                  required: "Year is required",
                  valueAsNumber: true,
                  min: { value: 1900, message: "Invalid year" },
                  max: {
                    value: new Date().getFullYear(),
                    message: "Invalid year",
                  },
                })}
              />
            </div>
            {errors.day && (
              <span className="text-red-500 text-xs">{errors.day.message}</span>
            )}
            {errors.month && (
              <span className="text-red-500 text-xs">
                {errors.month.message}
              </span>
            )}
            {errors.year && (
              <span className="text-red-500 text-xs">
                {errors.year.message}
              </span>
            )}

            <Label className="text-xs opacity-90" htmlFor="name">
              Webhook URL
            </Label>
            <Input
              id="webhook"
              {...register("webhook", {
                validate: (value: string) => {
                  if (value && !/^https?:\/\/.+\..+/.test(value)) {
                    return "Invalid webhook URL";
                  }
                  return true;
                },
              })}
            />
            {errors.webhook && (
              <span className="text-red-500 text-xs">
                {errors.webhook.message}
              </span>
            )}

            <Button type="submit" variant="outline" className="mt-2">
              Save
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
};
export default EditConfig;