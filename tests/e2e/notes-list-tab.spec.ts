import { test, expect, type Page } from "@playwright/test";

/** A page with two headings, so the outline rail renders, and a two-item bullet list. */
async function seedListNote(page: Page) {
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
    const item = (text: string) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
    tx.objectStore("notes").put({
      id: 1, uid: "list-note", title: "List test", type: "document",
      parentId: null, order: 0, createdAt: new Date(), updatedAt: new Date(),
      content: JSON.stringify({ type: "doc", content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "First heading" }] },
        { type: "bulletList", content: [item("Top item"), item("Second item")] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Second heading" }] },
      ] }),
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/notes?page=list-note");
}

test("Tab indents bullet items and never leaves the editor for the outline", async ({ page }) => {
  await seedListNote(page);
  const editor = page.getByRole("textbox", { name: "Page content", exact: true });
  await expect(editor).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Page outline" })).toBeAttached();

  // The first item has nothing to nest under: Tab is swallowed, focus stays put.
  await editor.getByText("Top item", { exact: true }).click();
  await page.keyboard.press("Tab");
  await expect(editor).toBeFocused();
  await expect(editor.locator("ul ul")).toHaveCount(0);

  await editor.getByText("Second item", { exact: true }).click();
  await page.keyboard.press("Tab");
  await expect(editor).toBeFocused();
  await expect(editor.locator("ul ul li")).toHaveText("Second item");

  await page.keyboard.press("Shift+Tab");
  await expect(editor).toBeFocused();
  await expect(editor.locator("ul ul")).toHaveCount(0);

  // The outline stays out of the tab order; it is for the mouse.
  await expect(page.getByRole("navigation", { name: "Page outline" }).getByRole("button").first()).toHaveAttribute("tabindex", "-1");
});
