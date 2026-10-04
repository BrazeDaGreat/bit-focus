import "fake-indexeddb/auto";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import Dexie from "dexie";
import db from "../lib/db";
import SaveManager from "../lib/SaveManager";
import { migrateTasks } from "../lib/task-migration";
import { useTasks, ensureTaskMigration } from "../hooks/useTasks";
import {
  isTaskOverdue,
  matchesTask,
  taskDeadline,
  taskMinutes,
  type Task,
} from "../lib/tasks";
import {
  serializeTask,
  deserializeTask,
  deserializeTaskFilter,
} from "../lib/task-backup";
import { COLLECTION_BY_KEY } from "../lib/sync/registry";
import { IdCache, toWire, fromWire } from "../lib/sync/codec";
import { applyRecords } from "../lib/sync/apply";
import { HLC_ZERO, hlcNow } from "../lib/sync/hlc";
import type { RemoteRecord } from "../lib/sync/transport";
import { installTracking } from "../lib/sync/tracker";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    get length() {
      return storage.size;
    },
    key: (i: number) => [...storage.keys()][i] ?? null,
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  configurable: true,
});
const at = new Date("2026-09-29T10:00:00Z");
const task: Task = {
  uid: "task-a",
  title: "Write docs",
  description: "Notes",
  tags: ["Work"],
  priority: 2,
  order: 1,
  estimateMinutes: 60,
  createdAt: at,
  updatedAt: at,
};
const project = {
  uid: "project-a",
  title: "Website",
  status: "Active" as const,
  notes: "Keep notes",
  version: "1.2",
  quickLinks: [],
  createdAt: at,
  updatedAt: at,
};

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await db.delete();
  storage.clear();
  useTasks.setState({ tasks: [], filters: [], loading: true, error: null });
});

test("v12 upgrade preserves milestone metadata, converts closed and open issues, and resets the pull cursor", async () => {
  const old = new Dexie("BitFocusDB");
  old.version(12).stores({
    configuration: "name, &uid",
    focus: "++id, tag, startTime, endTime, &uid",
    tasks: "++id, task, duedate, tags, priority, completed",
    notes: "++id, title, type, parentId, createdAt, updatedAt, &uid",
    projects: "++id, title, status, createdAt, updatedAt, &uid",
    milestones:
      "++id, projectId, title, status, deadline, createdAt, updatedAt, &uid",
    issues:
      "++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt, &uid",
    rewards: "++id, title, cost, category, createdAt, updatedAt, &uid",
    discounts: "++id, title, percentage, active, createdAt, updatedAt, &uid",
    excalidraw_v2: "id, title, createdAt, updatedAt, &uid",
    timeblocks: "++id, tag, startTime, endTime, &uid",
    ai_chats: "id, createdAt, updatedAt",
    ai_config: "key",
    sync_state: "[col+uid], col, dirty",
    sync_meta: "key",
    sync_backup: "++id, createdAt",
  });
  await old.open();
  await old.table("projects").add({ ...project, id: 9 });
  await old.table("milestones").add({
    id: 4,
    uid: "milestone-a",
    projectId: 9,
    title: "Launch",
    budget: 500,
    status: "Paid",
    deadline: at,
    createdAt: at,
    updatedAt: at,
  });
  await old.table("issues").bulkAdd([
    {
      id: 1,
      uid: "issue-a",
      milestoneId: 4,
      title: "Open issue",
      label: "Feature",
      description: "Details",
      dueDate: at,
      status: "Open",
      createdAt: at,
      updatedAt: at,
    },
    {
      id: 2,
      uid: "issue-b",
      milestoneId: 4,
      title: "Done issue",
      label: "Bug",
      description: "",
      status: "Close",
      createdAt: at,
      updatedAt: at,
    },
  ]);
  await old.table("tasks").add({
    task: "Old todo",
    tags: ["Work"],
    completed: false,
    subtasks: ["Step one"],
    completedSubtasks: [true],
  });
  await old.table("sync_meta").put({ key: "cursor", value: "2026-09-30" });
  old.close();
  await db.open();
  const rows = await db.tasks.toArray();
  assert.equal(rows.length, 3);
  assert.equal(rows.find((t) => t.uid === "issue-task:issue-a")?.projectId, 9);
  assert.equal(
    rows.find((t) => t.uid === "issue-task:issue-a")?.section,
    "Launch",
  );
  assert.equal(
    rows.find((t) => t.uid === "issue-task:issue-a")?.legacyLabel,
    "Feature",
  );
  assert.ok(
    rows.find((t) => t.uid === "issue-task:issue-b")?.completedAt instanceof
      Date,
  );
  assert.equal((await db.milestones.get(4))?.budget, 500);
  assert.equal((await db.milestones.get(4))?.status, "Paid");
  assert.equal(await db.syncMeta.get("cursor"), undefined);
  assert.equal(await db.syncBackup.count(), 1);
  await db.tasks.update(rows[0].id!, {
    title: "Edited after upgrade",
    tags: ["Work"],
    deletedAt: at,
  });
  await ensureTaskMigration();
  assert.equal(await db.tasks.count(), 3);
  assert.equal(
    (await db.tasks.get(rows[0].id!))?.title,
    "Edited after upgrade",
  );
});

test("date-only deadlines survive time zone changes; exact deadlines become overdue at their time", () => {
  const due: Task = {
    ...task,
    dueDay: "2026-09-30",
    dueDate: new Date("2026-09-29T19:00:00Z"),
    dueTime: false,
  };
  const original = process.env.TZ;
  try {
    for (const zone of [
      "Asia/Karachi",
      "America/Los_Angeles",
      "Pacific/Auckland",
    ]) {
      process.env.TZ = zone;
      const midday = new Date("2026-09-30T12:00:00");
      assert.equal(taskDeadline(due)?.getDate(), 30);
      assert.equal(isTaskOverdue(due, midday), false);
      assert.equal(
        matchesTask(
          due,
          { date: "today", tag: "Work", priority: 2, maxEstimate: 60 },
          midday,
        ),
        true,
      );
      assert.equal(isTaskOverdue(due, new Date("2026-10-01T00:00:00")), true);
      assert.equal(
        isTaskOverdue(
          { ...due, dueTime: true, dueDate: new Date("2026-09-30T09:00:00") },
          midday,
        ),
        true,
      );
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("multiple focus sessions count only the selected task and completion/trash filtering works", () => {
  const session = {
    tag: "Work",
    startTime: at,
    endTime: new Date(at.getTime() + 30 * 60000),
  };
  assert.equal(
    taskMinutes(task, [
      { ...session, taskUid: "task-a" },
      { ...session, taskUid: "task-a" },
      { ...session, taskUid: "task-b" },
      session,
    ]),
    60,
  );
  assert.equal(
    matchesTask({ ...task, completedAt: at }, { completion: "active" }),
    false,
  );
  assert.equal(
    matchesTask({ ...task, completedAt: at }, { completion: "completed" }),
    true,
  );
  assert.equal(
    matchesTask({ ...task, deletedAt: at }, { completion: "all" }),
    false,
  );
  assert.equal(matchesTask(task, { projectId: null, date: "undated" }), true);
});

test("task CRUD rejects invalid edits, restores trash, and preserves stable identities", async () => {
  await db.open();
  const id = await useTasks
    .getState()
    .addTask("  New task  ", { tags: ["Work"] });
  const uid = (await db.tasks.get(id))!.uid;
  await assert.rejects(useTasks.getState().updateTask(id, { title: " " }));
  await assert.rejects(
    useTasks.getState().updateTask(id, { estimateMinutes: -1 }),
  );
  await useTasks.getState().updateTask(id, { uid: "wrong", deletedAt: at });
  assert.equal((await db.tasks.get(id))!.uid, uid);
  await useTasks
    .getState()
    .updateTask(id, { deletedAt: null, completedAt: at, estimateMinutes: 45 });
  assert.equal((await db.tasks.get(id))!.estimateMinutes, 45);
  assert.equal((await db.tasks.get(id))!.deletedAt, null);
});

test("backup round trip includes tasks, filters, focus attribution, blocks, and protected device metadata", async () => {
  await db.open();
  await db.projects.add({ ...project, id: 12 });
  await db.tasks.add({
    ...task,
    id: 5,
    projectId: 12,
    completedAt: at,
    dueDate: at,
  });
  await db.taskFilters.add({
    uid: "filter-a",
    name: "Short work",
    criteria: { projectId: 12, tag: "Work", maxEstimate: 60 },
    createdAt: at,
    updatedAt: at,
  });
  await db.focus.add({
    tag: "Work",
    taskUid: "task-a",
    projectUid: "project-a",
    startTime: at,
    endTime: new Date(at.getTime() + 60000),
  });
  await db.timeblocks.add({
    tag: "Work",
    taskUid: "task-a",
    projectUid: "project-a",
    startTime: at,
    endTime: new Date(at.getTime() + 60000),
  });
  localStorage.setItem("bitfocus.sync.clock", "device clock");
  const backup = await SaveManager.exportJSON();
  assert.equal(backup.localStorage["bitfocus.sync.clock"], undefined);
  await SaveManager.importJSON(JSON.parse(JSON.stringify(backup)));
  assert.ok((await db.tasks.get(5))!.completedAt instanceof Date);
  assert.equal((await db.taskFilters.toArray())[0].criteria.projectId, 12);
  assert.equal((await db.focus.toArray())[0].taskUid, "task-a");
  assert.equal((await db.timeblocks.toArray())[0].taskUid, "task-a");
  assert.equal(localStorage.getItem("bitfocus.sync.clock"), "device clock");
  const invalid = {
    ...backup,
    indexedDB: {
      ...backup.indexedDB,
      tasks: [{ ...serializeTask(task), dueDate: "invalid" }],
    },
  };
  await assert.rejects(SaveManager.importJSON(invalid));
  assert.equal(await db.tasks.count(), 1);
  assert.deepEqual(deserializeTask(serializeTask(task)), {
    ...task,
    dueDate: null,
    completedAt: null,
    deletedAt: null,
  });
});

test("old backups convert issues inside restore, even if their task was previously tombstoned", async () => {
  await db.open();
  await db.projects.add({ ...project, id: 1 });
  await db.milestones.add({
    id: 1,
    uid: "m",
    projectId: 1,
    title: "Phase",
    budget: 100,
    status: "Active",
    createdAt: at,
    updatedAt: at,
  });
  await db.issues.add({
    id: 1,
    uid: "i",
    milestoneId: 1,
    title: "Imported",
    label: "Bug",
    description: "",
    status: "Open",
    createdAt: at,
    updatedAt: at,
  });
  const backup = await SaveManager.exportJSON();
  delete backup.indexedDB.tasks;
  await db.syncState.put({
    col: "tasks",
    uid: "issue-task:i",
    hlc: hlcNow(),
    dirty: 0,
    deleted: 1,
  });
  await ensureTaskMigration();
  assert.equal(await db.tasks.count(), 0);
  await SaveManager.importJSON(backup);
  assert.equal(await db.tasks.count(), 1);
  assert.equal((await db.tasks.toArray())[0].title, "Imported");
});

test("task and saved-filter project references translate across different device-local ids", async () => {
  await db.open();
  await db.projects.add({ ...project, id: 12 });
  const tasks = COLLECTION_BY_KEY.get("tasks")!,
    filters = COLLECTION_BY_KEY.get("taskFilters")!;
  const wire = await toWire(
    tasks,
    { ...task, projectId: 12, id: 4 },
    new IdCache(),
  );
  const filterWire = await toWire(
    filters,
    {
      uid: "f",
      name: "Work",
      criteria: { projectId: 12, tag: "Work" },
      createdAt: at,
      updatedAt: at,
    },
    new IdCache(),
  );
  await db.projects.delete(12);
  await db.projects.add({ ...project, id: 99 });
  const decoded = await fromWire(tasks, wire, "task-a", new IdCache());
  const decodedFilter = await fromWire(filters, filterWire, "f", new IdCache());
  assert.equal(decoded.row.projectId, 99);
  assert.equal(
    (decodedFilter.row.criteria as { projectId: number }).projectId,
    99,
  );
  assert.equal(decoded.unresolved.length, 0);
});

test("remote task edits win over derived migration records and tombstones prevent recreation", async () => {
  await db.open();
  await db.projects.add({ ...project, id: 1 });
  await db.milestones.add({
    id: 1,
    uid: "m",
    projectId: 1,
    title: "Phase",
    budget: 100,
    status: "Active",
    createdAt: at,
    updatedAt: at,
  });
  await db.issues.add({
    id: 1,
    uid: "i",
    milestoneId: 1,
    title: "Before",
    label: "Bug",
    description: "",
    status: "Open",
    createdAt: at,
    updatedAt: at,
  });
  await ensureTaskMigration();
  assert.equal(
    (await db.syncState.get(["tasks", "issue-task:i"]))?.hlc,
    HLC_ZERO,
  );
  const record = {
    col: "tasks",
    uid: "issue-task:i",
    hlc: hlcNow(),
    deleted: false,
    data: {
      ...serializeTask(task),
      projectIdUid: "project-a",
      title: "Updated remotely",
      estimateMinutes: 90,
    },
  } as unknown as RemoteRecord;
  await applyRecords([record]);
  assert.equal((await db.tasks.toArray())[0].title, "Updated remotely");
  await applyRecords([{ ...record, hlc: hlcNow(), deleted: true, data: null }]);
  await db.transaction(
    "rw",
    [
      db.tasks,
      db.projects,
      db.milestones,
      db.issues,
      db.table("tasks"),
      db.syncState,
    ],
    migrateTasks,
  );
  assert.equal(await db.tasks.count(), 0);
});

test("invalid task effort and filter criteria reject the backup before clearing data", async () => {
  await db.open();
  await db.tasks.add(task);
  const backup = await SaveManager.exportJSON();
  backup.indexedDB.tasks![0].estimateMinutes = -1;
  await assert.rejects(SaveManager.importJSON(backup), /invalid task/);
  assert.equal(await db.tasks.count(), 1);
  assert.throws(
    () =>
      deserializeTaskFilter({
        name: "Broken",
        criteria: { priority: 9 },
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
      }),
    /invalid task filter/,
  );
});

test("backup restores with sync hooks keep migrated tasks live and mark them as local changes", async () => {
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
  });
  installTracking();
  await db.open();
  await db.projects.add({ ...project, id: 1 });
  await db.milestones.add({
    id: 1,
    uid: "m",
    projectId: 1,
    title: "Phase",
    budget: 100,
    status: "Active",
    createdAt: at,
    updatedAt: at,
  });
  await db.issues.add({
    id: 1,
    uid: "i",
    milestoneId: 1,
    title: "Restored",
    label: "Bug",
    description: "",
    status: "Open",
    createdAt: at,
    updatedAt: at,
  });
  await ensureTaskMigration();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(
    (await db.syncState.get(["tasks", "issue-task:i"]))?.hlc,
    HLC_ZERO,
  );
  const backup = await SaveManager.exportJSON();
  await SaveManager.importJSON(backup);
  await new Promise((resolve) => setTimeout(resolve, 30));
  let stamp = await db.syncState.get(["tasks", "issue-task:i"]);
  assert.equal(stamp?.deleted, 0);
  assert.equal(stamp?.dirty, 1);
  assert.notEqual(stamp?.hlc, HLC_ZERO);
  delete backup.indexedDB.tasks;
  await SaveManager.importJSON(backup);
  await new Promise((resolve) => setTimeout(resolve, 30));
  stamp = await db.syncState.get(["tasks", "issue-task:i"]);
  assert.equal(await db.tasks.count(), 1);
  assert.equal(stamp?.deleted, 0);
  assert.equal(stamp?.dirty, 1);
  assert.notEqual(stamp?.hlc, HLC_ZERO);
  Reflect.deleteProperty(globalThis, "window");
});
