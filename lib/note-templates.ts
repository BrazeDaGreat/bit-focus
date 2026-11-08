/** Starter templates are ordinary synced notes with stable seed identities. */
import type { JSONContent } from "@tiptap/core";

export const TEMPLATE_SEED_KEY = "bitfocus.notes.templatesSeeded.v1";

const paragraph = (text?: string): JSONContent => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) });
const heading = (text: string): JSONContent => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const checklist = (...items: string[]): JSONContent => ({ type: "taskList", content: items.map((text) => ({ type: "taskItem", attrs: { checked: false }, content: [paragraph(text)] })) });
const document = (...content: JSONContent[]) => JSON.stringify({ type: "doc", content });

export const STARTER_TEMPLATES = [
  { uid: "a4727b8c-7b84-4d13-9f31-000000000001", title: "Meeting notes", icon: "Users", content: document(
    heading("Agenda"), paragraph("Date · Attendees"), checklist("Topics to discuss"),
    heading("Discussion"), paragraph(), heading("Decisions"), paragraph(), heading("Action items"), checklist("Owner · Next step · Due date"),
  ) },
  { uid: "a4727b8c-7b84-4d13-9f31-000000000002", title: "Daily log", icon: "Sun", content: document(
    heading("Today's focus"), checklist("Most important task", "One small win"), heading("Notes"), paragraph(),
    heading("End of day"), paragraph("What went well? What will I carry into tomorrow?"),
  ) },
  { uid: "a4727b8c-7b84-4d13-9f31-000000000003", title: "Weekly review", icon: "CalendarDays", content: document(
    heading("Wins"), paragraph(), heading("Lessons"), paragraph(), heading("Open loops"), checklist("Follow up"),
    heading("Next week"), checklist("Top priority", "Make time for"),
  ) },
] as const;
