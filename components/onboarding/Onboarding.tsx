/**
 * Onboarding - First-Run Welcome and Profile Setup
 *
 * A guided, multi-step first-run experience that introduces BIT Focus and
 * collects the handful of settings the app needs to feel personal: a name,
 * date of birth, a starting set of focus tags, and optional Discord
 * notifications.
 *
 * Design language:
 * - The spine of the flow is a "focus dial" — a circular progress ring that
 *   fills as the user advances. BIT Focus is a timer-first app, so progress is
 *   expressed as the very dial the product is built around, with monospace
 *   numerals echoing the timer displays used elsewhere.
 * - All color is drawn from theme tokens (`--primary`, `--card`, `--border`,
 *   etc.) so the screen reads correctly across every theme variant.
 *
 * On completion the collected values are written through `useConfig.setConfig`
 * (which persists to IndexedDB) and `useTag.addSavedTag`. Writing a real name
 * flips the first-run gate in {@link AppShell}, swapping this flow out for the
 * full application.
 *
 * @fileoverview Multi-step onboarding for first-time users.
 * @author BIT Focus Development Team
 * @since v0.18.2-beta
 */

"use client";

import {
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import { useConfig } from "@/hooks/useConfig";
import { useTag } from "@/hooks/useTag";
import { useAuth } from "@/hooks/useAuth";
import { useSync } from "@/hooks/useSync";
import ProviderButtons from "@/components/auth/ProviderButtons";
import AccountAvatar from "@/components/auth/AccountAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import CurrencySelect from "@/components/CurrencySelect";
import ColorPicker from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dayjs from "dayjs";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaHashtag,
  FaStopwatch,
  FaBullseye,
  FaDiagramProject,
  FaTags,
  FaGift,
  FaPlus,
  FaBell,
  FaLock,
  FaCloudArrowDown,
  FaLaptop,
} from "react-icons/fa6";
import { THEMES } from "@/lib/ThemeManager";

// ── Static content ────────────────────────────────────────────────────────────

/** Ordered step metadata. `eyebrow` labels the dial; `title` heads the panel. */
const STEPS = [
  { eyebrow: "Welcome", title: "Focus, for a bit." },
  { eyebrow: "Account", title: "Been here before?" },
  { eyebrow: "Appearance", title: "Pick your palette." },
  { eyebrow: "Identity", title: "Who's focusing?" },
  { eyebrow: "Tags", title: "What will you track?" },
  { eyebrow: "Notifications", title: "Stay in the loop" },
  { eyebrow: "Ready", title: "You're all set." },
] as const;

/**
 * Selectable themes with representative swatches, sourced from the central
 * theme registry ({@link THEMES} in `lib/ThemeManager.ts`).
 */
const THEME_OPTIONS = THEMES;

/** Feature highlights shown on the welcome step. */
const FEATURES = [
  {
    icon: FaStopwatch,
    title: "Focus timer",
    desc: "Standard count-up or Pomodoro. Every session is logged.",
  },
  {
    icon: FaDiagramProject,
    title: "Projects",
    desc: "Group work into projects, milestones, and issues.",
  },
  {
    icon: FaTags,
    title: "Tags",
    desc: "Label time by what you were actually doing.",
  },
  {
    icon: FaGift,
    title: "Rewards",
    desc: "Turn focused hours into points you can spend.",
  },
] as const;

/** Suggested starter tags. Users toggle these or add their own. */
const PRESET_TAGS = [
  { t: "Deep Work", c: "#6366f1" },
  { t: "Study", c: "#10b981" },
  { t: "Coding", c: "#3b82f6" },
  { t: "Reading", c: "#f59e0b" },
  { t: "Writing", c: "#ec4899" },
  { t: "Design", c: "#14b8a6" },
  { t: "Exercise", c: "#ef4444" },
  { t: "Meditation", c: "#8b5cf6" },
] as const;

interface PickedTag {
  t: string;
  c: string;
}

// ── Focus dial ──────────────────────────────────────────────────────────────

/**
 * Focus Dial
 *
 * Circular progress ring that fills with the onboarding's completion fraction.
 * The center carries the step counter in monospace, mirroring the app's timer
 * displays.
 *
 * @param props.progress - Completion fraction in the range 0..1.
 * @param props.step - Zero-based index of the current step.
 * @param props.total - Total number of steps.
 * @param props.size - Outer diameter in pixels.
 */
function FocusDial({
  progress,
  step,
  total,
  size = 200,
}: {
  progress: number;
  step: number;
  total: number;
  size?: number;
}): JSX.Element {
  const stroke = size * 0.05;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
          {String(step + 1).padStart(2, "0")}
        </span>
        <span className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground">
          / {String(total).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

// ── Field primitives ──────────────────────────────────────────────────────────

/** Small uppercase section label, consistent with the rest of the app. */
function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
    >
      {children}
    </Label>
  );
}

// ── Onboarding ──────────────────────────────────────────────────────────────

/**
 * Onboarding Component
 *
 * @returns The full-screen first-run flow.
 */
export default function Onboarding(): JSX.Element {
  const { setConfig } = useConfig();
  const { addSavedTag } = useTag();
  // A restore that is still running is about to write a real profile and tags.
  // Finishing on top of it would overwrite them with whatever was typed here.
  const { bootstrapping } = useSync();

  const [step, setStep] = useState(0);

  // Identity
  const [name, setName] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [currency, setCurrency] = useState("USD");

  // Tags
  const [picked, setPicked] = useState<PickedTag[]>([
    PRESET_TAGS[0],
    PRESET_TAGS[2],
  ]);
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("#6366f1");

  // Notifications
  const [webhook, setWebhook] = useState("");
  const [sendUpdates, setSendUpdates] = useState(false);

  const total = STEPS.length;
  const isLast = step === total - 1;
  const progress = step / (total - 1);

  // ── Derived ──────────────────────────────────────────────────────────────

  const trimmedName = name.trim();
  const hasName = trimmedName.length > 0;

  const dobDate = useMemo(() => {
    if (!day || !month || !year) return null;
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    const valid =
      d >= 1 &&
      d <= 31 &&
      m >= 1 &&
      m <= 12 &&
      y >= 1900 &&
      y <= new Date().getFullYear();
    return valid ? new Date(y, m - 1, d) : null;
  }, [day, month, year]);

  const dobTouched = !!(day || month || year);
  const dobInvalid = dobTouched && !dobDate;

  const webhookTrimmed = webhook.trim();
  const hasWebhook = webhookTrimmed.length > 0;
  const webhookInvalid =
    hasWebhook && !/^https?:\/\/.+\..+/.test(webhookTrimmed);

  /** Whether the current step may advance to the next. */
  const canAdvance = (() => {
    if (step === 3) return hasName && !dobInvalid; // identity
    if (step === 5) return !webhookInvalid; // notifications
    return true;
  })();

  // ── Tag helpers ────────────────────────────────────────────────────────────

  const isPicked = (t: string) => picked.some((p) => p.t === t);

  const togglePreset = (tag: PickedTag) => {
    setPicked((prev) =>
      prev.some((p) => p.t === tag.t)
        ? prev.filter((p) => p.t !== tag.t)
        : [...prev, tag]
    );
  };

  const addCustom = () => {
    const t = customName.trim();
    if (!t) return;
    if (isPicked(t)) {
      setCustomName("");
      return;
    }
    const c = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(customColor)
      ? customColor
      : "#6366f1";
    setPicked((prev) => [...prev, { t, c }]);
    setCustomName("");
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const back = () => setStep((s) => Math.max(0, s - 1));
  const next = () => {
    if (!canAdvance) return;
    setStep((s) => Math.min(total - 1, s + 1));
  };

  const finish = () => {
    setConfig(
      trimmedName || "NULL",
      dobDate,
      webhookTrimmed,
      currency,
      hasWebhook ? sendUpdates : false
    );
    picked.forEach((p) => addSavedTag(p.t, p.c));
    toast(`Welcome aboard, ${trimmedName || "friend"}.`, {
      icon: <FaCheck />,
    });
  };

  const age = dobDate ? dayjs().diff(dayjs(dobDate), "year") : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* Brand / dial panel */}
      <aside className="md:w-[40%] md:max-w-md shrink-0 border-b md:border-b-0 md:border-r bg-card/40 flex md:flex-col items-center md:items-start justify-between gap-6 px-6 py-6 md:p-10">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center size-8 rounded-md bg-primary text-primary-foreground">
            <FaBullseye className="size-4" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-[0.2em]">
            BIT·FOCUS
          </span>
        </div>

        <div className="hidden md:flex flex-col items-center self-center gap-6">
          <FocusDial progress={progress} step={step} total={total} />
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {STEPS[step].eyebrow}
            </p>
            <p className="mt-1 text-sm text-muted-foreground max-w-[16rem]">
              A quick setup — then it&apos;s just you and the clock.
            </p>
          </div>
        </div>

        {/* Compact progress for mobile */}
        <div className="md:hidden">
          <FocusDial progress={progress} step={step} total={total} size={72} />
        </div>

        <p className="hidden md:block text-[11px] text-muted-foreground">
          Plz focus… for a bit.
        </p>
      </aside>

      {/* Step content */}
      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12 md:py-12">
          <div className="mx-auto w-full max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Step {String(step + 1).padStart(2, "0")} —{" "}
              {STEPS[step].eyebrow}
            </p>
            <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
              {STEPS[step].title}
            </h1>

            <div className="mt-8" key={step}>
              <div className="_animate_in">
                {step === 0 && <WelcomeStep />}
                {step === 1 && <AccountStep onNameFromAccount={setName} />}
                {step === 2 && <ThemeStep />}
                {step === 3 && (
                  <IdentityStep
                    name={name}
                    setName={setName}
                    day={day}
                    setDay={setDay}
                    month={month}
                    setMonth={setMonth}
                    year={year}
                    setYear={setYear}
                    currency={currency}
                    setCurrency={setCurrency}
                    dobInvalid={dobInvalid}
                  />
                )}
                {step === 4 && (
                  <TagsStep
                    picked={picked}
                    isPicked={isPicked}
                    togglePreset={togglePreset}
                    customName={customName}
                    setCustomName={setCustomName}
                    customColor={customColor}
                    setCustomColor={setCustomColor}
                    addCustom={addCustom}
                    removePicked={(t) =>
                      setPicked((prev) => prev.filter((p) => p.t !== t))
                    }
                  />
                )}
                {step === 5 && (
                  <NotificationsStep
                    webhook={webhook}
                    setWebhook={setWebhook}
                    webhookInvalid={webhookInvalid}
                    hasWebhook={hasWebhook}
                    sendUpdates={sendUpdates}
                    setSendUpdates={setSendUpdates}
                  />
                )}
                {step === 6 && (
                  <ReadyStep
                    name={trimmedName}
                    age={age}
                    tagCount={picked.length}
                    notify={hasWebhook && sendUpdates}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <footer className="border-t bg-card/40 px-6 py-4 md:px-12">
          <div className="mx-auto w-full max-w-xl flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={back}
              disabled={step === 0}
              className={cn(step === 0 && "invisible")}
            >
              <FaArrowLeft className="size-3.5" />
              Back
            </Button>

            {isLast ? (
              <Button
                onClick={finish}
                disabled={bootstrapping}
                className="gap-2"
              >
                {bootstrapping ? "Restoring your data…" : "Enter BIT Focus"}
                <FaArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button onClick={next} disabled={!canAdvance} className="gap-2">
                {step === 0 ? "Begin setup" : "Continue"}
                <FaArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

// ── Steps ──────────────────────────────────────────────────────────────────

function WelcomeStep(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground leading-relaxed">
        BIT Focus keeps a quiet record of your focused time and the work it goes
        into. Everything lives in this browser by default — connect an account
        later only if you want it on more than one device. Here&apos;s what you
        get.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border bg-card p-4 flex flex-col gap-2"
          >
            <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary">
              <f.icon className="size-4" />
            </span>
            <p className="font-medium text-sm">{f.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Plural-aware labels for the collections a restore can bring back. */
const RESTORED_LABELS: Record<string, [string, string]> = {
  focus: ["session", "sessions"],
  projects: ["project", "projects"],
  milestones: ["milestone", "milestones"],
  issues: ["issue", "issues"],
  notes: ["note", "notes"],
  excalidraw: ["drawing", "drawings"],
  aiChats: ["chat", "chats"],
  timeblocks: ["timeblock", "timeblocks"],
  rewards: ["reward", "rewards"],
  discounts: ["discount", "discounts"],
  kv: ["setting", "settings"],
  configuration: ["profile", "profile"],
};

/**
 * Turn restore counts into short human phrases.
 *
 * @param counts - Rows applied per collection during the first sync.
 * @returns Phrases like `412 sessions`, largest first.
 */
function summarizeRestored(counts: Record<string, number>): string[] {
  return Object.entries(counts)
    .filter(([col, n]) => n > 0 && RESTORED_LABELS[col])
    .sort((a, b) => b[1] - a[1])
    .map(([col, n]) => {
      const [one, many] = RESTORED_LABELS[col];
      return col === "configuration" ? "your profile" : `${n} ${n === 1 ? one : many}`;
    });
}

/**
 * Account Step
 *
 * Placed second on purpose. Someone reinstalling or setting up a second device
 * should not have to fill in a profile that already exists in the cloud — if
 * they connect here and this device is empty, the sync engine restores
 * everything and the rest of onboarding becomes unnecessary.
 *
 * @param props.onNameFromAccount - Seeds the identity step with the provider
 *   name, so the next screen is already filled in.
 */
function AccountStep({
  onNameFromAccount,
}: {
  onNameFromAccount: (name: string) => void;
}): JSX.Element {
  const { user } = useAuth();
  const { bootstrapping, restored } = useSync();

  if (user) {
    const found = restored ? summarizeRestored(restored) : [];

    return (
      <div className="flex flex-col gap-6">
        <p className="text-muted-foreground leading-relaxed">
          Connected. Anything you set up from here on will be waiting on your
          other devices.
        </p>

        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <AccountAvatar seed={user.name} className="size-11 border shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">
              {user.name || "Your account"}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {user.email}
            </span>
          </div>
          <FaCheck className="size-4 text-primary ml-auto shrink-0" />
        </div>

        {/* Report what actually arrived rather than asserting something did. */}
        {bootstrapping ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Checking this account for existing data…
          </p>
        ) : found.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">Restored from your account:</p>
            <ul className="flex flex-wrap gap-1.5">
              {found.map((entry) => (
                <li
                  key={entry}
                  className="rounded-md border bg-card px-2 py-1 text-xs font-mono text-muted-foreground"
                >
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            This account had nothing stored yet, so the next few steps set it
            up. Everything you enter syncs from here.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground leading-relaxed">
        If you&apos;ve used BIT Focus before, sign in and your sessions,
        projects, and tags come back exactly as you left them. Starting fresh?
        Skip this — you can connect any time.
      </p>

      <ProviderButtons
        onConnected={() => {
          // The provider name is a sensible default for the identity step.
          const connected = useAuth.getState().user;
          if (connected?.name) onNameFromAccount(connected.name);
          toast(`Signed in as ${connected?.email ?? "you"}.`, {
            icon: <FaCheck />,
          });
        }}
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
          <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary">
            <FaCloudArrowDown className="size-4" />
          </span>
          <p className="font-medium text-sm">Pick up anywhere</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Start a session on your laptop, check the numbers on your phone.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
          <span className="grid place-items-center size-9 rounded-lg bg-muted text-muted-foreground">
            <FaLaptop className="size-4" />
          </span>
          <p className="font-medium text-sm">Stays optional</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every feature works signed out. Nothing leaves this browser until
            you say so.
          </p>
        </div>
      </div>
    </div>
  );
}

function ThemeStep(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes resolves the active theme only on the client; wait to avoid a
  // hydration-time mismatch on the selected card.
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        Set the mood. Pick one and the whole app — this screen included — updates
        instantly. You can switch anytime from the sidebar.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEME_OPTIONS.map((opt) => {
          const active = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={active}
              className={cn(
                "group relative flex flex-col gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
                active
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/40"
              )}
            >
              <span className="flex gap-1.5">
                {opt.swatch.map((color, i) => (
                  <span
                    key={i}
                    className="size-5 rounded-full border border-black/10"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <span className="flex items-center justify-between">
                <span className="text-sm font-medium">{opt.label}</span>
                {active && <FaCheck className="size-3 text-primary" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IdentityStep({
  name,
  setName,
  day,
  setDay,
  month,
  setMonth,
  year,
  setYear,
  currency,
  setCurrency,
  dobInvalid,
}: {
  name: string;
  setName: (v: string) => void;
  day: string;
  setDay: (v: string) => void;
  month: string;
  setMonth: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  dobInvalid: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        Just enough to make the app feel like yours. You can change any of this
        later.
      </p>

      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
        <span className="grid place-items-center size-8 rounded-lg bg-primary/10 text-primary shrink-0">
          <FaLock className="size-3.5" />
        </span>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">
            This stays on your device.
          </span>{" "}
          Your name and details are saved in this browser. They leave it only if
          you connect an account, and then only to your own account.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="ob-name">Name</FieldLabel>
        <Input
          id="ob-name"
          autoFocus
          placeholder="e.g. Alex"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Date of birth — optional</FieldLabel>
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="DD"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          <Input
            type="number"
            inputMode="numeric"
            placeholder="MM"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Input
            type="number"
            inputMode="numeric"
            placeholder="YYYY"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        {dobInvalid && (
          <span className="text-destructive text-xs">
            That date doesn&apos;t look right. Leave it blank to skip.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="ob-currency">Preferred currency</FieldLabel>
        <CurrencySelect
          id="ob-currency"
          value={currency}
          onChange={setCurrency}
        />
        <span className="text-xs text-muted-foreground">
          Used for project budgets and rewards.
        </span>
      </div>
    </div>
  );
}

function TagsStep({
  picked,
  isPicked,
  togglePreset,
  customName,
  setCustomName,
  customColor,
  setCustomColor,
  addCustom,
  removePicked,
}: {
  picked: PickedTag[];
  isPicked: (t: string) => boolean;
  togglePreset: (t: PickedTag) => void;
  customName: string;
  setCustomName: (v: string) => void;
  customColor: string;
  setCustomColor: (v: string) => void;
  addCustom: () => void;
  removePicked: (t: string) => void;
}): JSX.Element {
  const customPicks = picked.filter(
    (p) => !PRESET_TAGS.some((preset) => preset.t === p.t)
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        Tags label each focus session by what you were doing. Pick a few to start
        — or invent your own.
      </p>

      <div className="flex flex-col gap-3">
        <FieldLabel>Suggestions</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {PRESET_TAGS.map((tag) => {
            const active = isPicked(tag.t);
            return (
              <button
                key={tag.t}
                type="button"
                onClick={() => togglePreset(tag)}
                className={cn(
                  "group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-transparent"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
                style={
                  active
                    ? {
                        backgroundColor: tag.c + "22",
                        color: tag.c,
                        borderColor: tag.c + "55",
                      }
                    : undefined
                }
              >
                <FaHashtag className="size-2.5 opacity-70" />
                {tag.t}
                {active && <FaCheck className="size-2.5" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <FieldLabel htmlFor="ob-tag">Add your own</FieldLabel>
        <div className="flex gap-2">
          <ColorPicker value={customColor} onChange={setCustomColor} />
          <Input
            id="ob-tag"
            placeholder="Tag name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCustom}
            disabled={!customName.trim()}
          >
            <FaPlus className="size-3" />
            Add
          </Button>
        </div>

        {customPicks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {customPicks.map((p) => (
              <span
                key={p.t}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
                style={{
                  backgroundColor: p.c + "22",
                  color: p.c,
                  border: `1px solid ${p.c}55`,
                }}
              >
                <FaHashtag className="size-2.5 opacity-70" />
                {p.t}
                <button
                  type="button"
                  onClick={() => removePicked(p.t)}
                  className="opacity-60 hover:opacity-100"
                  aria-label={`Remove ${p.t}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {picked.length} tag{picked.length === 1 ? "" : "s"} selected. You can skip
        this and add tags anytime.
      </p>
    </div>
  );
}

function NotificationsStep({
  webhook,
  setWebhook,
  webhookInvalid,
  hasWebhook,
  sendUpdates,
  setSendUpdates,
}: {
  webhook: string;
  setWebhook: (v: string) => void;
  webhookInvalid: boolean;
  hasWebhook: boolean;
  sendUpdates: boolean;
  setSendUpdates: (v: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        Optional. Paste a Discord webhook and BIT Focus can post when you start
        and finish a session. Leave it blank to keep things silent.
      </p>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="ob-webhook">Discord webhook URL</FieldLabel>
        <Input
          id="ob-webhook"
          placeholder="https://discord.com/api/webhooks/…"
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
        />
        {webhookInvalid && (
          <span className="text-destructive text-xs">
            That doesn&apos;t look like a valid URL.
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <FaBell className="size-4" />
          </span>
          <div className="flex flex-col gap-0.5">
            <Label
              htmlFor="ob-send"
              className={cn(
                "text-sm font-medium cursor-pointer",
                !hasWebhook && "opacity-40 cursor-not-allowed"
              )}
            >
              Send status updates
            </Label>
            <span className="text-xs text-muted-foreground">
              Notify when starting and completing timers.
            </span>
          </div>
        </div>
        <Switch
          id="ob-send"
          checked={hasWebhook ? sendUpdates : false}
          onCheckedChange={setSendUpdates}
          disabled={!hasWebhook}
        />
      </div>
    </div>
  );
}

function ReadyStep({
  name,
  age,
  tagCount,
  notify,
}: {
  name: string;
  age: number | null;
  tagCount: number;
  notify: boolean;
}): JSX.Element {
  const { user } = useAuth();

  const rows = [
    { label: "Name", value: name || "—" },
    { label: "Age", value: age != null ? `${age}` : "Not set" },
    { label: "Starter tags", value: `${tagCount}` },
    { label: "Status updates", value: notify ? "On" : "Off" },
    { label: "Sync", value: user ? "On" : "This device only" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        That&apos;s everything. Here&apos;s the shape of your setup — start the
        clock whenever you&apos;re ready.
      </p>

      <div className="rounded-xl border bg-card divide-y">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {r.label}
            </span>
            <span className="font-mono text-sm tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
