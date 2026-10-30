import { test, expect, type Page } from "@playwright/test";

async function seedPausedTimer(page: Page) {
  await page.goto("/focus");
  await expect(page.getByRole("button", { name: "Begin setup", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("configuration", "readwrite");
    tx.objectStore("configuration").put({ name: "Timer tester", dob: null, webhook: "", currency: "USD" });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
    const now = Date.now();
    localStorage.setItem("timerMode", "standard");
    localStorage.setItem("pomoTime", "120");
    localStorage.setItem("pomoRunning", "0");
    localStorage.setItem("pomoSegments", JSON.stringify([{ start: now - 120000, end: now }]));
    localStorage.setItem("rewardPoints", "40");
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Reset the timer", exact: true })).toBeVisible();
}

async function savedFocus(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const rows = await new Promise<{ startTime: Date; endTime: Date }[]>((resolve, reject) => {
        const request = db.transaction("focus").objectStore("focus").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return { count: rows.length, seconds: rows.reduce((sum, row) => sum + (row.endTime.getTime() - row.startTime.getTime()) / 1000, 0),
        points: localStorage.getItem("rewardPoints"), journal: localStorage.getItem("pomoPendingCompletions") };
    } finally { db.close(); }
  });
}

test("switching a paused timer mode saves existing focus once and preserves the points balance", async ({ page }) => {
  await seedPausedTimer(page);
  await page.getByRole("button", { name: "Pomodoro", exact: true }).click();
  await expect.poll(() => savedFocus(page)).toEqual({ count: 1, seconds: 120, points: "42", journal: null });
  expect(await page.evaluate(() => ({ mode: localStorage.getItem("timerMode"), time: localStorage.getItem("pomoTime"),
    running: localStorage.getItem("pomoRunning") }))).toEqual({ mode: "pomodoro", time: "0", running: "0" });
  await page.reload();
  await expect(page.getByRole("timer", { name: "Focus timer", exact: true })).toBeVisible();
  expect(await savedFocus(page)).toEqual({ count: 1, seconds: 120, points: "42", journal: null });
});

test("failed focus saves survive reload and retry without duplicate sessions or rewards", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { failFocusWrites: boolean };
    state.failFocusWrites = true;
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value, key) {
      if (this.name === "focus" && state.failFocusWrites) throw new DOMException("Injected focus failure", "QuotaExceededError");
      return key === undefined ? add.call(this, value) : add.call(this, value, key);
    };
  });
  await seedPausedTimer(page);
  await page.getByRole("button", { name: "Reset the timer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect.poll(async () => {
    const saved = await savedFocus(page);
    return { count: saved.count, points: saved.points, pending: JSON.parse(saved.journal ?? "[]").length };
  }).toEqual({ count: 0, points: "40", pending: 1 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await page.evaluate(() => { (window as typeof window & { failFocusWrites: boolean }).failFocusWrites = false; });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => savedFocus(page)).toEqual({ count: 1, seconds: 120, points: "42", journal: null });
  expect(await page.evaluate(() => localStorage.getItem("pomoTime"))).toBe("0");
  await page.reload();
  await expect(page.getByRole("timer", { name: "Focus timer", exact: true })).toBeVisible();
  expect(await savedFocus(page)).toEqual({ count: 1, seconds: 120, points: "42", journal: null });
});
