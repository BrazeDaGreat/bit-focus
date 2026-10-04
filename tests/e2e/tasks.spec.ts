import { test, expect, type Page } from "@playwright/test";

async function seedWorkspace(page: Page) {
  await page.goto("/projects");
  await page.waitForFunction(async () =>
    (await indexedDB.databases()).some(
      (db) => db.name === "BitFocusDB" && (db.version || 0) >= 130,
    ),
  );
  await expect(
    page.getByRole("button", { name: "Begin setup", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    localStorage.setItem(
      "tag-storage",
      JSON.stringify({
        state: {
          tag: "Work",
          savedTags: [
            { t: "Work", c: "#4684e8" },
            { t: "Personal", c: "#bc63cf" },
          ],
        },
        version: 0,
      }),
    );
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("BitFocusDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date();
    const due = new Date(now);
    due.setHours(0, 0, 0, 0);
    const stores = [
      "configuration",
      "projects",
      "milestones",
      "issues",
      "task_items",
      "focus",
      "timeblocks",
    ];
    const tx = db.transaction(stores, "readwrite");
    tx.objectStore("configuration").put({
      name: "Task tester",
      uid: "test-profile",
      dob: null,
      webhook: "",
      currency: "USD",
      sendWebhookUpdates: false,
    });
    tx.objectStore("projects").put({
      id: 1,
      uid: "test-project",
      title: "Website",
      status: "Active",
      notes: "A focused project",
      version: "1.0",
      quickLinks: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore("milestones").put({
      id: 1,
      uid: "test-milestone",
      projectId: 1,
      title: "Launch",
      status: "Paid",
      budget: 250,
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore("issues").put({
      id: 1,
      uid: "test-issue",
      milestoneId: 1,
      title: "Existing issue",
      label: "Feature",
      description: "Preserve these notes",
      status: "Open",
      dueDate: due,
      createdAt: now,
      updatedAt: now,
    });
    const day = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    tx.objectStore("task_items").put({
      id: 5,
      uid: "test-task",
      projectId: 1,
      title: "Review copy",
      tags: ["Work"],
      primaryTag: "Work",
      description: "",
      estimateMinutes: 45,
      priority: 2,
      order: 5,
      dueDate: due,
      dueDay: day,
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore("focus").put({
      id: 1,
      uid: "test-session",
      taskUid: "test-task",
      projectUid: "test-project",
      tag: "Work",
      startTime: new Date(now.getTime() - 30 * 60000),
      endTime: now,
    });
    tx.objectStore("timeblocks").put({
      id: 1,
      uid: "test-block",
      taskUid: "test-task",
      projectUid: "test-project",
      tag: "Work",
      title: "Review copy",
      startTime: new Date(now.getTime() + 60000),
      endTime: new Date(now.getTime() + 31 * 60000),
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Review copy", { exact: true }).first(),
  ).toBeVisible();
}

test("desktop task flow, migration, focus, calendar, and weekly review", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedWorkspace(page);
  await expect(page.getByText("Existing issue", { exact: true })).toBeVisible();
  await page.getByLabel("New task title").fill("Ship new task flow");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("New task title")).toHaveValue("");
  await page
    .getByRole("button", { name: "Open Ship new task flow", exact: true })
    .click();
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
    "Ship new task flow",
  );
  await page.getByLabel("Task project", { exact: true }).click();
  await page.screenshot({
    path: "test-results/tasks-project-picker.png",
    animations: "disabled",
  });
  await page.getByRole("menuitemradio", { name: "Website" }).click();
  await expect(page.getByLabel("Task project", { exact: true })).toHaveText(
    "Website",
  );
  await page.getByLabel("Task deadline", { exact: true }).click();
  await page.screenshot({
    path: "test-results/tasks-deadline-picker.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: /^Today \(/ }).click();
  await expect(page.getByLabel("Task deadline", { exact: true })).toHaveText(
    "Today",
  );
  await page.getByRole("button", { name: "1h", exact: true }).click();
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "High", exact: true }).click();
  await detail.getByRole("button", { name: "Work", exact: true }).click();
  await detail.getByRole("button", { name: "Personal", exact: true }).click();
  await page.getByLabel("Notes", { exact: true }).fill("Keep important notes");
  await page.screenshot({
    path: "test-results/tasks-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close task details" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /^Website/ }).click();
  await expect(page.getByRole("heading", { name: "Website" })).toBeVisible();
  await expect(
    page.getByText("Ship new task flow", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start focus on Ship new task flow" })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }).last(),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Website" })).toBeVisible();
  await expect(
    page.getByText("Ship new task flow", { exact: true }).first(),
  ).toBeVisible();
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("BitFocusDB");
      r.onsuccess = () => resolve(r.result);
    });
    const rows = await new Promise<
      Array<{
        title: string;
        tags: string[];
        estimateMinutes: number;
        priority: number;
        description: string;
      }>
    >((resolve) => {
      const r = db.transaction("task_items").objectStore("task_items").getAll();
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return rows.find((t) => t.title === "Ship new task flow");
  });
  expect(saved?.estimateMinutes).toBe(60);
  expect(saved?.priority).toBe(3);
  expect(saved?.tags).toEqual(["Work", "Personal"]);
  expect(saved?.description).toBe("Keep important notes");
  await page
    .getByRole("button", { name: "Complete Ship new task flow" })
    .click();
  await page.getByRole("button", { name: /^Completed/ }).click();
  await page
    .getByRole("button", { name: "Open Ship new task flow", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await page.getByRole("button", { name: /^Trash/ }).click();
  await page
    .getByRole("button", { name: "Open Ship new task flow", exact: true })
    .click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByRole("button", { name: "Close task details" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Project options" }).click();
  await page.getByRole("menuitem", { name: "Archive project" }).click();
  await expect(page.getByText("Review copy", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Archived" }).click();
  await page.getByRole("menuitem", { name: "Website" }).click();
  await page.getByRole("button", { name: "Project options" }).click();
  await page.getByRole("menuitem", { name: "Restore project" }).click();
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Garden");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Garden" })).toBeVisible();
  await page.getByLabel("New task title").fill("Plant tomatoes");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Plant tomatoes", { exact: true })).toBeVisible();
  await page.goto("/calendar");
  await expect(
    page.getByText("Due · Review copy", { exact: true }).first(),
  ).toBeVisible();
  await page.getByText("Due · Review copy", { exact: true }).first().click();
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
    "Review copy",
  );
  await page.goto("/");
  await expect(
    page.getByText("Tasks this week", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Task focus time", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile task list and detail sheet fit without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedWorkspace(page);
  await page.getByLabel("New task title").fill("Mobile task");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Mobile task", exact: true })
    .click();
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
    "Mobile task",
  );
  await page.getByLabel("Estimated minutes").fill("25");
  await page.getByLabel("Estimated minutes").blur();
  await expect(page.getByText("0m / 25m", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/tasks-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close task details" }).click();
  await expect(page.getByText("Mobile task", { exact: true })).toBeVisible();
});

test("timer saves multiple stretches against the task and its chosen primary tag", async ({
  page,
}) => {
  await seedWorkspace(page);
  await page
    .getByRole("button", { name: "Start focus on Review copy" })
    .click();
  await page.getByRole("button", { name: "Pause", exact: true }).last().click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("pomoRunning")))
    .toBe("0");
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem("pomoTime", "240");
    localStorage.setItem(
      "pomoSegments",
      JSON.stringify([
        { start: now - 10 * 60000, end: now - 8 * 60000 },
        { start: now - 2 * 60000, end: now },
      ]),
    );
    localStorage.removeItem("pomoSegmentStart");
    const tags = JSON.parse(localStorage.getItem("tag-storage")!);
    tags.state.tag = "Personal";
    localStorage.setItem("tag-storage", JSON.stringify(tags));
  });
  await page.goto("/focus");
  await page.reload();
  await expect(page.getByText("Current task", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Reset the timer", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open("BitFocusDB");
          r.onsuccess = () => resolve(r.result);
        });
        const sessions = await new Promise<
          Array<{ taskUid?: string; projectUid?: string; tag: string }>
        >((resolve) => {
          const r = db.transaction("focus").objectStore("focus").getAll();
          r.onsuccess = () => resolve(r.result);
        });
        db.close();
        return sessions
          .filter((s) => s.taskUid === "test-task")
          .map((s) => ({ tag: s.tag, projectUid: s.projectUid }));
      }),
    )
    .toEqual([
      { tag: "Work", projectUid: "test-project" },
      { tag: "Work", projectUid: "test-project" },
      { tag: "Work", projectUid: "test-project" },
    ]);
  await expect(page.getByText("Current task", { exact: true })).toHaveCount(0);
});

test("calendar creates another block linked to the same task", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await seedWorkspace(page);
  await page.goto("/calendar");
  await expect(
    page.getByText("Due · Review copy", { exact: true }),
  ).toBeVisible();
  const dayIndex = await page.evaluate(() => (new Date().getDay() + 6) % 7);
  const slot = page
    .locator(".rbc-day-slot")
    .nth(dayIndex)
    .locator(".rbc-time-slot")
    .nth(40);
  await slot.scrollIntoViewIfNeeded();
  const box = (await slot.boundingBox())!;
  // Calendar's selection layer covers its visual time slots.
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height * 2.5, { steps: 12 });
  await page.mouse.up();
  await page.getByLabel("Task for calendar block").selectOption("test-task");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.screenshot({
    path: "test-results/tasks-calendar.png",
    fullPage: true,
    animations: "disabled",
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open("BitFocusDB");
          r.onsuccess = () => resolve(r.result);
        });
        const blocks = await new Promise<Array<{ taskUid?: string }>>(
          (resolve) => {
            const r = db
              .transaction("timeblocks")
              .objectStore("timeblocks")
              .getAll();
            r.onsuccess = () => resolve(r.result);
          },
        );
        db.close();
        return blocks.filter((b) => b.taskUid === "test-task").length;
      }),
    )
    .toBe(2);
  await page.getByText("Due · Review copy", { exact: true }).click();
  await expect(
    page.getByText("Calendar blocks · 2", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
