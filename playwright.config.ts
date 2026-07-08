import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT || "3000";
const HOST = process.env.E2E_HOST || "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 1 : 0,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: isCi
      ? `npm run build && npm run preview -- --host ${HOST} --port ${PORT}`
      : `npm run dev -- --host ${HOST} --port ${PORT}`,
    url: `${baseURL}/e2e/ekhata.html`,
    reuseExistingServer: !isCi,
    timeout: isCi ? 300_000 : 120_000,
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
