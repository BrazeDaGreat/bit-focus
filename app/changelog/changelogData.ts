import CHANGELOG from "./CHANGELOG";

export const CHANGELOG_CATEGORIES = [
  "Added",
  "Improved",
  "Changed",
  "Fixed",
  "Security",
  "Removed",
  "Technical",
  "Notes",
] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

export interface ChangelogEntry {
  id: string;
  category: ChangelogCategory;
  text: string;
}

export type ReleaseChannel = "LTS" | "beta" | "alpha" | "release";

export interface ChangelogRelease {
  id: string;
  version: string;
  date: string | null;
  title: string | null;
  channel: ReleaseChannel;
  entries: ChangelogEntry[];
}

const CATEGORY_HEADING_MAP: Record<string, ChangelogCategory> = {
  added: "Added",
  add: "Added",
  new: "Added",
  feature: "Added",
  improved: "Improved",
  improve: "Improved",
  changed: "Changed",
  change: "Changed",
  fixed: "Fixed",
  fix: "Fixed",
  security: "Security",
  removed: "Removed",
  remove: "Removed",
  technical: "Technical",
  refactor: "Technical",
  research: "Technical",
  documented: "Technical",
  documentation: "Technical",
  update: "Technical",
  updates: "Technical",
  updated: "Technical",
  notes: "Notes",
};

const CATEGORY_PREFIX_PATTERN =
  /^(feature|security|refactor|research|documented|documentation|update|updates|updated|add|added|new|improve|improved|change|changed|fix|fixed|remove|removed)\b\s*:?\s*/i;

function normalizeCategoryLabel(label: string): ChangelogCategory | null {
  return CATEGORY_HEADING_MAP[label.trim().toLowerCase()] ?? null;
}

function releaseId(version: string): string {
  return `release-${version.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function parseReleaseHeading(line: string): Omit<ChangelogRelease, "entries"> | null {
  const headingMatch = line.match(/^#{2,3}\s+(.+)$/);
  if (!headingMatch) return null;

  const heading = headingMatch[1].trim();
  const codeMatch = heading.match(/`([^`]+)`/);
  const versionMatch = (codeMatch?.[1] ?? heading).match(
    /v?\d+\.\d+\.\d+(?:-[a-z0-9.]+)?/i,
  );
  if (!versionMatch) return null;

  const rawVersion = versionMatch[0];
  const version = rawVersion.startsWith("v")
    ? rawVersion
    : `v${rawVersion}`;
  const versionSource = codeMatch?.[1] ?? heading;
  const date = heading.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] ?? null;
  const title = heading.match(/\s+—\s+(.+)$/)?.[1]?.trim() ?? null;
  const channel: ReleaseChannel = /\bLTS\b/i.test(versionSource)
    ? "LTS"
    : /-beta\b/i.test(version)
      ? "beta"
      : /-alpha\b/i.test(version)
        ? "alpha"
        : "release";

  return {
    id: releaseId(version),
    version,
    date,
    title,
    channel,
  };
}

function inferCategory(
  text: string,
  activeCategory: ChangelogCategory | null,
): ChangelogCategory {
  const value = text.trim().toLowerCase();

  if (/^(security|api key|session token)/.test(value)) return "Security";
  if (/^(remove|removed|deprecated|deprecat|dropping|deleting)/.test(value)) {
    return "Removed";
  }
  if (
    /^(fix|fixed|fixing|resolved|buggy|error|issue|correct|prevent|no longer|cannot|can't|could not|stops?)/.test(
      value,
    )
  ) {
    return "Fixed";
  }
  if (
    /^(improve|improved|better|reworked|redesigned|responsiv|calmer|cleaner|larger|tighter|gracefully|now follows|now uses|keeps? |stays? |fits? )/.test(
      value,
    )
  ) {
    return "Improved";
  }
  if (/^(change|changed|moved|replaced|split|grouped)/.test(value)) {
    return "Changed";
  }
  if (
    /^(add|added|new|implemented|support|custom|full|optional|feature|included|global|mini|calendar|focus|an? add|the assistant)/.test(
      value,
    )
  ) {
    return "Added";
  }
  if (/^(refactor|research|documented|updated?|bumped|shifted)/.test(value)) {
    return "Technical";
  }

  return activeCategory ?? "Technical";
}

function parseEntry(
  rawText: string,
  activeCategory: ChangelogCategory | null,
): { category: ChangelogCategory; text: string } {
  const text = rawText.trim();
  const prefixMatch = text.match(CATEGORY_PREFIX_PATTERN);

  if (!prefixMatch) {
    return {
      category: inferCategory(text, activeCategory),
      text,
    };
  }

  const prefix = prefixMatch[1];
  let category = normalizeCategoryLabel(prefix) ?? inferCategory(text, activeCategory);
  let cleanedText = text.slice(prefixMatch[0].length).trim();

  // A few older entries use labels such as "Feature: Added: ...". Remove the
  // second label as well so the rendered item does not repeat its category.
  const nestedPrefix = cleanedText.match(CATEGORY_PREFIX_PATTERN);
  if (nestedPrefix) {
    const nestedCategory = normalizeCategoryLabel(nestedPrefix[1]);
    if (nestedCategory === category || prefix.toLowerCase() === "feature") {
      category = nestedCategory ?? category;
      cleanedText = cleanedText.slice(nestedPrefix[0].length).trim();
    }
  }

  if (!cleanedText) cleanedText = text;
  if (/^[a-z]/.test(cleanedText)) {
    cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
  }

  return { category, text: cleanedText };
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.match(/\d+/g)?.map(Number) ?? [];
  const rightParts = right.match(/\d+/g)?.map(Number) ?? [];

  for (let index = 0; index < 3; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return right.localeCompare(left);
}

export function parseChangelog(source: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let currentRelease: ChangelogRelease | null = null;
  let activeCategory: ChangelogCategory | null = null;

  source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((line) => {
      const release = parseReleaseHeading(line);
      if (release) {
        currentRelease = { ...release, entries: [] };
        activeCategory = null;
        releases.push(currentRelease);
        return;
      }

      if (!currentRelease) return;

      const headingMatch = line.match(/^###\s+(.+)$/);
      if (headingMatch) {
        const category = normalizeCategoryLabel(
          headingMatch[1].replace(/[`*_]/g, "").trim(),
        );
        if (category) activeCategory = category;
        return;
      }

      const noteMatch = line.match(/^\s*Note:\s*(.+)$/i);
      if (noteMatch) {
        currentRelease.entries.push({
          id: `${currentRelease.id}-entry-${currentRelease.entries.length}`,
          category: "Notes",
          text: noteMatch[1].trim(),
        });
        activeCategory = "Notes";
        return;
      }

      const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
      if (!bulletMatch) return;

      const parsed = parseEntry(bulletMatch[1], activeCategory);
      currentRelease.entries.push({
        id: `${currentRelease.id}-entry-${currentRelease.entries.length}`,
        ...parsed,
      });
      activeCategory = parsed.category;
    });

  return releases
    .filter((release) => release.entries.length > 0)
    .sort((left, right) => {
      const dateDifference = (right.date ?? "").localeCompare(left.date ?? "");
      return dateDifference === 0
        ? compareVersions(left.version, right.version)
        : dateDifference;
    });
}

export const CHANGELOG_RELEASES = parseChangelog(CHANGELOG);
