"use client";

/**
 * Settings Page
 *
 * Every preference in one place, one section at a time. The index on the left
 * (chips on phones) picks a section and reports each one's current state —
 * your name, sync status, the Pomodoro rhythm, when the last backup ran — so
 * it answers "how is this set up?" before you open anything. The open section
 * lives in the URL hash, so links like /settings#data land on it.
 *
 * Toggles apply the moment they change. Text fields (profile, webhook URL)
 * save with their button.
 *
 * @fileoverview Settings page
 * @author BIT Focus Development Team
 * @since v0.23.0
 * @updated v0.25.3 - One section at a time, built from shared wells and rows.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Kbd } from "@/components/ui/kbd";
import RewardSettings, { RewardWebhookRows } from "@/components/settings/RewardSettings";
import StorageHealth from "@/components/settings/StorageHealth";
import { FIELD_CLASS, Group, Row, SettingsButton, Well } from "@/components/settings/parts";
import CurrencySelect from "@/components/CurrencySelect";
import AccountSettings from "@/components/auth/AccountSettings";
import PomodoroSettings from "@/components/PomodoroSettings";
import SoundSettings from "@/components/SoundSettings";
import { useConfig, type FeatureKey } from "@/hooks/useConfig";
import { usePreferences } from "@/hooks/usePreferences";
import { usePomoStatus } from "@/hooks/PomoContext";
import { useAuth } from "@/hooks/useAuth";
import { notificationsSupported, requestNotificationPermission } from "@/lib/notify";
import { lastAutoBackupAt } from "@/lib/autoBackup";
import SaveManager from "@/lib/SaveManager";
import { useBackupRestore } from "@/components/BackupRestore";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

type SectionId = "profile" | "account" | "timer" | "rewards" | "notifications" | "data" | "features";
const SECTION_IDS: SectionId[] = ["profile", "account", "timer", "rewards", "notifications", "data", "features"];
const isSectionId = (id: string): id is SectionId => (SECTION_IDS as string[]).includes(id);

const FEATURE_LIST: { key: FeatureKey; label: string; hint: string }[] = [
  { key: "calendar", label: "Calendar", hint: "Sessions and timeblocks on a calendar" },
  { key: "projects", label: "Projects", hint: "Projects, milestones and issues" },
  { key: "notes", label: "Notes", hint: "Write pages and organize them in a tree" },
  { key: "aiChat", label: "AI Chat", hint: "An assistant that can read and act on your data" },
  { key: "rewards", label: "Rewards", hint: "Spend gems earned through focus on rewards" },
];

interface SectionMeta {
  id: SectionId;
  title: string;
  description: string;
  status: string;
}

export default function SettingsPage(): JSX.Element {
  const { name, featureToggles, webhook } = useConfig();
  const { user } = useAuth();
  const { state } = usePomoStatus();
  const { autoBackup, phaseNotifications, focusEndSound, breakEndSound, soundVolume } = usePreferences();
  const [active, setActive] = useState<SectionId>("profile");

  const hasName = !!name && name !== "NULL";
  const lastBackup = lastAutoBackupAt();
  const enabledFeatures = Object.values(featureToggles).filter(Boolean).length;
  const { focusDuration, breakDuration } = state.pomodoroSettings;
  const soundOn = soundVolume > 0 && (focusEndSound !== "none" || breakEndSound !== "none");
  const notifyWays = [soundOn && "Sound", phaseNotifications && "System", webhook && "Webhook"].filter(Boolean);

  const sections: SectionMeta[] = [
    { id: "profile", title: "Profile", description: "How BIT Focus greets you, and your preferred currency.", status: hasName ? name : "Not set" },
    {
      id: "account",
      title: "Account",
      description: "Sync across devices and keep a copy of your data off this browser.",
      status: user ? "Syncing" : "This device only",
    },
    {
      id: "timer",
      title: "Timer",
      description: "Pomodoro rhythm, and what happens when a phase ends or the page reloads.",
      status: `Pomodoro ${focusDuration}/${breakDuration}`,
    },
    ...(featureToggles.rewards
      ? [{ id: "rewards" as const, title: "Rewards", description: "How many gems focus earns, and how far you can borrow.", status: "Gems, rates and loans" }]
      : []),
    {
      id: "notifications",
      title: "Notifications",
      description: "How you hear about the timer when BIT Focus isn't the tab you're looking at.",
      status: notifyWays.length === 1 && soundOn ? "Sound only" : notifyWays.join(" + ") || "Off",
    },
    {
      id: "data",
      title: "Data",
      description: "Everything is stored in this browser. Back it up so a cleared browser doesn't take it with it.",
      status: autoBackup ? (lastBackup ? `Backed up ${dayjs(lastBackup).fromNow()}` : "Daily backup on") : "Manual backups",
    },
    {
      id: "features",
      title: "Features",
      description: "Turn off what you don't use. Its page disappears from navigation.",
      status: `${enabledFeatures} of ${FEATURE_LIST.length} on`,
    },
  ];

  // A hidden section (Rewards switched off) falls back to the first one.
  const current = sections.find((s) => s.id === active) ?? sections[0];

  // The hash is the source of truth on arrival and when another link changes it.
  useEffect(() => {
    const read = () => {
      const id = window.location.hash.slice(1);
      if (isSectionId(id)) setActive(id);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const select = useCallback((id: SectionId) => {
    setActive(id);
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* The section still opens; only the link isn't updated. */
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-screen-lg flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {/* Phones: section chips */}
      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden" aria-label="Settings sections">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => select(s.id)}
            aria-current={current.id === s.id ? "page" : undefined}
            className={cn(
              "h-9 shrink-0 rounded-lg px-3 text-sm transition-colors duration-150",
              current.id === s.id
                ? "bg-primary/12 font-medium text-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            {s.title}
          </button>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Desktop: index with each section's current state */}
        <nav className="sticky top-6 hidden self-start lg:block" aria-label="Settings sections">
          <ul className="flex flex-col gap-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => select(s.id)}
                  aria-current={current.id === s.id ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors duration-150",
                    current.id === s.id ? "bg-primary/12" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn("text-sm", current.id === s.id ? "font-medium text-foreground" : "text-muted-foreground")}
                  >
                    {s.title}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground/80">{s.status}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2 px-3 text-xs text-muted-foreground">
            <p><Kbd>Ctrl K</Kbd> runs any command</p>
            <p><Kbd>?</Kbd> lists every shortcut</p>
          </div>
        </nav>

        <section
          key={current.id}
          id={current.id}
          aria-labelledby="settings-section-title"
          className="flex min-w-0 flex-col gap-6 self-start rounded-2xl border bg-card p-4 shadow-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 sm:p-6"
        >
          <header>
            <h2 id="settings-section-title" className="text-base font-semibold tracking-tight">
              {current.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
          </header>
          <SectionBody id={current.id} />
        </section>
      </div>
    </div>
  );
}

function SectionBody({ id }: { id: SectionId }): JSX.Element {
  switch (id) {
    case "profile":
      return <ProfileForm />;
    case "account":
      return <AccountSettings />;
    case "timer":
      return (
        <>
          <PomodoroSettings />
          <Group title="When the page reloads">
            <Well>
              <PreferenceRow
                id="pref-resume"
                label="Keep the timer running"
                hint="A running timer picks up where it was when you come back. Off: it pauses."
                preference="resumeTimerOnReload"
              />
            </Well>
          </Group>
        </>
      );
    case "rewards":
      return <RewardSettings />;
    case "notifications":
      return (
        <>
          <Group title="Sounds">
            <SoundSettings />
          </Group>
          <Group title="System notifications">
            <Well>
              <NotificationRow />
            </Well>
          </Group>
          <Group title="Discord webhook">
            <WebhookSettings />
          </Group>
        </>
      );
    case "data":
      return (
        <>
          <StorageHealth />
          <Group title="Backups">
            <BackupRows />
          </Group>
        </>
      );
    case "features":
      return <FeatureRows />;
  }
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
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Well className="grid gap-3 p-3 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="settings-name">Name</Label>
          <Input id="settings-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} className={FIELD_CLASS} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="settings-dob">Date of birth</Label>
          <Input
            id="settings-dob"
            type="date"
            value={draftDob}
            max={dayjs().format("YYYY-MM-DD")}
            onChange={(e) => setDraftDob(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="settings-currency">Currency</Label>
          <CurrencySelect id="settings-currency" value={draftCurrency} onChange={setDraftCurrency} className={cn(FIELD_CLASS, "w-full")} />
        </div>
      </Well>
      <div className="flex justify-end">
        <SettingsButton primary type="submit" disabled={!dirty}>
          Save profile
        </SettingsButton>
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
      hint="Shows a system notification while BIT Focus is in the background."
    >
      <Switch id="pref-notify" checked={checked} onCheckedChange={(v) => void onChange(v)} />
    </Row>
  );
}

/**
 * The URL saves with its button; the switches beneath apply at once and wait
 * for a saved URL, since there is nowhere to post without one.
 */
function WebhookSettings(): JSX.Element {
  const { webhook, sendWebhookUpdates, featureToggles, updateConfig } = useConfig();
  const [draft, setDraft] = useState(webhook);

  useEffect(() => setDraft(webhook), [webhook]);

  const valid = draft.trim() === "" || /^https?:\/\/.+\..+/.test(draft.trim());
  const dirty = draft.trim() !== webhook;
  const hasWebhook = webhook.trim() !== "";

  const save = async () => {
    if (!valid) return;
    const url = draft.trim();
    await updateConfig(url ? { webhook: url } : { webhook: "", sendWebhookUpdates: false });
    toast.success(url ? "Webhook saved." : "Webhook removed.");
  };

  return (
    <Well>
      <form
        className="flex flex-wrap items-end gap-2 px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid min-w-0 flex-1 basis-60 gap-1.5">
          <Label htmlFor="settings-webhook">Webhook URL</Label>
          <Input
            id="settings-webhook"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            aria-invalid={!valid}
            className={FIELD_CLASS}
          />
        </div>
        <SettingsButton primary type="submit" disabled={!dirty || !valid}>
          Save webhook
        </SettingsButton>
        {!valid && <span className="basis-full text-xs text-destructive">Enter a full URL starting with https://</span>}
      </form>
      <Row
        id="settings-webhook-updates"
        label="Post timer updates"
        hint={hasWebhook ? "Posts when a session starts and when it's saved." : "Save a webhook URL to post timer updates."}
      >
        <Switch
          id="settings-webhook-updates"
          checked={hasWebhook && sendWebhookUpdates}
          disabled={!hasWebhook}
          onCheckedChange={(v) => void updateConfig({ sendWebhookUpdates: v })}
        />
      </Row>
      {featureToggles.rewards && <RewardWebhookRows disabled={!hasWebhook} />}
    </Well>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

function BackupRows(): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);
  const { prepareRestore, restoreDialog, busy } = useBackupRestore();
  const autoBackup = usePreferences((s) => s.autoBackup);
  const lastBackup = lastAutoBackupAt();
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);

  const exportNow = async () => {
    if (exportLock.current || busy) return;
    exportLock.current = true;
    setExporting(true);
    try {
      await SaveManager.exportData({ includeAttachments: true });
      toast.success("Complete backup download started. Check your downloads.", { id: "backup-export" });
    } catch {
      toast.error("Export failed. Try again.");
    } finally { exportLock.current = false; setExporting(false); }
  };

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await prepareRestore(file);
  };

  return (
    <Well>
      <PreferenceRow
        id="pref-backup"
        label="Automatic backup"
        hint={
          autoBackup && lastBackup
            ? `Every 24 hours while the app is open, without files. Last one ${dayjs(lastBackup).format("MMM D, h:mm A")}.`
            : "Every 24 hours while the app is open, without files."
        }
        preference="autoBackup"
      />
      <Row label="Backup file" hint="Exports include files. You review a backup before it replaces anything.">
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".bitf.json,application/json" className="hidden" onChange={importFile} />
          <SettingsButton disabled={busy || exporting} onClick={() => fileRef.current?.click()}>
            Restore…
          </SettingsButton>
          <SettingsButton primary disabled={busy || exporting} onClick={() => void exportNow()}>
            {exporting ? "Exporting…" : "Export complete backup"}
          </SettingsButton>
        </div>
      </Row>
      {restoreDialog}
    </Well>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

function FeatureRows(): JSX.Element {
  const { featureToggles, setFeatureToggle } = useConfig();
  return (
    <Well>
      {FEATURE_LIST.map(({ key, label, hint }) => (
        <Row key={key} id={`feature-${key}`} label={label} hint={hint}>
          <Switch
            id={`feature-${key}`}
            checked={featureToggles[key]}
            onCheckedChange={(checked) => void setFeatureToggle(key, checked)}
          />
        </Row>
      ))}
    </Well>
  );
}
