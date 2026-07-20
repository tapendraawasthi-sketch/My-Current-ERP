import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT || "3000";
const HOST = process.env.E2E_HOST || "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;
const isCi = Boolean(process.env.CI);
/** Connected suite talks to live erp_bot — must not force builtin AI offline. */
const connected = process.env.ORBIX_E2E_CONNECTED === "true";
const botURL =
  process.env.ERP_BOT_BACKEND_URL ||
  process.env.VITE_ERP_BOT_URL ||
  "http://127.0.0.1:8765";
/** Browser must use same-origin /erp-bot when the bot is a remote URL (CORS). */
const viteBotURL =
  connected &&
  /^https?:\/\//i.test(botURL) &&
  !/localhost|127\.0\.0\.1|\[::1\]/i.test(botURL)
    ? "/erp-bot"
    : connected
      ? botURL
      : "";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: connected ? 180_000 : 90_000,
  expect: { timeout: connected ? 45_000 : 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 1 : 0,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
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
      // Offline UI QA defaults to builtin; connected Orbix needs live bot.
      VITE_SELF_CONTAINED_AI: connected ? "false" : "true",
      // Auth visual fixture — required for production preview builds of /e2e/ui-auth.html
      VITE_ALLOW_AUTH_FIXTURE: "true",
      VITE_ERP_BOT_URL: viteBotURL,
      ERP_BOT_BACKEND_URL: botURL,
      // Phase 5 sync E2E — point Vite at isolated sync backend (not production).
      VITE_ORBIX_SYNC_TEST_MODE:
        process.env.ORBIX_SYNC_E2E === "true" || process.env.VITE_ORBIX_SYNC_TEST_MODE === "true"
          ? "true"
          : process.env.VITE_ORBIX_SYNC_TEST_MODE || "",
      VITE_ORBIX_SYNC_E2E: process.env.ORBIX_SYNC_E2E === "true" ? "true" : "",
      VITE_API_URL:
        process.env.ORBIX_SYNC_BACKEND_URL ||
        process.env.VITE_API_URL ||
        (process.env.ORBIX_SYNC_E2E === "true" ? "http://127.0.0.1:3010" : ""),
      VITE_PUBLIC_API_URL:
        process.env.ORBIX_SYNC_BACKEND_URL ||
        process.env.VITE_PUBLIC_API_URL ||
        (process.env.ORBIX_SYNC_E2E === "true" ? "http://127.0.0.1:3010" : ""),
      // Phase 7 sales return / conflict gates (Node-side test.skip; pass through for harness)
      ORBIX_SALES_RETURN_E2E: process.env.ORBIX_SALES_RETURN_E2E || "",
      ORBIX_CREDIT_NOTE_E2E: process.env.ORBIX_CREDIT_NOTE_E2E || "",
      ORBIX_RETURN_CONFLICT_E2E: process.env.ORBIX_RETURN_CONFLICT_E2E || "",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
