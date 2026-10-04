import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    viewport: { width: 1600, height: 1000 },
    reducedMotion: "reduce",
  },
  reporter: "list",
});
