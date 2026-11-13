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

import { useMemo, useState, type JSX } from "react";
import { useConfig } from "@/hooks/useConfig";
import { useTag } from "@/hooks/useTag";
import { useSync } from "@/hooks/useSync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dayjs from "dayjs";
import { FaArrowLeft, FaArrowRight, FaCheck, FaBullseye } from "react-icons/fa6";
import { WelcomeStep, AccountStep, ThemeStep, IdentityStep, TagsStep, NotificationsStep, ReadyStep, PRESET_TAGS, type PickedTag } from "./OnboardingSteps";

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
