/**
 * Shared Page Route
 *
 * `/share/<id>` opens a short link; `/share#<data>` opens an embedded one. The
 * page title is looked up on the server for short links so chat apps show the
 * page's name in their link preview. Shared pages are kept out of search
 * engines: a link is meant for the people it was given to.
 *
 * @fileoverview Route for read-only shared Notes pages.
 * @since v0.25.2
 */

import type { Metadata } from "next";
import SharedNoteView from "@/components/share/SharedNoteView";
import { POCKETBASE_URL, SHARES_COLLECTION } from "@/lib/pocketbase";

interface Props {
  params: Promise<{ id?: string[] }>;
}

const DESCRIPTION = "A read-only page shared from BIT Focus.";

async function sharedTitle(id: string): Promise<string | null> {
  if (!/^[a-z0-9]{1,32}$/i.test(id)) return null;
  try {
    const response = await fetch(
      `${POCKETBASE_URL}/api/collections/${SHARES_COLLECTION}/records/${id}?fields=title`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    const { title } = (await response.json()) as { title?: unknown };
    return typeof title === "string" ? title.trim() || "Untitled" : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id?.[0];
  const title = id ? await sharedTitle(id) : null;
  const full = title ? `${title} · BIT Focus` : "Shared page · BIT Focus";
  return {
    title: full,
    description: DESCRIPTION,
    robots: { index: false, follow: false },
    openGraph: { title: title ?? "Shared page", description: DESCRIPTION, siteName: "BIT Focus", type: "article" },
  };
}

export default async function SharePage({ params }: Props) {
  const id = (await params).id?.[0];
  return <SharedNoteView id={id} />;
}
