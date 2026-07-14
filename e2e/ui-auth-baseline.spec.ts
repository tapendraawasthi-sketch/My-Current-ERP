/**
 * Phase UI-1 — Auth visual fixture + Login/Company-selector baseline completion.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT = path.resolve("artifacts/ui-baseline/current");
const MANIFEST = path.join(OUT, "manifest.json");

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

function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
}

function loadManifest(): ManifestEntry[] {
  if (!fs.existsSync(MANIFEST)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

function saveManifest(entries: ManifestEntry[]) {
  ensureOut();
  // Replace prior login/company-selector entries
  const filtered = entries.filter(
    (e) => e.screen !== "login" && e.screen !== "company-selector",
  );
  fs.writeFileSync(MANIFEST, JSON.stringify({ entries: filtered }, null, 2));
  return filtered;
}

async function openAuthFixture(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-auth.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-auth-fixture-ready")).toBeVisible({ timeout: 60_000 });
}

async function shot(
  page: import("@playwright/test").Page,
  screen: string,
  viewport: string,
  theme: "light" | "dark",
  dataState: string,
  testName: string,
  knownIssue: string | null = null,
): Promise<ManifestEntry> {
  ensureOut();
  const file = `${screen}__${viewport}__${theme}__${dataState}.png`;
  const screenshotPath = path.join(OUT, file);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return {
    route: screen === "login" ? "app://auth/company-login" : "app://auth/gateway",
    screen,
    viewport,
    theme,
    company: "orbix-e2e-auth-fixture-company",
    data_state: dataState,
    captured_at: new Date().toISOString(),
    test_name: testName,
    screenshot_path: `artifacts/ui-baseline/current/${file}`,
    known_issue: knownIssue,
    safe_environment_evidence:
      "E2E auth fixture /e2e/ui-auth.html; no login() success; isolated fixture company metadata; VITE_ALLOW_AUTH_FIXTURE or DEV",
    status: "captured",
  };
}

test.describe.configure({ timeout: 180_000 });

test.describe("UI-1 auth visual fixture", () => {
  const newEntries: ManifestEntry[] = [];

  test.afterAll(() => {
    const existing = loadManifest().filter(
      (e) => e.screen !== "login" && e.screen !== "company-selector",
    );
    // Drop prior blocked login/company-selector markers
    const merged = [...existing, ...newEntries];
    fs.writeFileSync(MANIFEST, JSON.stringify({ entries: merged }, null, 2));
  });

  test("production isolation: fixture is under /e2e and does not auto-auth", async ({ page }) => {
    await openAuthFixture(page);
    const state = await page.evaluate(() => window.__authFixture?.getState());
    expect(state?.isAuthenticated).toBe(false);
    expect(state?.authStage).toBe("gateway");
    expect(state?.companyId).toContain("e2e");
    // Main app route is separate
    await page.goto("/");
    await expect(page.getByTestId("ui-auth-fixture-ready")).toHaveCount(0);
  });

  test("renders real GatewayScreen (company selector)", async ({ page }) => {
    await openAuthFixture(page);
    await page.evaluate(() => window.__authFixture?.setScreen("gateway"));
    await expect(page.getByTestId("gateway-screen")).toBeVisible();
    await expect(page.getByTestId("gateway-screen").getByRole("heading", { name: "Choose a company" })).toBeVisible();
    await expect(page.getByTestId("pre-workspace-shell").getByText("Orbix ERP").first()).toBeVisible();
  });

  test("renders real CompanyLoginScreen", async ({ page }) => {
    await openAuthFixture(page);
    await page.evaluate(() => window.__authFixture?.setScreen("login"));
    await expect(page.getByTestId("company-login-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("company-login-screen").getByRole("heading", { name: /Sign in/i })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
  });

  test("no session created unless login succeeds", async ({ page }) => {
    await openAuthFixture(page);
    await page.evaluate(() => window.__authFixture?.setScreen("login"));
    await page.getByLabel("Username").fill("not-a-real-user");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByTestId("login-submit").click();
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => window.__authFixture?.getState());
    expect(state?.isAuthenticated).toBe(false);
  });

  test("capture login + company selector baselines", async ({ page }) => {
    const testName = "ui1-auth-baseline";
    await openAuthFixture(page);

    const viewports = [
      { name: "1440x900", width: 1440, height: 900 },
      { name: "390x844", width: 390, height: 844 },
    ];

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((t) => window.__authFixture?.setTheme(t), theme);

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Company selector — one company
        await page.evaluate(() => {
          window.__authFixture?.setCompanyMode("one");
          window.__authFixture?.setScreen("gateway");
        });
        await page.waitForTimeout(200);
        newEntries.push(
          await shot(page, "company-selector", vp.name, theme, "one-company", testName),
        );

        // Company selector — empty
        await page.evaluate(() => window.__authFixture?.setCompanyMode("empty"));
        await page.waitForTimeout(200);
        newEntries.push(
          await shot(
            page,
            "company-selector",
            vp.name,
            theme,
            "empty",
            testName,
            "Gateway shows loading/empty when companySettings null",
          ),
        );

        // Restore one company for login
        await page.evaluate(() => {
          window.__authFixture?.setCompanyMode("one");
          window.__authFixture?.setScreen("login");
        });
        await expect(page.getByTestId("company-login-screen").getByRole("heading", { name: /Sign in/i })).toBeVisible();
        newEntries.push(await shot(page, "login", vp.name, theme, "default", testName));

        // Validation error
        await page.getByTestId("login-submit").click();
        await page.waitForTimeout(200);
        newEntries.push(await shot(page, "login", vp.name, theme, "validation-error", testName));

        // Password visible
        await page.getByLabel("Username").fill("admin");
        await page.getByLabel("Password", { exact: true }).fill("secret");
        const toggle = page.getByRole("button", { name: /Show password|Hide password/i });
        if (await toggle.count()) {
          await toggle.click();
        } else {
          // Fall back: buttons inside form
          const formButtons = page.locator("form button[type='button']");
          if (await formButtons.count()) await formButtons.first().click();
        }
        await page.waitForTimeout(150);
        newEntries.push(await shot(page, "login", vp.name, theme, "password-visible", testName));
      }
    }

    // Document multi-company: production GatewayScreen supports single companySettings only
    newEntries.push({
      route: "app://auth/gateway",
      screen: "company-selector",
      viewport: "n/a",
      theme: "light",
      company: "n/a",
      data_state: "multiple-company",
      captured_at: new Date().toISOString(),
      test_name: testName,
      screenshot_path: "",
      known_issue:
        "Production GatewayScreen renders a single companySettings card; multi-company UI not present in component — not applicable",
      safe_environment_evidence: "N/A — component capability",
      status: "skipped",
    });
  });
});
