import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT || "3000";
const HOST = process.env.E2E_HOST || "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --host ${HOST} --port ${PORT}`,
    url: `${baseURL}/e2e/ekhata.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_SELF_CONTAINED_AI: "true",
      VITE_ERP_BOT_URL: "",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
