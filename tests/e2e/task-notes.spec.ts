import { test, expect, type Page } from "@playwright/test";

const prefix = "bitfocus.notes.taskBodyDraft.";

async function seed(page: Page) {
  await page.goto("/projects");
  await expect(page.getByRole("button", { name: "Begin setup", exact: true })).toBeVisible({ timeout: 20000 });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(["configuration", "task_items"], "readwrite");
    tx.objectStore("configuration").put({ name: "Notes tester", uid: "profile", dob: null, webhook: "", currency: "USD" });
    for (const [index, name] of ["A", "B", "Trash"].entries()) {
      tx.objectStore("task_items").put({
        id: index + 1, uid: `notes-${name}`, title: `Notes ${name}`, description: `<p>Stored ${name}</p>`,
        tags: [], estimateMinutes: 0, priority: 0, order: index, createdAt: new Date(), updatedAt: new Date(),
        deletedAt: name === "Trash" ? new Date() : null,
      });
    }
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.goto("/projects?project=all&task=notes-A");
  await expect(page.getByRole("textbox", { name: "Task notes", exact: true })).toHaveText("Stored A", { timeout: 20000 });
}

async function body(page: Page, id: number) {
  return page.evaluate(async (taskId) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = db.transaction("task_items").objectStore("task_items").get(taskId);
        request.onsuccess = () => resolve(request.result?.description ?? "");
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, id);
}

test("failed task notes recover after reload and retry keeps latest edits", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { failTaskNotes: boolean };
    state.failTaskNotes = true;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "task_items" && state.failTaskNotes && value.description?.includes("Unsaved recovery"))
        throw new DOMException("Injected task-note failure", "QuotaExceededError");
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
  });
  await seed(page);
  const notes = page.getByRole("textbox", { name: "Task notes", exact: true });
  const section = page.getByRole("region", { name: "Task notes and attachments" });
  await notes.fill("Unsaved recovery");
  await notes.press("ControlOrMeta+s");
  await expect(section.getByRole("status")).toHaveText("Could not save. Draft kept on this device.");
  expect(await page.evaluate((key) => localStorage.getItem(key), `${prefix}notes-A`)).toBe("<p>Unsaved recovery</p>");
  expect(await body(page, 1)).toBe("<p>Stored A</p>");

  await page.reload();
  await expect(notes).toHaveText("Unsaved recovery");
  await expect(section.getByRole("status")).toContainText("Could not save");
  await notes.fill("Unsaved recovery plus newer typing");
  await notes.press("ControlOrMeta+s");
  await expect(section.getByRole("button", { name: "Retry save" })).toBeVisible();
  await page.evaluate(() => { (window as typeof window & { failTaskNotes: boolean }).failTaskNotes = false; });
  await section.getByRole("button", { name: "Retry save" }).click();
  await expect(section.getByRole("status")).toHaveText("Saved");
  expect(await body(page, 1)).toBe("<p>Unsaved recovery plus newer typing</p>");
  expect(await page.evaluate((key) => localStorage.getItem(key), `${prefix}notes-A`)).toBeNull();
});

test("pagehide, hidden visibility and rapid task switching flush into their own task", async ({ page }) => {
  await seed(page);
  const notes = page.getByRole("textbox", { name: "Task notes", exact: true });
  await notes.fill("Saved on pagehide");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await expect.poll(() => body(page, 1)).toBe("<p>Saved on pagehide</p>");
  await notes.fill("Saved when hidden");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => body(page, 1)).toBe("<p>Saved when hidden</p>");
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });

  await notes.fill("A before switching");
  await page.evaluate(() => window.history.pushState(null, "", "/projects?project=all&task=notes-B"));
  await expect(notes).toHaveText("Stored B");
  await notes.fill("B while switching");
  await page.evaluate(() => window.history.pushState(null, "", "/projects?project=all&task=notes-A"));
  await expect(notes).toHaveText("A before switching");
  await notes.fill("A after returning");
  await page.getByRole("button", { name: "Close task details", exact: true }).click();
  await expect(notes).toHaveCount(0);
  await page.waitForLoadState("domcontentloaded");
  await expect.poll(() => body(page, 1)).toBe("<p>A after returning</p>");
  await expect.poll(() => body(page, 2)).toBe("<p>B while switching</p>");
});

test("trashed task retains recovery draft without editing until restored", async ({ page }) => {
  await seed(page);
  await page.evaluate((key) => localStorage.setItem(key, "<p>Recover after restore</p>"), `${prefix}notes-Trash`);
  await page.goto("/projects?project=all&task=notes-Trash");
  const notes = page.getByRole("textbox", { name: "Task notes", exact: true });
  const section = page.getByRole("region", { name: "Task notes and attachments" });
  await expect(notes).toHaveText("Stored Trash");
  await expect(notes).toHaveAttribute("contenteditable", "false");
  await expect(section.getByRole("button", { name: "Bold", exact: true })).toHaveCount(0);
  await expect(section.getByRole("button", { name: "Attach files", exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), `${prefix}notes-Trash`)).toBe("<p>Recover after restore</p>");
  expect(await body(page, 3)).toBe("<p>Stored Trash</p>");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(notes).toHaveAttribute("contenteditable", "true");
  await expect(notes).toHaveText("Recover after restore");
  await expect.poll(() => body(page, 3)).toBe("<p>Recover after restore</p>");
  await expect(section.getByRole("status")).toHaveText("Saved");
});

test("an old editor cannot save into a restored task that reused its local ID", async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("task_items", "readwrite");
    const store = tx.objectStore("task_items");
    const request = store.get(1);
    request.onsuccess = () => store.put({ ...request.result, uid: "replacement-task", description: "<p>Replacement body</p>" });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  });
  const notes = page.getByRole("textbox", { name: "Task notes", exact: true });
  await notes.fill("Old task local edits");
  await notes.press("ControlOrMeta+s");
  await expect(page.getByRole("region", { name: "Task notes and attachments" }).getByRole("status")).toContainText("Could not save");
  expect(await body(page, 1)).toBe("<p>Replacement body</p>");
  expect(await page.evaluate((key) => localStorage.getItem(key), `${prefix}notes-A`)).toBe("<p>Old task local edits</p>");
});
