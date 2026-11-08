/**
 * What's New Toast
 *
 * After the app updates, shows one quiet toast naming the new version with a
 * link to its changelog entry. The last version seen lives in localStorage; a
 * first-ever visit records the version silently, so new users aren't greeted
 * with release notes for an app they haven't used yet.
 *
 * Reads only `version.ts`: importing the changelog itself here would ship the
 * whole release-notes text with every page.
 *
 * @fileoverview One-time toast after a version bump
 * @author BIT Focus Development Team
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { VERSION } from "@/app/changelog/version";

const LAST_SEEN_KEY = "last-seen-version";

/** Wait for the shell and its Toaster to settle before speaking up */
const SHOW_DELAY_MS = 1200;

/**
 * Anchor id of a release on the changelog page. Mirrors `releaseId` in
 * `app/changelog/changelogData.ts`; keep the two in step.
 */
function releaseAnchor(version: string): string {
  return `release-${version.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, VERSION);
  } catch {
    // Storage blocked: the toast may show again next visit, which is harmless
  }
}

/**
 * Renders nothing; raises the update toast once per version.
 */
export default function WhatsNewToast(): null {
  const router = useRouter();

  useEffect(() => {
    const lastSeen = readLastSeen();
    if (lastSeen === VERSION) return;
    if (lastSeen === null) {
      markSeen();
      return;
    }

    const timer = setTimeout(() => {
      toast(`Updated to ${VERSION}`, {
        id: "whats-new",
        icon: <Sparkles className="size-4" />,
        duration: 10000,
        action: {
          label: "What's new",
          onClick: () => {
            markSeen();
            router.push(`/changelog#${releaseAnchor(VERSION)}`);
          },
        },
        onDismiss: markSeen,
        onAutoClose: markSeen,
      });
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
