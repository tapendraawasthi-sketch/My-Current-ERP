/**
 * Phase UI-0.8 / UI-0.9 — Authenticated visual baseline capture.
 * Uses isolated E2E UI QA harness (IndexedDB E2E company). Read-only screenshots;
 * does not post vouchers or mutate accounting beyond harness bootstrap seed.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-baseline/current");

type ManifestEntry = {
  route: string;
  screen: string;
  viewport: string;
  theme: "light" | "dark";
  company: string;
  data_state: string;
  captured_at: string;
  test_name: string;
  screenshot_path: string;
  known_issue: string | null;
  safe_environment_evidence: string;
  status: "captured" | "blocked" | "skipped";
  blocker?: string;
};

const manifest: ManifestEntry[] = [];

function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
}

async function openUiQa(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[data-component="app-shell"]')).toBeVisible();
}

async function setTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("orbix_theme_pref", t);
    localStorage.setItem("sutra_theme", t);
  }, theme);
}

async function gotoPage(page: import("@playwright/test").Page, pageId: string) {
  await page.evaluate((id) => {
    window.__uiQaGoto?.(id);
  }, pageId);
  await page.waitForTimeout(400);
}

async function shot(
  page: import("@playwright/test").Page,
  screen: string,
  viewport: string,
  theme: "light" | "dark",
  route: string,
  dataState: string,
  testName: string,
  knownIssue: string | null = null,
) {
  ensureOut();
  const file = `${screen}__${viewport}__${theme}.png`;
  const screenshotPath = path.join(OUT, file);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  manifest.push({
    route,
    screen,
    viewport,
    theme,
    company: "orbix-e2e-company",
    data_state: dataState,
    captured_at: new Date().toISOString(),
    test_name: testName,
    screenshot_path: `artifacts/ui-baseline/current/${file}`,
    known_issue: knownIssue,
    safe_environment_evidence:
      "UI QA harness + E2E company orbix-e2e-company; no production URL; IndexedDB-local seed",
    status: "captured",
  });
}

function recordBlocked(screen: string, blocker: string, testName: string) {
  manifest.push({
    route: `app://${screen}`,
    screen,
    viewport: "n/a",
    theme: "light",
    company: "n/a",
    data_state: "blocked",
    captured_at: new Date().toISOString(),
    test_name: testName,
    screenshot_path: "",
    known_issue: blocker,
    safe_environment_evidence: "Capture skipped to avoid unsafe or unavailable path",
    status: "blocked",
    blocker,
  });
}

test.describe.configure({ timeout: 300_000 });

test.describe("UI-0 authenticated visual baseline", () => {
  test.beforeEach(async ({ page }) => {
    ensureOut();
    await openUiQa(page);
  });

  test.afterAll(() => {
    ensureOut();
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ entries: manifest }, null, 2));
  });

  test("critical screens at 1440x900 light", async ({ page }) => {
    const testName = "critical-1440-light";
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, "light");

    const screens: Array<{ id: string; screen: string; data: string }> = [
      { id: "dashboard", screen: "dashboard", data: "seeded-e2e" },
      { id: "orbix", screen: "orbix", data: "empty-workspace" },
      { id: "billing", screen: "sales-invoice", data: "form-default" },
      { id: "purchase", screen: "purchase-invoice", data: "form-default" },
      { id: "receipt", screen: "receipt", data: "form-default" },
      { id: "payment", screen: "payment", data: "form-default" },
      { id: "journal", screen: "journal", data: "form-default" },
      { id: "accounts", screen: "chart-of-accounts", data: "seeded-e2e" },
      { id: "parties", screen: "party-list", data: "seeded-e2e" },
      { id: "items", screen: "item-list", data: "seeded-e2e" },
      { id: "day-book", screen: "day-book", data: "seeded-e2e" },
      { id: "ledger", screen: "general-ledger", data: "seeded-e2e" },
      { id: "trial-balance", screen: "trial-balance", data: "seeded-e2e" },
      { id: "profit-loss", screen: "profit-loss", data: "seeded-e2e" },
      { id: "balance-sheet", screen: "balance-sheet", data: "seeded-e2e" },
      { id: "bank-reconciliation", screen: "bank-reconciliation", data: "seeded-e2e" },
      { id: "bank-statement-import", screen: "bank-statement-import", data: "empty-or-seeded" },
      { id: "stock-summary", screen: "inventory-summary", data: "seeded-e2e" },
      { id: "audit-log", screen: "audit-log", data: "seeded-e2e" },
      { id: "users", screen: "users-and-roles", data: "seeded-e2e" },
      { id: "settings", screen: "company-settings", data: "seeded-e2e" },
      { id: "backup-restore", screen: "backup-restore", data: "default" },
    ];

    for (const s of screens) {
      try {
        await gotoPage(page, s.id);
        await page.waitForTimeout(250);
        await shot(page, s.screen, "1440x900", "light", `app://${s.id}`, s.data, testName);
      } catch (err) {
        recordBlocked(s.screen, err instanceof Error ? err.message : String(err), testName);
      }
    }

    // Auth screens are outside harness — document honestly
    recordBlocked(
      "login",
      "Login UI is outside /e2e/ui-qa.html harness (harness auto-authenticates). Capture requires main app auth stage without mutating production; deferred to dedicated auth fixture.",
      testName,
    );
    recordBlocked(
      "company-selector",
      "Company selector/gateway is pre-auth; harness skips gateway. Safe capture requires isolated auth flow without production credentials.",
      testName,
    );
  });

  test("responsive + dark matrix for key surfaces", async ({ page }) => {
    const testName = "responsive-dark-matrix";
    const viewports = [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "1600x900", width: 1600, height: 900 },
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1366x768", width: 1366, height: 768 },
      { name: "1280x720", width: 1280, height: 720 },
      { name: "1024x768", width: 1024, height: 768 },
      { name: "768x1024", width: 768, height: 1024 },
      { name: "430x932", width: 430, height: 932 },
      { name: "390x844", width: 390, height: 844 },
      { name: "360x800", width: 360, height: 800 },
    ];

    const surfaces = [
      { id: "dashboard", screen: "dashboard" },
      { id: "orbix", screen: "orbix" },
      { id: "billing", screen: "sales-invoice" },
      { id: "parties", screen: "party-list" },
      { id: "balance-sheet", screen: "balance-sheet" },
      { id: "bank-reconciliation", screen: "bank-reconciliation" },
    ];

    const findings: Array<{
      screen: string;
      viewport: string;
      theme: string;
      overflowX: boolean;
      classification: string[];
    }> = [];

    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        for (const s of surfaces) {
          await gotoPage(page, s.id);
          const overflow = await page.evaluate(() => {
            const doc = document.documentElement;
            return {
              overflowX: doc.scrollWidth > doc.clientWidth + 2,
              scrollWidth: doc.scrollWidth,
              clientWidth: doc.clientWidth,
            };
          });
          const classification: string[] = [];
          if (overflow.overflowX) classification.push("horizontal overflow");
          if (vp.width < 768) classification.push("expected desktop-only limitation candidate");
          findings.push({
            screen: s.screen,
            viewport: vp.name,
            theme,
            overflowX: overflow.overflowX,
            classification,
          });
          // Capture subset to keep artifact size manageable: light+dark at 1440, 1024, 390
          if (["1440x900", "1024x768", "390x844"].includes(vp.name)) {
            await shot(
              page,
              s.screen,
              vp.name,
              theme,
              `app://${s.id}`,
              "seeded-e2e",
              testName,
              classification.length ? classification.join("; ") : null,
            );
          }
        }
      }
    }

    fs.writeFileSync(path.join(OUT, "responsive-findings.json"), JSON.stringify(findings, null, 2));
  });
});
