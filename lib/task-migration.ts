import type { Transaction } from "dexie";
import type { Task } from "./tasks";
import { HLC_ZERO } from "./sync/hlc";

/** Deterministic identities make conversion safe on independently upgraded devices.
 * Legacy rows remain available for budgets, payment states and older backups.
 */
export async function migrateTasks(tx: Transaction, restore = false) {
  const migrationTx = tx as Transaction & { isTaskMigration?: boolean };
  migrationTx.isTaskMigration = !restore;
  try {
    const tasks = tx.table<Task, number>("task_items");
    const milestones = await tx.table("milestones").toArray();
    const projects = await tx.table("projects").toArray();
    for (const issue of await tx.table("issues").toArray()) {
      if (!issue.uid) {
        issue.uid = crypto.randomUUID();
        await tx.table("issues").update(issue.id, { uid: issue.uid });
      }
      const uid = `issue-task:${issue.uid}`;
      if (await tasks.where("uid").equals(uid).count()) continue;
      if (
        !restore &&
        (await tx.table("sync_state").get(["tasks", uid]))?.deleted
      )
        continue;
      const milestone = milestones.find((m) => m.id === issue.milestoneId);
      await tasks.add({
        uid,
        projectId:
          milestone && projects.some((p) => p.id === milestone.projectId)
            ? milestone.projectId
            : null,
        title: issue.title,
        description: issue.description || "",
        tags: [],
        estimateMinutes: 0,
        priority: 0,
        order: issue.id,
        section: milestone?.title,
        dueDate: issue.dueDate || null,
        dueTime: false,
        dueDay: issue.dueDate
          ? new Date(issue.dueDate).toISOString().slice(0, 10)
          : null,
        completedAt: issue.status === "Close" ? issue.updatedAt : null,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        legacyIssueUid: issue.uid,
        legacyLabel: issue.label,
      });
      await tx
        .table("sync_state")
        .put({ col: "tasks", uid, hlc: HLC_ZERO, dirty: 1, deleted: 0 });
    }
    for (const old of await tx.table("tasks").toArray()) {
      if (!old.uid) {
        old.uid = crypto.randomUUID();
        await tx.table("tasks").update(old.id, { uid: old.uid });
      }
      const uid = `old-task:${old.uid}`;
      if (await tasks.where("uid").equals(uid).count()) continue;
      if (
        !restore &&
        (await tx.table("sync_state").get(["tasks", uid]))?.deleted
      )
        continue;
      const due = old.duedate ? new Date(old.duedate) : null;
      await tasks.add({
        uid,
        title: old.task || old.title || "Untitled task",
        description: [
          old.description || "",
          ...(Array.isArray(old.subtasks)
            ? old.subtasks.map(
                (step: unknown, i: number) =>
                  `- [${old.completedSubtasks?.[i] ? "x" : " "}] ${String(step)}`,
              )
            : []),
        ]
          .filter(Boolean)
          .join("\n"),
        tags: Array.isArray(old.tags)
          ? old.tags.filter((t: unknown) => typeof t === "string")
          : [],
        dueDate: due && Number.isFinite(due.getTime()) ? due : null,
        dueDay:
          due && Number.isFinite(due.getTime())
            ? due.toISOString().slice(0, 10)
            : null,
        dueTime: false,
        priority: Math.max(0, Math.min(3, Number(old.priority) || 0)),
        estimateMinutes: 0,
        order: old.id,
        completedAt: old.completed ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await tx
        .table("sync_state")
        .put({ col: "tasks", uid, hlc: HLC_ZERO, dirty: 1, deleted: 0 });
    }
  } finally {
    migrationTx.isTaskMigration = false;
  }
}
