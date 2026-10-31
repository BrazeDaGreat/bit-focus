import { z } from "zod";
import type { ExportedData } from "./SaveManager";
import { deserializeAttachment, deserializeTaskFilter, deserializeTasks } from "./task-backup";
import { assetUidsIn, parseNoteContent } from "./notes";

const date = z.string().min(1).refine((value) => Number.isFinite(new Date(value).getTime()));
const id = z.number().int().positive();
const identity = { id: id.optional(), uid: z.string().min(1).optional() };
const dates = { createdAt: date, updatedAt: date };
const optionalDate = date.nullish();
const row = (shape: z.ZodRawShape) => z.object(shape).passthrough();
const title = z.string();
const session = row({ ...identity, tag: z.string(), startTime: date, endTime: date,
  taskUid: z.string().optional(), projectUid: z.string().optional() });

// Keep unknown fields so older and newer row extensions round-trip. Only the
// original three tables are required; later collections may be absent in old files.
const tables = {
  configuration: row({ name: z.string(), dob: optionalDate, webhook: z.string().optional(), currency: z.string().optional() }),
  focus: session,
  notes: row({ ...identity, ...dates, title, type: z.enum(["document", "board"]),
    content: z.string().optional(), parentId: id.nullish(), deletedAt: optionalDate,
    order: z.number().finite().optional(), icon: z.string().optional(),
    boardData: z.array(z.object({ category: z.string(), children: z.array(id) })).optional() }),
  projects: row({ ...identity, ...dates, title, status: z.enum(["Scheduled", "Active", "Closed"]),
    notes: z.string(), version: z.string().optional(),
    quickLinks: z.array(z.object({ title: z.string(), url: z.string() }).passthrough()).optional() }),
  milestones: row({ ...identity, ...dates, title, projectId: id,
    status: z.enum(["Scheduled", "Active", "Closed", "Paid"]), deadline: optionalDate, budget: z.number().finite() }),
  issues: row({ ...identity, ...dates, title, milestoneId: id, status: z.enum(["Open", "Close"]),
    label: z.string(), description: z.string(), dueDate: optionalDate }),
  rewards: row({ ...identity, ...dates, title, cost: z.number().finite(), description: z.string().optional() }),
  discounts: row({ ...identity, ...dates, title, percentage: z.number().finite(), active: z.boolean() }),
  aiChats: row({ ...dates, id: z.string().min(1), title, modelId: z.string(), provider: z.string(), messages: z.string() }),
  aiConfig: row({ key: z.string().min(1), baseUrl: z.string().optional(), apiKey: z.string().optional(),
    groqApiKey: z.string().optional(), googleApiKey: z.string().optional(),
    customContextEnabled: z.boolean().optional(), customPrompt: z.string().optional(), defaultModelId: z.string().optional() }),
  timeblocks: session,
  timeblockTemplates: row({ ...identity, ...dates, name: z.string(), blocks: z.array(row({ tag: z.string(),
    startMinutes: z.number().finite(), endMinutes: z.number().finite() })) }),
  tasks: row({ ...identity, ...dates, title, description: z.string(),
    projectId: id.nullish(), parentId: id.nullish(), parentUid: z.string().min(1).nullish(),
    tags: z.array(z.string()), estimateMinutes: z.number().finite(), priority: z.number().int(), order: z.number().finite(),
    dueDate: optionalDate, completedAt: optionalDate, deletedAt: optionalDate }),
  taskFilters: row({ ...identity, ...dates, name: z.string(), criteria: z.object({}).passthrough() }),
  taskAttachments: row({ ...identity, uid: z.string().min(1), taskUid: z.string().min(1),
    name: z.string(), type: z.string(), size: z.number().int().nonnegative(), createdAt: date, base64: z.string() }),
  noteAssets: row({ ...identity, ...dates, uid: z.string().min(1), noteUid: z.string().min(1),
    name: z.string(), type: z.string().regex(/^image\/[\w.+-]+$/), dataUrl: z.string(),
    width: id, height: id, size: z.number().int().nonnegative() }),
  legacyTasks: row({ ...identity, task: z.string().optional(), title: z.string().optional(),
    description: z.string().optional(), tags: z.array(z.string()).optional() })
    .refine((task) => typeof task.task === "string" || typeof task.title === "string"),
};

/** Reject malformed rows before any table or localStorage is cleared. Never echo values. */
export function validateBackup(value: unknown): asserts value is ExportedData {
  const root = z.object({ localStorage: z.record(z.string()), indexedDB: z.record(z.unknown()) }).safeParse(value);
  if (!root.success) throw new Error("This is not a valid BIT Focus backup.");
  const data = value as ExportedData;
  for (const [name, schema] of Object.entries(tables)) {
    const rows = root.data.indexedDB[name];
    if (rows === undefined && !["configuration", "focus", "notes"].includes(name)) continue;
    if (!z.array(schema).safeParse(rows).success)
      throw new Error(`Backup contains invalid ${name} data.`);
    // Duplicate keys would otherwise fail during bulkAdd, after replacement starts.
    for (const key of ["id", "uid", ...(name === "configuration" ? ["name"] : []), ...(name === "aiConfig" ? ["key"] : [])]) {
      const seen = new Set<unknown>();
      for (const record of rows as Record<string, unknown>[]) {
        if (record[key] === undefined) continue;
        if (seen.has(record[key])) throw new Error(`Backup contains duplicate ${name} records.`);
        seen.add(record[key]);
      }
    }
  }
  // Reuse the task import contracts, including parent links and decoded file sizes.
  const tasks = deserializeTasks(data.indexedDB.tasks ?? []);
  data.indexedDB.taskFilters?.forEach(deserializeTaskFilter);
  data.indexedDB.taskAttachments?.forEach((file) => {
    deserializeAttachment(file);
    if (data.indexedDB.tasks && !tasks.some((task) => task.uid === file.taskUid))
      throw new Error("Backup contains a task attachment with a missing task.");
  });
  for (const asset of data.indexedDB.noteAssets ?? []) {
    const prefix = `data:${asset.type};base64,`;
    if (!asset.dataUrl.startsWith(prefix)) throw new Error("Backup contains invalid note image data.");
    try {
      if (atob(asset.dataUrl.slice(prefix.length)).length !== asset.size)
        throw new Error();
    } catch {
      throw new Error("Backup contains invalid note image data or size.");
    }
  }
  if (data.backup !== undefined) {
    const metadata = z.object({ format: z.literal("bitfocus"), version: z.literal(1), createdAt: date,
      files: z.enum(["included", "omitted"]) }).safeParse(data.backup);
    if (!metadata.success || (data.backup.files === "included"
      ? data.indexedDB.noteAssets === undefined || data.indexedDB.taskAttachments === undefined
      : data.indexedDB.noteAssets !== undefined || data.indexedDB.taskAttachments !== undefined))
      throw new Error("Backup file coverage does not match its contents.");
  }
}

/** Counts and coverage only: no titles, keys, prompts, webhook URLs, or credentials. */
export function backupPreview(data: ExportedData) {
  const tables = data.indexedDB;
  const images = tables.noteAssets;
  const attachments = tables.taskAttachments;
  const imageUids = new Set(images?.map((asset) => asset.uid));
  const referencedImages = new Set(tables.notes.flatMap((note) => {
    const content = parseNoteContent(note.content);
    return typeof content === "string" ? [] : [...assetUidsIn(content)];
  }));
  return {
    counts: {
      tasks: tables.tasks?.length ?? (tables.legacyTasks?.length ?? 0) + (tables.issues?.length ?? 0),
      notes: tables.notes.length, projects: tables.projects?.length ?? 0,
      milestones: tables.milestones?.length ?? 0, issues: tables.issues?.length ?? 0,
      focusSessions: tables.focus.length, timeblocks: tables.timeblocks?.length ?? 0,
      timeblockTemplates: tables.timeblockTemplates?.length ?? 0,
      rewards: tables.rewards?.length ?? 0, discounts: tables.discounts?.length ?? 0,
      chats: tables.aiChats?.length ?? 0, savedFilters: tables.taskFilters?.length ?? 0,
    },
    noteImages: { included: images !== undefined, count: images?.length ?? 0 },
    taskAttachments: { included: attachments !== undefined, count: attachments?.length ?? 0 },
    files: images !== undefined && attachments !== undefined ? "included" as const
      : images === undefined && attachments === undefined ? "omitted" as const : "partial" as const,
    missingNoteImages: [...referencedImages].filter((uid) => !imageUids.has(uid)).length,
  };
}
