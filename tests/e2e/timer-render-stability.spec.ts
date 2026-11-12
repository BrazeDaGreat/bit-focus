import { test, expect, type Page } from "@playwright/test";

async function seedCalendar(page: Page, mode: "standard" | "pomodoro") {
  await page.goto("/calendar");
  await expect(page.getByRole("button", { name: "Begin setup", exact: true })).toBeVisible();
  await page.evaluate(async (timerMode) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const tx = db.transaction(["configuration", "timeblocks", "focus"], "readwrite");
    tx.objectStore("configuration").put({ name: "Render tester", dob: null, webhook: "", currency: "USD" });
    tx.objectStore("timeblocks").put({ uid: "render-block", title: "Stable event labels", tag: "Study",
      startTime: start, endTime: new Date(+start + 90 * 60_000) });
    const sessionStart = new Date(start);
    sessionStart.setHours(15);
    tx.objectStore("focus").put({ uid: "render-session", tag: "Study",
      startTime: sessionStart, endTime: new Date(+sessionStart + 60 * 60_000) });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem("timerMode", timerMode);
    localStorage.setItem("pomoTime", "120");
    localStorage.setItem("pomoRunning", "0");
    localStorage.setItem("bit-focus-calendar-display", JSON.stringify({ sessions: "full", blocks: "solid" }));
  }, mode);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start timer", exact: true })).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(mode === "standard" ? "02:00" : "23:00");
  // Wait for the event's ResizeObserver to reveal the measured labels.
  await expect(page.locator(".calendar-block-solid .rbc-event-content")).toContainText("12:00");
  await expect(page.locator(".calendar-session-full .rbc-event-content")).toContainText("3:00");
}

for (const mode of ["standard", "pomodoro"] as const) {
  test(`${mode}: Calendar labels retain DOM identity across timer ticks, plan refreshes and menu changes`, async ({ page }) => {
    await seedCalendar(page, mode);
    await page.clock.install();
    await page.getByRole("button", { name: "Start timer", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause timer", exact: true })).toBeVisible();

    // Track removals, not just final text: a remount followed by a measurement
    // can restore identical text while still visibly blinking every second.
    await page.evaluate(() => {
      const calendar = document.querySelector('main[aria-label="Calendar"]')!;
      const labels = [...calendar.querySelectorAll(".rbc-event-content p, .rbc-header span")];
      const removed: Node[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) removed.push(...record.removedNodes);
      });
      observer.observe(calendar, { childList: true, subtree: true });
      Object.assign(window, { calendarProbe: { labels, removed, observer } });
    });

    await page.clock.runFor(3_100);
    await expect.poll(() => page.evaluate(() => Number(localStorage.getItem("pomoTime")))).toBeGreaterThan(122);
    // The plan also refreshes every 30 seconds, independently of the timer.
    await page.clock.runFor(30_000);
    await page.getByRole("button", { name: "View options", exact: true }).click();
    await page.keyboard.press("Escape");

    const probe = await page.evaluate(() => {
      const probe = (window as typeof window & { calendarProbe: {
        labels: Element[]; removed: Node[]; observer: MutationObserver;
      } }).calendarProbe;
      probe.observer.disconnect();
      return { count: probe.labels.length, retained: probe.labels.every((label) => label.isConnected),
        removed: probe.removed.length };
    });
    expect(probe.count).toBeGreaterThan(0);
    expect(probe).toMatchObject({ retained: true, removed: 0 });

    await page.getByRole("button", { name: "Pause timer", exact: true }).click();
    const elapsed = await page.evaluate(() => Number(localStorage.getItem("pomoTime")));
    await page.clock.runFor(2_000);
    expect(await page.evaluate(() => Number(localStorage.getItem("pomoTime")))).toBe(elapsed);
    await page.getByRole("button", { name: "Start timer", exact: true }).click();
    await page.clock.runFor(2_100);
    await expect.poll(() => page.evaluate(() => Number(localStorage.getItem("pomoTime")))).toBeGreaterThan(elapsed);

    // A running clock must still allow client navigation and status controls.
    await page.clock.resume();
    await page.getByTitle("Profile and settings", { exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Pause timer", exact: true })).toBeVisible();
  });
}
