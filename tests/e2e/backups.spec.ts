import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";

async function seedBackupWorkspace(page: Page) {
  await page.goto("/settings#data");
  await expect(page.getByRole("button", { name: "Begin setup", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const at = new Date();
    const tx = db.transaction(["configuration", "notes", "note_assets", "task_items", "task_attachments"], "readwrite");
    tx.objectStore("configuration").put({ name: "Backup tester", dob: null, webhook: "", currency: "USD" });
    tx.objectStore("notes").put({ id: 1, uid: "backup-note", title: "Local note", type: "document",
      content: "Saved words", createdAt: at, updatedAt: at });
    tx.objectStore("note_assets").put({ uid: "backup-image", noteUid: "backup-note", name: "image.png",
      type: "image/png", dataUrl: "data:image/png;base64,AA==", size: 1, width: 1, height: 1,
      createdAt: at, updatedAt: at });
    tx.objectStore("task_items").put({ id: 1, uid: "backup-task", title: "Local task", description: "",
      tags: [], estimateMinutes: 0, priority: 0, order: 1, createdAt: at, updatedAt: at });
    tx.objectStore("task_attachments").put({ uid: "backup-file", taskUid: "backup-task", name: "work.txt",
      type: "text/plain", blob: new Blob(["Saved file"]), size: 10, createdAt: at });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem("bitfocus.notes.taskBodyDraft.backup-task", "Unsaved local draft");
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Export now", exact: true })).toBeVisible();
}

for (const mobile of [false, true]) {
test(`Settings exports files and confirms restore on ${mobile ? "mobile" : "desktop"}`, async ({ page }, testInfo) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await seedBackupWorkspace(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export now", exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.backup.files).toBe("included");
  expect(backup.indexedDB.noteAssets).toHaveLength(1);
  expect(backup.indexedDB.taskAttachments).toHaveLength(1);
  expect(backup.indexedDB.taskAttachments[0].base64).toBe("U2F2ZWQgZmlsZQ==");
  expect(backup.localStorage["bitfocus.notes.taskBodyDraft.backup-task"]).toBeUndefined();

  backup.indexedDB.configuration[0].name = "Restored tester";
  backup.indexedDB.notes[0].title = "Restored note";
  const file = { name: "restore.bitf.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) };
  const picker = page.locator('input[type="file"][accept=".bitf.json,application/json"]');
  await picker.setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: "Restore this backup?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("File collections included", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Note images: 1 included. Replaces local note images.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Task attachments: 1 included. Replaces local task attachments.", { exact: true })).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(mobile ? 390 : 1600);
  await dialog.screenshot({ path: testInfo.outputPath("restore-preview.png") });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Backup tester");

  await picker.setInputFiles(file);
  await dialog.getByRole("button", { name: "Replace data and restore", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Restored tester", { timeout: 15000 });
  const restored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction(["notes", "note_assets", "task_attachments"]);
    const results = await Promise.all(["notes", "note_assets", "task_attachments"].map((table) =>
      new Promise<unknown[]>((resolve) => {
        const request = tx.objectStore(table).getAll();
        request.onsuccess = () => resolve(request.result);
      })));
    db.close();
    const files = results[2] as { blob: Blob }[];
    return { title: (results[0][0] as { title: string }).title, images: results[1].length,
      file: await files[0].blob.text(), draft: localStorage.getItem("bitfocus.notes.taskBodyDraft.backup-task") };
  });
  expect(restored).toEqual({ title: "Restored note", images: 1, file: "Saved file", draft: "Unsaved local draft" });
});
}

test("invalid restore files are rejected before offering replacement", async ({ page }) => {
  await seedBackupWorkspace(page);
  await page.locator('input[type="file"][accept=".bitf.json,application/json"]').setInputFiles({
    name: "invalid.bitf.json", mimeType: "application/json", buffer: Buffer.from('{"indexedDB":{}}'),
  });
  await expect(page.getByText("That file couldn't be read as a BIT Focus backup. Your data has not changed.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Restore this backup?" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Backup tester");
});
