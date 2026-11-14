import { test, expect, type Page } from "@playwright/test";

async function seedCalendar(page: Page) {
  await page.goto("/calendar");
  await expect(page.getByRole("button", { name: "Begin setup", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("configuration", "readwrite");
    tx.objectStore("configuration").put({ name: "Calendar tester", dob: null, webhook: "", currency: "USD" });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "View options", exact: true })).toBeVisible();
}

async function openOptions(page: Page, submenu: string) {
  await page.getByRole("button", { name: "View options", exact: true }).click();
  const trigger = page.getByRole("menuitem", { name: submenu, exact: true });
  await trigger.focus();
  await trigger.press("ArrowRight");
}

for (const zoom of ["Compact", "Expanded"]) {
  test(`${zoom} zoom and calendar preferences survive refresh and navigation`, async ({ page }) => {
    await seedCalendar(page);
    await page.getByRole("button", { name: "day", exact: true }).click();
    await openOptions(page, "Zoom");
    await page.getByRole("menuitemradio", { name: zoom, exact: true }).click();
    await openOptions(page, "Focus sessions");
    await page.getByRole("menuitemradio", { name: "Full blocks", exact: true }).click();
    await openOptions(page, "Planned blocks");
    await page.getByRole("menuitemradio", { name: "See-through", exact: true }).click();
    await openOptions(page, "Show");
    await page.getByRole("menuitemcheckbox", { name: "Task deadlines", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.reload();
    await expect(page.getByRole("button", { name: "day", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".gcal")).toHaveCSS("--row-h", zoom === "Compact" ? "36px" : "112px");
    await openOptions(page, "Zoom");
    await expect(page.getByRole("menuitemradio", { name: zoom, exact: true })).toBeChecked();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await openOptions(page, "Focus sessions");
    await expect(page.getByRole("menuitemradio", { name: "Full blocks", exact: true })).toBeChecked();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await openOptions(page, "Planned blocks");
    await expect(page.getByRole("menuitemradio", { name: "See-through", exact: true })).toBeChecked();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await openOptions(page, "Show");
    await expect(page.getByRole("menuitemcheckbox", { name: "Task deadlines", exact: true })).not.toBeChecked();

    await page.goto("/focus");
    await page.goto("/calendar");
    await expect(page.getByRole("button", { name: "day", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".gcal")).toHaveCSS("--row-h", zoom === "Compact" ? "36px" : "112px");
  });
}

test("calendar links override the saved view and month view survives refresh", async ({ page }) => {
  await seedCalendar(page);
  await page.getByRole("button", { name: "month", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "month", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/calendar?view=day&date=2026-10-26");
  await expect(page.getByRole("button", { name: "day", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Mon, Oct 26, 2026", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "day", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("invalid saved preferences fall back to a usable calendar", async ({ page }) => {
  await seedCalendar(page);
  for (const stored of ["{invalid", JSON.stringify({ view: "agenda", zoom: "huge" })]) {
    await page.evaluate((value) => localStorage.setItem("bit-focus-calendar-preferences", value), stored);
    await page.reload();
    await expect(page.getByRole("button", { name: "week", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".gcal")).toHaveCSS("--row-h", "64px");
  }
});
