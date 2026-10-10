"use client";

/**
 * Settings Page
 *
 * Every preference in one place, replacing the profile popover that had
 * outgrown the sidebar. Sections run top to bottom — Profile, Account,
 * Timer, Notifications, Data, Features, Shortcuts — with an index beside
 * them. Each index entry reports the section's current state (your name,
 * sync status, the Pomodoro rhythm, when the last backup ran), so the index
 * answers "how is this set up?" before you scroll.
 *
 * Toggles apply the moment they change. Text fields (profile, webhook) save
 * with their section's button.
 *
 * @fileoverview Settings page
 * @author BIT Focus Development Team
 * @since v0.23.0
 */

import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Kbd } from "@/components/ui/kbd";
import CurrencySelect from "@/components/CurrencySelect";
import AccountSettings from "@/components/auth/AccountSettings";
import PomodoroSettings from "@/components/PomodoroSettings";
import { useConfig, type FeatureKey } from "@/hooks/useConfig";
import { usePreferences } from "@/hooks/usePreferences";
import { usePomo } from "@/hooks/PomoContext";
import { useAuth } from "@/hooks/useAuth";
import { useCommandPalette, useShortcutsDialog } from "@/hooks/useShortcuts";
import { notificationsSupported, requestNotificationPermission } from "@/lib/notify";
import { lastAutoBackupAt } from "@/lib/autoBackup";
import SaveManager from "@/lib/SaveManager";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

type SectionId = "profile" | "account" | "timer" | "notifications" | "data" | "features" | "shortcuts";
const SECTION_IDS: SectionId[] = ["profile", "account", "timer", "notifications", "data", "features", "shortcuts"];

const FEATURE_LIST: { key: FeatureKey; label: string; hint: string }[] = [
  { key: "calendar", label: "Calendar", hint: "Sessions and timeblocks on a calendar" },
  { key: "projects", label: "Projects", hint: "Projects, milestones and issues" },
  { key: "notes", label: "Notes", hint: "Write pages and organize them in a tree" },
  { key: "aiChat", label: "AI Chat", hint: "An assistant that can read and act on your data" },
  { key: "rewards", label: "Rewards", hint: "Spend focus points on rewards" },
];

export default function SettingsPage(): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null);
  const { name, featureToggles, webhook } = useConfig();
  const { user } = useAuth();
  const { state } = usePomo();
  const { autoBackup, phaseNotifications } = usePreferences();
  const [active, setActive] = useState<SectionId>("profile");

  const hasName = !!name && name !== "NULL";
  const lastBackup = lastAutoBackupAt();
  const enabledFeatures = Object.values(featureToggles).filter(Boolean).length;
  const { focusDuration, breakDuration } = state.pomodoroSettings;

  const sections: { id: SectionId; title: string; status: string }[] = [
    { id: "profile", title: "Profile", status: hasName ? name : "Not set" },
    { id: "account", title: "Account", status: user ? "Syncing" : "This device only" },
    { id: "timer", title: "Timer", status: `Pomodoro ${focusDuration}/${breakDuration}` },
    {
      id: "notifications",
      title: "Notifications",
      status: [phaseNotifications && "System", webhook && "Webhook"].filter(Boolean).join(" + ") || "Sound only",
    },
    {
      id: "data",
      title: "Data",
      status: autoBackup ? (lastBackup ? `Backed up ${dayjs(lastBackup).fromNow()}` : "Daily backup on") : "Manual backups",
    },
    { id: "features", title: "Features", status: `${enabledFeatures} of ${FEATURE_LIST.length} on` },
    { id: "shortcuts", title: "Shortcuts", status: "Ctrl K" },
  ];

  // Settings uses document scrolling so the long page has one scroll area.
  // Track sections against its sticky top bar, including tall sections.
  useEffect(() => {
    const updateActive = () => {
      const topBarHeight = (pageRef.current?.parentElement?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
      const threshold = topBarHeight + 32;
      let current: SectionId = "profile";
      for (const id of SECTION_IDS) {
        const section = pageRef.current?.querySelector<HTMLElement>(`#${id}`);
        if (section && section.getBoundingClientRect().top <= threshold) current = id;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = "shortcuts";
      }
      setActive(current);
    };

    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    updateActive();
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, []);

  const jump = useCallback((id: SectionId, behavior: ScrollBehavior = "smooth") => {
    const section = pageRef.current?.querySelector<HTMLElement>(`#${id}`);
    if (!section) return;
    const topBarHeight = (pageRef.current?.parentElement?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    const top = window.scrollY + section.getBoundingClientRect().top - topBarHeight - 24;
    window.scrollTo({ top, behavior });
    setActive(id);
  }, []);

  // Settings mounts after the app finishes loading, so a redirected fragment
  // may have arrived before its section existed in the document.
  useEffect(() => {
    const id = window.location.hash.slice(1) as SectionId;
    if (SECTION_IDS.includes(id)) jump(id, "auto");
  }, [jump]);

  return (
    <div ref={pageRef} className="mx-auto w-full max-w-screen-lg flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Preferences
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
      </header>

      {/* Mobile: section chips */}
      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden" aria-label="Settings sections">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-sm transition-colors",
              active === s.id ? "bg-primary/12 font-medium text-foreground" : "bg-muted/60 text-muted-foreground"
            )}
          >
            {s.title}
          </button>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Desktop: index with each section's current state */}
        <nav className="sticky top-24 hidden self-start lg:block" aria-label="Settings sections">
          <ul className="flex flex-col gap-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => jump(s.id)}
                  aria-current={active === s.id ? "true" : undefined}
                  className={cn(
                    "relative flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors",
                    active === s.id ? "bg-primary/12" : "hover:bg-muted/60"
                  )}
                >
                  {active === s.id && (
                    <span className="absolute inset-y-2 -left-1 w-1 rounded-full bg-primary" aria-hidden="true" />
                  )}
                  <span className={cn("text-sm", active === s.id ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {s.title}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground/80">{s.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <Section id="profile" title="Profile" description="How BIT Focus greets you, and the currency rewards are priced in.">
            <ProfileForm />
          </Section>

          <Section id="account" title="Account" description="Connect an account to sync across devices and keep a copy off this browser.">
            <AccountSettings />
          </Section>

          <Section id="timer" title="Timer" description="Pomodoro rhythm, and what happens when a phase ends or the page reloads.">
            <PreferenceRow
              id="pref-resume"
              label="Keep timer running after reload"
              hint="A running timer picks up where it was when you come back. Off: it pauses."
              preference="resumeTimerOnReload"
            />
            <div className="mt-4 border-t pt-5">
              <PomodoroSettings />
            </div>
          </Section>

          <Section id="notifications" title="Notifications" description="Ways to hear about the timer when BIT Focus isn't the tab you're looking at.">
            <NotificationRow />
            <div className="mt-4 border-t pt-5">
              <WebhookForm />
            </div>
          </Section>

          <Section id="data" title="Data" description="Everything is stored in this browser. Back it up so a cleared browser doesn't take it with it.">
            <PreferenceRow
              id="pref-backup"
              label="Automatic backup"
              hint={
                autoBackup && lastBackup
                  ? `Downloads a backup every 24 hours while the app is open. Last one ${dayjs(lastBackup).format("MMM D, HH:mm")}.`
                  : "Downloads a backup every 24 hours while the app is open."
              }
              preference="autoBackup"
            />
            <div className="mt-4 border-t pt-4">
              <BackupActions />
            </div>
          </Section>

          <Section id="features" title="Features" description="Turn off what you don't use. Its page disappears from navigation.">
            <FeatureRows />
          </Section>

          <Section id="shortcuts" title="Shortcuts" description="Most of the app can be driven from the keyboard.">
            <ShortcutRows />
          </Section>
        </div>
      </div>
    </div>
  );
}

// ── Layout pieces ─────────────────────────────────────────────────────────────

function Section({
  id,
  title,
  description,
  children,
}: {
  id: SectionId;
  title: string;
  description: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section id={id} className="scroll-mt-32 rounded-2xl border bg-card p-5 shadow-xs sm:p-6 lg:scroll-mt-24">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Row({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-1.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function PreferenceRow({
  id,
  label,
  hint,
  preference,
}: {
  id: string;
  label: string;
  hint: string;
  preference: "resumeTimerOnReload" | "autoBackup";
}): JSX.Element {
  const checked = usePreferences((s) => s[preference]);
  const setPreference = usePreferences((s) => s.setPreference);
  return (
    <Row id={id} label={label} hint={hint}>
      <Switch id={id} checked={checked} onCheckedChange={(v) => setPreference(preference, v)} />
    </Row>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────

function ProfileForm(): JSX.Element {
  const { name, dob, currency, updateConfig } = useConfig();
  const [draftName, setDraftName] = useState(name === "NULL" ? "" : name);
  const [draftDob, setDraftDob] = useState(dob ? dayjs(dob).format("YYYY-MM-DD") : "");
  const [draftCurrency, setDraftCurrency] = useState(currency);

  // Follow the store when it loads or sync updates it underneath us.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || name === "NULL") return;
    seeded.current = true;
    setDraftName(name);
    setDraftDob(dob ? dayjs(dob).format("YYYY-MM-DD") : "");
    setDraftCurrency(currency);
  }, [name, dob, currency]);

  const savedDob = dob ? dayjs(dob).format("YYYY-MM-DD") : "";
  const dirty =
    draftName.trim() !== (name === "NULL" ? "" : name) ||
    draftDob !== savedDob ||
    draftCurrency !== currency;

  const save = async () => {
    if (!draftName.trim()) {
      toast.error("Enter a name. It's how BIT Focus greets you.");
      return;
    }
    await updateConfig({
      name: draftName.trim(),
      dob: draftDob ? dayjs(draftDob).toDate() : null,
      currency: draftCurrency,
    });
    toast.success("Profile saved.");
  };

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="settings-name">Name</Label>
        <Input id="settings-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} className="h-11 rounded-xl md:h-9 md:rounded-md" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settings-dob">Date of birth</Label>
        <Input
          id="settings-dob"
          type="date"
          value={draftDob}
          max={dayjs().format("YYYY-MM-DD")}
          onChange={(e) => setDraftDob(e.target.value)}
          className="h-11 rounded-xl md:h-9 md:rounded-md"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settings-currency">Currency</Label>
        <CurrencySelect id="settings-currency" value={draftCurrency} onChange={setDraftCurrency} className="h-11 w-full rounded-xl md:h-9 md:rounded-md" />
      </div>
      <div className="flex items-end justify-end">
        <Button type="submit" disabled={!dirty} className="h-11 rounded-full px-5 md:h-9 md:rounded-md">
          Save profile
        </Button>
      </div>
    </form>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────

function NotificationRow(): JSX.Element {
  const checked = usePreferences((s) => s.phaseNotifications);
  const setPreference = usePreferences((s) => s.setPreference);

  const onChange = async (enabled: boolean) => {
    if (enabled) {
      if (!notificationsSupported()) {
        toast.error("This browser can't show notifications.");
        return;
      }
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        toast.error("Notifications are blocked. Allow them for this site in your browser settings.");
        return;
      }
    }
    setPreference("phaseNotifications", enabled);
  };

  return (
    <Row
      id="pref-notify"
      label="Notify when a phase ends"
      hint="A system notification when a Pomodoro phase ends while BIT Focus is in the background."
    >
      <Switch id="pref-notify" checked={checked} onCheckedChange={(v) => void onChange(v)} />
    </Row>
  );
}

function WebhookForm(): JSX.Element {
  const { webhook, sendWebhookUpdates, updateConfig } = useConfig();
  const [draft, setDraft] = useState(webhook);
  const [updates, setUpdates] = useState(sendWebhookUpdates);

  useEffect(() => setDraft(webhook), [webhook]);
  useEffect(() => setUpdates(sendWebhookUpdates), [sendWebhookUpdates]);

  const valid = draft.trim() === "" || /^https?:\/\/.+\..+/.test(draft.trim());
  const hasUrl = draft.trim() !== "";
  const dirty = draft.trim() !== webhook || (hasUrl && updates !== sendWebhookUpdates);

  const save = async () => {
    if (!valid) return;
    await updateConfig({ webhook: draft.trim(), sendWebhookUpdates: hasUrl ? updates : false });
    toast.success(hasUrl ? "Webhook saved." : "Webhook removed.");
  };

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="settings-webhook">Discord webhook URL</Label>
        <Input
          id="settings-webhook"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          aria-invalid={!valid}
          className="h-11 rounded-xl md:h-9 md:rounded-md"
        />
        {!valid && <span className="text-xs text-destructive">Enter a full URL starting with https://</span>}
      </div>
      <Row id="settings-webhook-updates" label="Post timer updates" hint="Posts when a session starts and when it's saved.">
        <Switch
          id="settings-webhook-updates"
          checked={hasUrl && updates}
          disabled={!hasUrl}
          onCheckedChange={setUpdates}
        />
      </Row>
      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={!dirty || !valid} className="h-11 rounded-full px-5 md:h-9 md:rounded-md">
          Save webhook
        </Button>
      </div>
    </form>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

function BackupActions(): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportNow = async () => {
    try {
      await SaveManager.exportData();
      toast.success("Backup exported.");
    } catch {
      toast.error("Export failed. Try again.");
    }
  };

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await SaveManager.importData(file);
      toast.success("Backup restored. Reloading to apply it…");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      toast.error("That file couldn't be restored. Choose a .bitf.json backup.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">Backup file</span>
        <span className="text-xs text-muted-foreground">
          Restoring replaces everything on this device with the backup.
        </span>
      </div>
      <div className="flex gap-2">
        <input ref={fileRef} type="file" accept=".bitf.json,application/json" className="hidden" onChange={importFile} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="h-11 rounded-full px-4 md:h-9 md:rounded-md">
          Restore…
        </Button>
        <Button onClick={() => void exportNow()} className="h-11 rounded-full px-4 md:h-9 md:rounded-md">
          Export now
        </Button>
      </div>
    </div>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

function FeatureRows(): JSX.Element {
  const { featureToggles, setFeatureToggle } = useConfig();
  return (
    <div className="flex flex-col divide-y">
      {FEATURE_LIST.map(({ key, label, hint }) => (
        <Row key={key} id={`feature-${key}`} label={label} hint={hint}>
          <Switch
            id={`feature-${key}`}
            checked={featureToggles[key]}
            onCheckedChange={(checked) => void setFeatureToggle(key, checked)}
          />
        </Row>
      ))}
    </div>
  );
}

// ── Shortcuts ─────────────────────────────────────────────────────────────────

function ShortcutRows(): JSX.Element {
  const openPalette = () => useCommandPalette.getState().setPaletteOpen(true);
  const openHelp = () => useShortcutsDialog.getState().setHelpOpen(true);
  return (
    <div className="flex flex-col divide-y">
      <div className="flex min-h-12 items-center justify-between gap-4 py-1.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Command palette</span>
          <span className="text-xs text-muted-foreground">Run the timer, switch tags, jump anywhere.</span>
        </div>
        <Button variant="outline" onClick={openPalette} className="h-9 gap-2 rounded-full px-3 md:rounded-md">
          Open <Kbd>Ctrl K</Kbd>
        </Button>
      </div>
      <div className="flex min-h-12 items-center justify-between gap-4 py-1.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">All keyboard shortcuts</span>
          <span className="text-xs text-muted-foreground">Every key, grouped by what it does.</span>
        </div>
        <Button variant="outline" onClick={openHelp} className="h-9 gap-2 rounded-full px-3 md:rounded-md">
          Show <Kbd>?</Kbd>
        </Button>
      </div>
    </div>
  );
}
