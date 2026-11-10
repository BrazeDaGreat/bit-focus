import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.route("**/api/models", (route) => route.fulfill({ json: { models: [{ id: "test-model", name: "Test model" }] } }));
  await page.goto("/ai");
  await expect(page.getByRole("button", { name: "Begin setup", exact: true })).toBeVisible({ timeout: 60000 });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("BitFocusDB"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(["configuration", "ai_chats", "ai_config", "notes", "task_items", "projects"], "readwrite");
    tx.objectStore("configuration").put({ name: "Chat tester", uid: "profile", dob: null, webhook: "", currency: "USD" });
    tx.objectStore("ai_config").put({ key: "default", baseUrl: "https://example.com/v1", apiKey: "test", customContextEnabled: false, customPrompt: "", defaultModelId: "test-model" });
    tx.objectStore("notes").put({ id: 1, uid: "chat-note", title: "Research", type: "document", content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Keep this original paragraph" }] }] }), createdAt: new Date(), updatedAt: new Date() });
    tx.objectStore("projects").put({ id: 1, uid: "chat-project", title: "Launch", status: "Active", version: "", notes: "Launch preparation", createdAt: new Date(), updatedAt: new Date() });
    tx.objectStore("task_items").put({ id: 1, uid: "chat-task", title: "Prepare release", projectId: 1, description: "Check release notes", tags: [], estimateMinutes: 30, priority: 1, order: 0, createdAt: new Date(), updatedAt: new Date() });
    tx.objectStore("ai_chats").put({ id: "chat-one", title: "Launch review", modelId: "test-model", provider: "openai-compatible", messages: JSON.stringify([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Review launch" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "The November milestone is ready. **Ship carefully.**\n\n| Task | Status |\n| --- | --- |\n| Release | Ready |" }, { type: "tool-getProjectsOverview", toolCallId: "read-1", state: "output-available", input: {}, output: { sources: [{ label: "Launch", href: "/projects?project=1" }] } }] },
    ]), createdAt: new Date(), updatedAt: new Date() });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Launch review", exact: true }).click();
  await expect(page.getByText("The November milestone is ready.", { exact: false }).first()).toBeVisible();
}

test("searches messages, follows sources, branches and exports conversation", async ({ page }) => {
  await seed(page);
  await page.getByPlaceholder("Search chats").fill("November");
  await expect(page.getByRole("button", { name: /Launch review.*November/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Launch", exact: true })).toHaveAttribute("href", "/projects?project=1");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export chat", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Launch_review.md");
  await page.getByPlaceholder("Search chats").clear();
  await page.getByRole("button", { name: "Branch from here" }).click();
  await expect(page.getByRole("button", { name: "Launch review (branch)", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Launch review (branch)", exact: true }).click();
  await expect(page.getByText("The November milestone is ready.", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Launch review", exact: true })).toBeVisible();
});

test("saves new Notes pages and appends answers while preserving existing content", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Save answer to Notes" }).click();
  await page.getByRole("textbox", { name: "Page title", exact: true }).fill("Saved launch answer");
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Save answer to Notes" }).click();
  await page.getByRole("combobox", { name: "Destination" }).selectOption("chat-note");
  await page.getByRole("button", { name: "Append answer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/notes?page=chat-note");
  const editor = page.getByRole("textbox", { name: "Page content", exact: true });
  await expect(editor).toContainText("Keep this original paragraph");
  await expect(editor).toContainText("The November milestone is ready.");
  await expect(editor.locator("strong")).toHaveText("Ship carefully.");
  await expect(editor.locator("table")).toHaveCount(1);
  await expect(editor.locator("table")).toContainText("Ready");
});

test("attaches projects, tasks and Notes and persists selected source snapshots", async ({ page }) => {
  await seed(page);
  let sent: { messages: { parts: { type: string; data?: { label: string } }[] }[] } | undefined;
  await page.route("**/api/chat", async (route) => {
    sent = route.request().postDataJSON();
    const chunks = [
      { type: "start", messageId: "a2" }, { type: "start-step" }, { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "I have the attached sources." }, { type: "text-end", id: "text-1" }, { type: "finish-step" }, { type: "finish" },
    ];
    await route.fulfill({ headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n" });
  });
  const composer = page.getByPlaceholder("Ask about your focus", { exact: false });
  await composer.fill("Discuss @Res");
  await expect(page.getByRole("button", { name: "Note: Research", exact: true })).toBeVisible();
  await composer.press("Enter");
  await expect(page.getByRole("button", { name: "Remove Note: Research" })).toBeVisible();
  await page.getByRole("button", { name: "@ Attach", exact: true }).click();
  await page.getByRole("textbox", { name: "Find a source" }).fill("Launch");
  await page.getByRole("button", { name: "Project: Launch", exact: true }).click();
  await page.getByRole("button", { name: "@ Attach", exact: true }).click();
  await page.getByRole("textbox", { name: "Find a source" }).fill("Prepare release");
  await page.getByRole("button", { name: "Task: Prepare release", exact: true }).click();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("I have the attached sources.", { exact: true })).toBeVisible();
  const attached = sent!.messages.at(-1)!.parts.filter((part) => part.type === "data-attachment");
  expect(attached.map((part) => part.data?.label)).toEqual(["Note: Research", "Project: Launch", "Task: Prepare release"]);
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open("BitFocusDB"); request.onsuccess = () => resolve(request.result); });
    const record = await new Promise<{ messages: string }>((resolve) => { const request = db.transaction("ai_chats").objectStore("ai_chats").get("chat-one"); request.onsuccess = () => resolve(request.result); });
    db.close(); return record.messages.includes("data-attachment");
  })).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Launch review", exact: true }).click();
  await expect(page.getByRole("link", { name: "Note: Research", exact: true })).toBeVisible();
});

test("focus tool sources open the exact sessions used for its reported totals", async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open("BitFocusDB"); request.onsuccess = () => resolve(request.result); });
    const tx = db.transaction("focus", "readwrite");
    const now = Date.now();
    for (const [id, offset, minutes] of [[1, -3600000, 30], [2, -10 * 86400000, 60], [3, 86400000, 60]]) {
      tx.objectStore("focus").put({ id, uid: `source-session-${id}`, tag: "Review", startTime: new Date(now + offset), endTime: new Date(now + offset + minutes * 60000) });
    }
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); }); db.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Launch review", exact: true }).click();
  let output: { totalMinutes: number; sources: { href: string }[] } | undefined;
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    const part = body.messages.flatMap((message: { parts: { type: string; output?: unknown }[] }) => message.parts).find((part: { type: string }) => part.type === "tool-getFocusSummary");
    let chunks;
    if (part) {
      output = part.output;
      chunks = [{ type: "start", messageId: "a3" }, { type: "start-step" }, { type: "text-start", id: "answer" }, { type: "text-delta", id: "answer", delta: "You recorded 30 minutes in this range." }, { type: "text-end", id: "answer" }, { type: "finish-step" }, { type: "finish" }];
    } else {
      chunks = [{ type: "start", messageId: "a2" }, { type: "start-step" }, { type: "tool-input-available", toolCallId: "summary-1", toolName: "getFocusSummary", input: { days: 7 } }, { type: "finish-step" }, { type: "finish" }];
    }
    await route.fulfill({ headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n" });
  });
  await page.getByPlaceholder("Ask about your focus", { exact: false }).fill("How much focus did I record this week?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("You recorded 30 minutes in this range.", { exact: true })).toBeVisible();
  expect(output?.totalMinutes).toBe(30);
  const source = page.getByRole("link", { name: /^Focus sessions/ }).first();
  await expect(source).toHaveAttribute("href", output!.sources[0].href);
  await source.click();
  await expect(page.getByRole("status").filter({ hasText: "AI Chat sources" })).toBeVisible({ timeout: 20000 });
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "Show all sessions", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
});
