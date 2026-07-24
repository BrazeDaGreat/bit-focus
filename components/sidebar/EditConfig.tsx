import { useIsMobile } from "@/hooks/useIsMobile";
import { useConfig, type FeatureKey } from "@/hooks/useConfig";
import { useForm, Controller } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { FaPencil } from "react-icons/fa6";
import { toast } from "sonner";
import { LuChevronsUpDown } from "react-icons/lu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import CurrencySelect from "@/components/CurrencySelect";
import AccountPanel from "@/components/auth/AccountPanel";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";


const FEATURE_LIST: { key: FeatureKey; label: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "aiChat", label: "AI Chat" },
  { key: "excalidraw", label: "Excalidraw" },
  { key: "projects", label: "Projects" },
  { key: "rewards", label: "Rewards" },
];

/** Live on/off switches for optional pages. Disabled features hide their page. */
function FeatureToggles() {
  const { featureToggles, setFeatureToggle } = useConfig();

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs opacity-90">Feature Toggles</Label>
      <span className="text-[10px] text-muted-foreground">
        Turning a feature off hides its page
      </span>
      <div className="mt-1 flex flex-col gap-1.5">
        {FEATURE_LIST.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between px-0.5">
            <Label
              className="text-xs opacity-90 cursor-pointer"
              htmlFor={`feature-${key}`}
            >
              {label}
            </Label>
            <Switch
              id={`feature-${key}`}
              checked={featureToggles[key]}
              onCheckedChange={(checked) => setFeatureToggle(key, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const EditConfigSkeleton = () => {
  return <div className="h-[74px] flex flex-col items-center justify-center">
    <Skeleton className="w-full h-full" />
  </div>
}

/**
 * Just the form fields — can be embedded in any container (popover, dialog, etc.)
 */
export function EditConfigForm({ onSave }: { onSave?: () => void }) {
  const { name, dob, setConfig, webhook, currency, sendWebhookUpdates } = useConfig();
  const hasName = name && name !== "NULL" && name.trim() !== "";
  const hasDob = !!dob;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: {
      name: hasName ? name : "",
      day: hasDob && dob ? new Date(dob).getDate() : "",
      month: hasDob && dob ? new Date(dob).getMonth() + 1 : "",
      webhook: webhook ?? "",
      sendWebhookUpdates: sendWebhookUpdates ?? false,
      year: hasDob && dob ? new Date(dob).getFullYear() : "",
      currency: currency ?? "USD",
    },
  });

  const watchedWebhook = watch("webhook");
  const isWebhookPresent = !!(watchedWebhook && watchedWebhook.trim());
  const watchedDay = watch("day");
  const watchedMonth = watch("month");
  const watchedYear = watch("year");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
    const { name: formName, day, month, year, webhook: formWebhook, currency: formCurrency, sendWebhookUpdates: formSendWebhookUpdates } = data;
    const hasDobInput = !!(day && month && year);
    const dateOfBirth = hasDobInput ? new Date(year, month - 1, day) : null;
    toast("Config updated successfully.", { icon: <FaPencil /> });
    const hasWebhook = !!(formWebhook && formWebhook.trim());
    setConfig(
      formName.trim() || "NULL",
      dateOfBirth,
      formWebhook,
      formCurrency,
      hasWebhook ? formSendWebhookUpdates : false
    );
    onSave?.();
  };

  return (
    <div className="grid gap-4 p-4">
      {/* Account and sync sit above the local profile fields: connecting is the
          one thing here that changes where the data lives. */}
      <AccountPanel onNavigate={onSave} />

      <div className="space-y-1">
        <h4 className="font-medium leading-none text-sm">Edit Details</h4>
      </div>
      <form className="flex flex-col gap-2" onSubmit={handleSubmit(onSubmit)}>
        <Label className="text-xs opacity-90" htmlFor="cfg-name">Name</Label>
        <Input id="cfg-name" {...register("name")} />

        <Label className="text-xs opacity-90" htmlFor="cfg-dob">Date of Birth</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="DD"
            {...register("day", {
              validate: (val) => {
                const dayVal = Number(val);
                if (!val && !watchedMonth && !watchedYear) return true;
                if (!val) return "Day is required";
                if (isNaN(dayVal) || dayVal < 1 || dayVal > 31) return "Invalid day";
                return true;
              }
            })}
          />
          <Input
            type="number"
            placeholder="MM"
            {...register("month", {
              validate: (val) => {
                const monthVal = Number(val);
                if (!val && !watchedDay && !watchedYear) return true;
                if (!val) return "Month is required";
                if (isNaN(monthVal) || monthVal < 1 || monthVal > 12) return "Invalid month";
                return true;
              }
            })}
          />
          <Input
            type="number"
            placeholder="YYYY"
            {...register("year", {
              validate: (val) => {
                const yearVal = Number(val);
                if (!val && !watchedDay && !watchedMonth) return true;
                if (!val) return "Year is required";
                const currentYear = new Date().getFullYear();
                if (isNaN(yearVal) || yearVal < 1900 || yearVal > currentYear) return "Invalid year";
                return true;
              }
            })}
          />
        </div>
        {errors.day && <span className="text-red-500 text-xs">{errors.day.message}</span>}
        {errors.month && <span className="text-red-500 text-xs">{errors.month.message}</span>}
        {errors.year && <span className="text-red-500 text-xs">{errors.year.message}</span>}

        <Label className="text-xs opacity-90" htmlFor="cfg-webhook">Webhook URL</Label>
        <Input id="cfg-webhook" {...register("webhook", { validate: (value: string) => { if (value && !/^https?:\/\/.+\..+/.test(value)) return "Invalid webhook URL"; return true; } })} />
        {errors.webhook && <span className="text-red-500 text-xs">{errors.webhook.message}</span>}

        <div className="flex items-center justify-between py-1.5 px-0.5">
          <div className="flex flex-col gap-0.5">
            <Label
              className={cn(
                "text-xs opacity-90 cursor-pointer transition-opacity",
                !isWebhookPresent && "opacity-40 cursor-not-allowed"
              )}
              htmlFor="cfg-sendWebhookUpdates"
            >
              Send status updates
            </Label>
            <span className="text-[10px] text-muted-foreground">
              Notify Discord when starting/completing timers
            </span>
          </div>
          <Controller
            control={control}
            name="sendWebhookUpdates"
            render={({ field }) => (
              <Switch
                id="cfg-sendWebhookUpdates"
                checked={isWebhookPresent ? field.value : false}
                onCheckedChange={field.onChange}
                disabled={!isWebhookPresent}
              />
            )}
          />
        </div>

        <Label className="text-xs opacity-90" htmlFor="cfg-currency">Preferred Currency</Label>
        <Controller
          control={control}
          name="currency"
          render={({ field }) => (
            <CurrencySelect
              id="cfg-currency"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <div className="mt-2 border-t pt-3">
          <FeatureToggles />
        </div>

        <Button type="submit" variant="outline" className="mt-2">Save</Button>
      </form>
    </div>
  );
}

const EditConfig = () => {
  const { name, dob, setConfig, webhook, currency, sendWebhookUpdates } = useConfig();
  const isMobile = useIsMobile();
  const hasName = name && name !== "NULL" && name.trim() !== "";
  const hasDob = !!dob;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: {
      name: hasName ? name : "",
      day: hasDob && dob ? new Date(dob).getDate() : "",
      month: hasDob && dob ? new Date(dob).getMonth() + 1 : "",
      webhook: webhook ?? "",
      sendWebhookUpdates: sendWebhookUpdates ?? false,
      year: hasDob && dob ? new Date(dob).getFullYear() : "",
      currency: currency ?? "USD",
    },
  });

  const watchedWebhook = watch("webhook");
  const isWebhookPresent = !!(watchedWebhook && watchedWebhook.trim());
  const watchedDay = watch("day");
  const watchedMonth = watch("month");
  const watchedYear = watch("year");

  const calculateAge = () => {
    const today = dayjs();
    const birthDate = dayjs(dob);

    const years = today.diff(birthDate, 'year');
    const months = today.diff(birthDate.add(years, 'year'), 'month');
    const days = today.diff(birthDate.add(years, 'year').add(months, 'month'), 'day');
    return { years, months, days}
  };

  const { years, months, days } = dob ? calculateAge() : { years: 0, months: 0, days: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
    const { name: formName, day, month, year, webhook: formWebhook, currency: formCurrency, sendWebhookUpdates: formSendWebhookUpdates } = data;
    const hasDobInput = !!(day && month && year);
    const dateOfBirth = hasDobInput ? new Date(year, month - 1, day) : null;
    toast("Config updated successfully.", { icon: <FaPencil /> });
    const hasWebhook = !!(formWebhook && formWebhook.trim());
    setConfig(
      formName.trim() || "NULL",
      dateOfBirth,
      formWebhook,
      formCurrency,
      hasWebhook ? formSendWebhookUpdates : false
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full flex h-max items-start justify-between"
        >
          <div className="flex flex-col items-start gap-1 pb-2">
            {!hasName ? (
              <span className="text-lg">Hello</span>
            ) : (
              <div className="flex gap-2 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.dicebear.com/9.x/shapes/svg?seed=${name}`} alt="avatar" className="w-6 h-6 rounded-full shadow-md" />
                <span className="text-lg"> Hello, {name}</span>
              </div>
            )}
            {hasName && dob && (
              <span className="text-xs">
                Age: {years}y {months}m {days}d
              </span>
            )}
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
              {...register("name")}
            />

            <Label className="text-xs opacity-90" htmlFor="dob">
              Date of Birth
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="DD"
                {...register("day", {
                  validate: (val) => {
                    const dayVal = Number(val);
                    if (!val && !watchedMonth && !watchedYear) return true;
                    if (!val) return "Day is required";
                    if (isNaN(dayVal) || dayVal < 1 || dayVal > 31) return "Invalid day";
                    return true;
                  }
                })}
              />
              <Input
                type="number"
                placeholder="MM"
                {...register("month", {
                  validate: (val) => {
                    const monthVal = Number(val);
                    if (!val && !watchedDay && !watchedYear) return true;
                    if (!val) return "Month is required";
                    if (isNaN(monthVal) || monthVal < 1 || monthVal > 12) return "Invalid month";
                    return true;
                  }
                })}
              />
              <Input
                type="number"
                placeholder="YYYY"
                {...register("year", {
                  validate: (val) => {
                    const yearVal = Number(val);
                    if (!val && !watchedDay && !watchedMonth) return true;
                    if (!val) return "Year is required";
                    const currentYear = new Date().getFullYear();
                    if (isNaN(yearVal) || yearVal < 1900 || yearVal > currentYear) return "Invalid year";
                    return true;
                  }
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

            <Label className="text-xs opacity-90" htmlFor="webhook">
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

            <div className="flex items-center justify-between py-1.5 px-0.5">
              <div className="flex flex-col gap-0.5">
                <Label
                  className={cn(
                    "text-xs opacity-90 cursor-pointer transition-opacity",
                    !isWebhookPresent && "opacity-40 cursor-not-allowed"
                  )}
                  htmlFor="sendWebhookUpdates"
                >
                  Send status updates
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Notify Discord when starting/completing timers
                </span>
              </div>
              <Controller
                control={control}
                name="sendWebhookUpdates"
                render={({ field }) => (
                  <Switch
                    id="sendWebhookUpdates"
                    checked={isWebhookPresent ? field.value : false}
                    onCheckedChange={field.onChange}
                    disabled={!isWebhookPresent}
                  />
                )}
              />
            </div>

            <Label className="text-xs opacity-90" htmlFor="currency">
              Preferred Currency
            </Label>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <CurrencySelect
                  id="currency"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />

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