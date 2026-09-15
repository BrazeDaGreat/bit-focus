"use client";

import { useState, type JSX } from "react";
import { useTheme } from "next-themes";
import Markdown from "react-markdown";
import {
  ArrowRightLeft,
  Bug,
  CalendarDays,
  ChevronDown,
  FileText,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { VERSION } from "./CHANGELOG";
import {
  CHANGELOG_CATEGORIES,
  CHANGELOG_RELEASES,
  type ChangelogCategory,
  type ChangelogEntry,
  type ChangelogRelease,
  type ReleaseChannel,
} from "./changelogData";

interface CategoryMeta {
  icon: LucideIcon;
  iconClass: string;
  marker: string;
}

const CATEGORY_META: Record<ChangelogCategory, CategoryMeta> = {
  Added: {
    icon: Plus,
    iconClass: "text-chart-2",
    marker: "bg-chart-2",
  },
  Improved: {
    icon: Sparkles,
    iconClass: "text-chart-3",
    marker: "bg-chart-3",
  },
  Changed: {
    icon: ArrowRightLeft,
    iconClass: "text-chart-1",
    marker: "bg-chart-1",
  },
  Fixed: {
    icon: Bug,
    iconClass: "text-chart-4",
    marker: "bg-chart-4",
  },
  Security: {
    icon: ShieldCheck,
    iconClass: "text-chart-5",
    marker: "bg-chart-5",
  },
  Removed: {
    icon: Minus,
    iconClass: "text-destructive",
    marker: "bg-destructive",
  },
  Technical: {
    icon: Wrench,
    iconClass: "text-muted-foreground",
    marker: "bg-muted-foreground",
  },
  Notes: {
    icon: FileText,
    iconClass: "text-muted-foreground",
    marker: "bg-muted-foreground",
  },
};

function formatReleaseDate(date: string | null): string {
  if (!date) return "Undated release";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function channelLabel(channel: ReleaseChannel): string {
  if (channel === "release") return "Stable";
  if (channel === "beta") return "Beta";
  if (channel === "alpha") return "Alpha";
  return "LTS";
}

function channelClassName(channel: ReleaseChannel): string {
  if (channel === "LTS") {
    return "bg-chart-2/12 text-chart-2";
  }
  if (channel === "beta") {
    return "bg-chart-4/12 text-chart-4";
  }
  if (channel === "alpha") {
    return "bg-chart-5/12 text-chart-5";
  }
  return "bg-muted text-muted-foreground";
}

function releaseSummary(
  release: ChangelogRelease,
  featured: boolean,
): string | null {
  if (release.title) return release.title;
  if (featured) return "Latest product update";
  return null;
}

function categoryCounts(entries: ChangelogEntry[]): Array<{
  category: ChangelogCategory;
  count: number;
}> {
  return CHANGELOG_CATEGORIES.map((category) => ({
    category,
    count: entries.filter((entry) => entry.category === category).length,
  })).filter((item) => item.count > 0);
}

function ReleaseStats({ entries }: { entries: ChangelogEntry[] }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {categoryCounts(entries).map(({ category, count }) => {
        const meta = CATEGORY_META[category];

        return (
          <span
            key={category}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1 text-xs text-muted-foreground"
          >
            <span
              className={cn("size-1.5 rounded-full", meta.marker)}
              aria-hidden="true"
            />
            <span className="font-mono tabular-nums text-foreground">
              {count}
            </span>
            <span>{category}</span>
          </span>
        );
      })}
    </div>
  );
}

function EntryList({
  entries,
  marker,
}: {
  entries: ChangelogEntry[];
  marker: string;
}): JSX.Element {
  return (
    <ul className="grid gap-0.5">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-lg px-3 py-2 hover:bg-muted/50"
        >
          <div className="flex gap-3">
            <span
              className={cn(
                "mt-[0.62rem] size-1.5 shrink-0 rounded-full",
                marker,
              )}
              aria-hidden="true"
            />
            <div
              className={cn(
                "min-w-0 text-sm leading-6 text-foreground/90",
                "[&>p]:m-0 [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline",
                "[&_code]:rounded-md [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.82em]",
              )}
            >
              <Markdown>{entry.text}</Markdown>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CategoryWell({
  category,
  entries,
}: {
  category: ChangelogCategory;
  entries: ChangelogEntry[];
}): JSX.Element {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <section className="rounded-xl bg-muted/40 p-1">
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="flex size-7 items-center justify-center rounded-lg bg-background shadow-xs"
          aria-hidden="true"
        >
          <Icon className={cn("size-3.5", meta.iconClass)} />
        </span>
        <h3 className="text-sm font-semibold tracking-tight">{category}</h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {entries.length}
        </span>
      </div>
      <EntryList entries={entries} marker={meta.marker} />
    </section>
  );
}

function TechnicalWell({ entries }: { entries: ChangelogEntry[] }): JSX.Element {
  const meta = CATEGORY_META.Technical;
  const Icon = meta.icon;

  return (
    <Collapsible>
      <section className="rounded-xl bg-muted/40 p-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">Technical notes</span>
            <span className="font-mono text-xs tabular-nums">
              {entries.length}
            </span>
            <ChevronDown
              className="size-4 shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-1 pb-1">
            <EntryList entries={entries} marker={meta.marker} />
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function ReleaseBody({ release }: { release: ChangelogRelease }): JSX.Element {
  const groups = CHANGELOG_CATEGORIES.map((category) => ({
    category,
    entries: release.entries.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);
  const technicalEntries = groups.find(
    (group) => group.category === "Technical",
  )?.entries;
  const visibleGroups = groups.filter((group) => group.category !== "Technical");

  return (
    <div className="grid gap-3">
      {visibleGroups.map((group) => (
        <CategoryWell
          key={group.category}
          category={group.category}
          entries={group.entries}
        />
      ))}
      {technicalEntries && <TechnicalWell entries={technicalEntries} />}
    </div>
  );
}

function ReleaseIdentity({
  release,
  featured = false,
  compact = false,
}: {
  release: ChangelogRelease;
  featured?: boolean;
  compact?: boolean;
}): JSX.Element {
  const summary = releaseSummary(release, featured);

  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={cn(
          "mt-2 size-2.5 shrink-0 rounded-full bg-primary",
          featured && "ring-4 ring-primary/12",
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <h2
            className={cn(
              "min-w-0 truncate font-mono font-semibold tracking-tight",
              compact ? "text-lg" : "text-2xl",
            )}
          >
            {release.version}
          </h2>
          <Badge
            variant="secondary"
            className={cn(
              "rounded-lg border-0 px-2 py-1 text-[10px] uppercase tracking-[0.1em]",
              channelClassName(release.channel),
            )}
          >
            {channelLabel(release.channel)}
          </Badge>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatReleaseDate(release.date)}
          </span>
        </div>

        {summary && (
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        )}

        {featured ? (
          <div className="mt-3">
            <ReleaseStats entries={release.entries} />
          </div>
        ) : (
          <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
            {release.entries.length} {release.entries.length === 1 ? "change" : "changes"}
          </p>
        )}
      </div>
    </div>
  );
}

function LatestReleasePanel({
  release,
}: {
  release: ChangelogRelease;
}): JSX.Element {
  return (
    <section
      id={release.id}
      className="scroll-mt-6 rounded-2xl border bg-card p-5 shadow-xs sm:p-6"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-primary">
        Latest release
      </p>
      <div className="mt-3">
        <ReleaseIdentity release={release} featured />
      </div>
      <div className="mt-6">
        <ReleaseBody release={release} />
      </div>
    </section>
  );
}

function ArchiveRelease({
  release,
  open,
  onOpenChange,
}: {
  release: ChangelogRelease;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  return (
    <article
      id={release.id}
      className="scroll-mt-6 rounded-2xl border bg-card p-4 shadow-xs sm:p-5"
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <ReleaseIdentity release={release} compact />
          </div>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="size-9 shrink-0 rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${open ? "Collapse" : "Expand"} ${release.version}`}
            >
              <ChevronDown
                className={cn(
                  "mx-auto size-4 transition-transform duration-150 motion-reduce:transition-none",
                  open && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="mt-4 border-t border-border/60 pt-4">
            <ReleaseBody release={release} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}

function ReleaseIndex({
  releases,
  latestReleaseId,
  onNavigate,
}: {
  releases: ChangelogRelease[];
  latestReleaseId: string | undefined;
  onNavigate: (releaseId: string) => void;
}): JSX.Element {
  const yearGroups = releases.reduce<Map<string, ChangelogRelease[]>>(
    (groups, release) => {
      const year = release.date?.slice(0, 4) ?? "Earlier";
      const yearReleases = groups.get(year) ?? [];
      yearReleases.push(release);
      groups.set(year, yearReleases);
      return groups;
    },
    new Map(),
  );

  return (
    <aside className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-20 lg:self-start">
      <div className="rounded-2xl border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-tight">
              Release index
            </h2>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {releases.length}
          </span>
        </div>

        <nav
          aria-label="Release index"
          className="mt-3 max-h-56 overflow-x-auto rounded-xl bg-muted/40 p-1 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:overflow-x-hidden"
        >
          {Array.from(yearGroups.entries()).map(([year, yearReleases]) => (
            <div key={year} className="flex shrink-0 flex-col gap-0.5">
              <p className="px-2 pb-1 pt-2 font-mono text-xs font-semibold tabular-nums text-muted-foreground first:pt-1">
                {year}
              </p>
              {yearReleases.map((release) => {
                const isLatest = release.id === latestReleaseId;

                return (
                  <a
                    key={release.id}
                    href={`#${release.id}`}
                    onClick={() => onNavigate(release.id)}
                    aria-label={`${release.version}, ${formatReleaseDate(release.date)}`}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-2 py-2 font-mono text-xs tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isLatest
                        ? "bg-primary/12 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        isLatest ? "bg-primary" : "bg-border",
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{release.version}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default function Changelog(): JSX.Element {
  const { theme } = useTheme();
  const [openReleaseIds, setOpenReleaseIds] = useState<Set<string>>(
    () => new Set(),
  );
  const latestRelease = CHANGELOG_RELEASES[0];
  const archivedReleases = CHANGELOG_RELEASES.slice(1);
  const latestReleaseId = latestRelease?.id;

  function setReleaseOpen(releaseId: string, open: boolean): void {
    setOpenReleaseIds((current) => {
      const next = new Set(current);
      if (open) next.add(releaseId);
      else next.delete(releaseId);
      return next;
    });
  }

  function navigateToRelease(releaseId: string): void {
    setReleaseOpen(releaseId, true);
  }

  return (
    <div className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Product history
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Changelog
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            A running record of what changed in BIT Focus, from the first timer
            to the latest release.
          </p>
        </div>

        <div className="rounded-xl bg-muted/40 px-3 py-2 sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Current build
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-primary">
            {VERSION}
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <ReleaseIndex
          releases={CHANGELOG_RELEASES}
          latestReleaseId={latestReleaseId}
          onNavigate={navigateToRelease}
        />

        <main className="order-1 min-w-0 lg:order-2">
          {latestRelease && <LatestReleasePanel release={latestRelease} />}

          {archivedReleases.length > 0 && (
            <div className="mb-4 mt-10 flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Release archive
              </h2>
              <div className="h-px flex-1 bg-border" aria-hidden="true" />
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {archivedReleases.length} older releases
              </span>
            </div>
          )}

          <div className="grid gap-3">
            {archivedReleases.map((release) => (
              <ArchiveRelease
                key={release.id}
                release={release}
                open={openReleaseIds.has(release.id)}
                onOpenChange={(open) => setReleaseOpen(release.id, open)}
              />
            ))}
          </div>
        </main>
      </div>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}
