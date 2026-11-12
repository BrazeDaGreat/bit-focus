import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";

async function seedWorkspace(page: Page, route = "/projects") {
  await page.goto(route);
  await expect(page.getByRole("button", { name: "Begin setup", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dueDay = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const deadline = { dueDay, dueDate: yesterday };
    const tx = db.transaction(["configuration", "projects", "task_items", "notes"], "readwrite");
    tx.objectStore("configuration").put({ name: "Search tester", uid: "search-profile", dob: null, webhook: "", currency: "USD" });
    tx.objectStore("projects").put({ id: 1, uid: "search-project", title: "Website", status: "Active", notes: "", createdAt: now, updatedAt: now });
    tx.objectStore("projects").put({ id: 2, uid: "archived-project", title: "Archive", status: "Closed", notes: "", createdAt: now, updatedAt: now });
    const base = { description: "", estimateMinutes: 0, order: 0, createdAt: now, updatedAt: now };
    const tasks = [
      { id: 1, uid: "search-parent", projectId: 1, title: "Launch preparation", tags: ["Work"], priority: 0 },
      { id: 2, uid: "search-child", projectId: 1, parentId: 1, title: "Gather approval", tags: ["Work"], priority: 3, ...deadline, description: "<p>Find the cobalt review phrase</p>" },
      { id: 3, uid: "search-other", projectId: 1, title: "Order supplies", tags: ["Personal"], priority: 1 },
      { id: 4, uid: "search-done", projectId: 1, title: "Finished review", tags: ["Work"], priority: 3, ...deadline, completedAt: now },
      { id: 5, uid: "search-trash", projectId: 1, title: "Discarded checklist", tags: ["Work"], priority: 3, ...deadline, deletedAt: now },
      { id: 6, uid: "search-archived", projectId: 2, title: "Archived approval", tags: ["Work"], priority: 3, ...deadline },
      { id: 7, uid: "search-release", projectId: 1, title: "Unrelated release", tags: ["Work"], priority: 3, ...deadline },
    ];
    for (const task of tasks) tx.objectStore("task_items").put({ ...base, ...task });
    const note = { type: "document", createdAt: now, updatedAt: now };
    tx.objectStore("notes").put({ ...note, id: 1, uid: "search-note", title: "Research notebook", content: JSON.stringify({ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Before launch, verify the cobalt observatory handoff. Keep the checklist with the team." }] },
      { type: "image", attrs: { src: "PRIVATE_ATTR_NEEDLE" } },
    ] }) });
    tx.objectStore("notes").put({ ...note, id: 2, uid: "search-template", title: "Hidden template", content: "cobalt observatory", isTemplate: true });
    tx.objectStore("notes").put({ ...note, id: 3, uid: "search-trashed", title: "Trashed match", content: "cobalt observatory", deletedAt: now });
    tx.objectStore("notes").put({ ...note, id: 4, uid: "legacy-note", title: "Old field notes", content: "<p>The amber &amp; silver checklist.</p>" });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("banner").getByRole("heading", { name: route.startsWith("/settings") ? "Settings" : "Projects", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(route.startsWith("/settings")
    ? page.getByRole("button", { name: "Export complete backup", exact: true })
    : page.getByRole("textbox", { name: "Search tasks", exact: true })).toBeVisible({ timeout: 30_000 });
}

test("command palette finds Notes body text, shows snippets, and excludes hidden content", async ({ page }) => {
  await seedWorkspace(page);
  await page.getByRole("button", { name: "Search and commands Ctrl K", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  const input = palette.getByRole("combobox");
  await input.fill("cobalt observatory");
  const result = palette.getByRole("option").filter({ hasText: "Research notebook" });
  await expect(result).toBeVisible();
  await expect(result).toContainText("cobalt observatory handoff");
  await expect(palette.getByText("Hidden template", { exact: true })).toHaveCount(0);
  await expect(palette.getByText("Trashed match", { exact: true })).toHaveCount(0);
  await input.fill("PRIVATE_ATTR_NEEDLE");
  await expect(palette.getByRole("option").filter({ hasText: "Research notebook" })).toHaveCount(0);
  await input.fill("amber & silver");
  await expect(palette.getByRole("option").filter({ hasText: "Old field notes" })).toBeVisible();
  await input.fill("cobalt observatory");
  await result.click();
  await expect(page).toHaveURL(/\/notes\?page=search-note$/, { timeout: 30_000 });
  await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveValue("Research notebook");
});

for (const mobile of [false, true]) {
  test(`task filters combine and reveal matching subtasks on ${mobile ? "mobile" : "desktop"}`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await seedWorkspace(page);
    const search = page.getByRole("textbox", { name: "Search tasks", exact: true });
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill("cobalt");
    await page.getByRole("combobox", { name: "Filter by tag", exact: true }).selectOption("Work");
    await page.getByRole("combobox", { name: "Filter by priority", exact: true }).selectOption("3");
    await page.getByRole("button", { name: "Overdue only", exact: true }).click();
    await expect(page.getByRole("button", { name: "Overdue only", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Open Gather approval", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Launch preparation", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Unrelated release", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open Archived approval", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open Finished review", exact: true })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "1 matching task" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("task-filters.png") });
    await page.getByRole("button", { name: "Open Gather approval", exact: true }).click();
    await expect(page).toHaveURL(/task=search-child/);
    await page.getByRole("button", { name: "Close task details", exact: true }).click();
    await expect(search).toHaveValue("cobalt");
    await page.getByRole("combobox", { name: "Filter by tag", exact: true }).selectOption("Personal");
    await expect(page.getByRole("status").filter({ hasText: "No tasks match these filters" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(page.getByRole("button", { name: "Open Order supplies", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Unrelated release", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const mobile of [false, true]) {
  test(`Settings storage and complete backup health on ${mobile ? "mobile" : "desktop"}`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      let persistent = false;
      Object.defineProperty(navigator, "storage", { configurable: true, value: {
        estimate: async () => ({ usage: 64 * 1024 * 1024, quota: 256 * 1024 * 1024 }),
        persisted: async () => persistent,
        persist: async () => { persistent = true; return true; },
      } });
    });
    await seedWorkspace(page, "/settings#data");
    const storage = page.getByRole("group", { name: "Browser storage", exact: true });
    await expect(storage).toContainText("64 MB used of 256 MB");
    await expect(storage.getByRole("meter")).toHaveAttribute("aria-valuenow", "25");
    await expect(page.getByRole("button", { name: "Keep browser storage", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Keep browser storage", exact: true }).click();
    await expect(page.getByRole("button", { name: "Keep browser storage", exact: true })).toHaveCount(0);
    const backupHealth = page.getByRole("group", { name: "Last complete backup", exact: true });
    await expect(backupHealth).toContainText("No complete backup recorded on this device");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export complete backup", exact: true }).click();
    const download = await downloadPromise;
    const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(backup.backup.files).toBe("included");
    expect(backup.localStorage["bitfocus.lastCompleteBackup"]).toBeUndefined();
    expect(backup.localStorage["bitfocus.lastCompleteBackupSource"]).toBeUndefined();
    await expect.poll(() => page.evaluate(() => Number(localStorage.getItem("bitfocus.lastCompleteBackup")))).toBeGreaterThan(0);
    await expect(backupHealth).toContainText("Download started");
    await page.screenshot({ path: testInfo.outputPath("storage-health.png") });
    await page.reload();
    await expect(page.getByRole("button", { name: "Export complete backup", exact: true })).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => Number(localStorage.getItem("bitfocus.lastCompleteBackup")))).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("Settings remains usable without browser storage APIs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(navigator, "storage", { configurable: true, value: undefined }));
  await seedWorkspace(page, "/settings#data");
  await expect(page.getByText("Browser storage", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export complete backup", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
