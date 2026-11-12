import { descriptionText } from "./tasks";
import { isTrashed, noteTitle, type Note } from "./notes";

export function matchesNoteSearch(value: string, query: string, keywords: string[] = []) {
  const text = [value, ...keywords].join(" ").toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every((token) => text.includes(token));
}

/** Untrusted legacy content may be HTML, plain text, or malformed JSON. */
export function noteSearchText(content?: string): string {
  const raw = content?.trim() || "";
  let text = raw;
  if (raw.startsWith("{")) {
    try {
      const doc: unknown = JSON.parse(raw);
      const parts: string[] = [];
      const stack: unknown[] = [doc];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        const value = node as Record<string, unknown>;
        if (typeof value.text === "string") parts.push(value.text);
        if (value.type !== "text" && value.type !== "noteLink") parts.push(" ");
        if (value.type === "noteLink" && value.attrs && typeof value.attrs === "object") {
          const title = (value.attrs as Record<string, unknown>).title;
          if (typeof title === "string") parts.push(title);
        }
        if (Array.isArray(value.content)) stack.push(...[...value.content].reverse());
      }
      text = parts.join("");
    } catch { /* Preserve malformed legacy content as searchable text. */ }
  }
  return descriptionText(text).replace(/\s+/g, " ").trim();
}

export function createNoteSearchIndex() {
  const cache = new Map<string | number | Note, { content: Note["content"]; text: string }>();
  return (notes: readonly Note[]) => {
    const live = new Set<string | number | Note>();
    const entries = notes.filter((note) => !note.isTemplate && !isTrashed(note)).map((note) => {
      const key = note.uid ?? note.id ?? note;
      live.add(key);
      let entry = cache.get(key);
      if (!entry || entry.content !== note.content) {
        entry = { content: note.content, text: noteSearchText(note.content) };
        cache.set(key, entry);
      }
      return { note, text: entry.text, title: noteTitle(note) };
    });
    for (const key of cache.keys()) if (!live.has(key)) cache.delete(key);
    return entries;
  };
}

export function noteSearchSnippet(text: string, query: string) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  const lower = text.toLocaleLowerCase();
  const positions = tokens.map((token) => lower.indexOf(token)).filter((index) => index >= 0);
  if (!positions.length) return "";
  const start = Math.max(0, Math.min(...positions) - 40);
  const end = Math.min(text.length, start + 150);
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
