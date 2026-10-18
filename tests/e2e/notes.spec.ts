import { test, expect } from "@playwright/test";

test("bold shortcuts leave the sidebar unchanged while editing notes", async ({ page }) => {
  await page.goto("/notes");
  await expect(page.getByRole("button", { name: "Begin setup", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(["configuration", "notes"], "readwrite");
    tx.objectStore("configuration").put({
      name: "Notes tester", uid: "test-profile", dob: null,
      webhook: "", currency: "USD", sendWebhookUpdates: false,
    });
    tx.objectStore("notes").put({
      id: 1, uid: "shortcut-note", title: "Shortcut test", type: "document",
      parentId: null, order: 0, createdAt: new Date(), updatedAt: new Date(),
      content: JSON.stringify({ type: "doc", content: [{
        type: "paragraph", content: [{ type: "text", text: "Format this text" }],
      }] }),
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/notes?page=shortcut-note");
  const editor = page.getByRole("textbox", { name: "Page content", exact: true });
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await expect(editor).toBeVisible();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");

  await editor.click();
  await editor.press("ControlOrMeta+a");
  await editor.press("ControlOrMeta+b");
  await expect(editor.locator("strong")).toHaveText("Format this text");
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await editor.press("ControlOrMeta+b");
  await expect(editor.locator("strong")).toHaveCount(0);
  await expect(sidebar).toHaveAttribute("data-state", "expanded");

  for (const modifier of ["Control", "Meta"]) {
    await editor.press(`${modifier}+b`);
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await page.getByRole("textbox", { name: "Page title", exact: true }).press(`${modifier}+b`);
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await page.getByRole("searchbox", { name: "Search pages", exact: true }).press(`${modifier}+b`);
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    await page.getByRole("button", { name: "Hide pages", exact: true }).focus();
    await page.keyboard.press(`${modifier}+b`);
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await page.keyboard.press(`${modifier}+b`);
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
  }
});
