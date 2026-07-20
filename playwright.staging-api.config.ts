/**
 * Staging API-only Playwright config — no local Vite webServer.
 * Use for TICKET-PR-B1-002 launch-slice against Render.
 */
import { defineConfig } from "@playwright/test";

const staging =
  process.env.STAGING_BASE_URL || "https://my-current-erp.onrender.com";
const botURL = (
  process.env.ERP_BOT_BACKEND_URL ||
  process.env.VITE_ERP_BOT_URL ||
  `${staging}/erp-bot`
).replace(/\/$/, "");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "orbix-next12-launch-slice.spec.ts",
  timeout: 180_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "artifacts/prod-ready-pr-b1/connected/playwright-staging-next12.json" }]],
  use: {
    baseURL: staging,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  // No webServer — hits live staging bot via ERP_BOT_BACKEND_URL.
  metadata: { botURL, staging },
});
