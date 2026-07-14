/**
 * Phase UI-0.10 — Accessibility baseline (Playwright + axe-core).
 * Records findings; does not fix the backlog.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const OUT_JSON = path.resolve("docs/ui-audit/UI_ACCESSIBILITY_BASELINE.json");
const OUT_MD = path.resolve("docs/ui-audit/UI_ACCESSIBILITY_BASELINE.md");

type Finding = {
  screen: string;
  route: string;
  violation_id: string;
  impact: string | undefined;
  description: string;
  help: string;
  nodes: number;
};

const findings: Finding[] = [];
const keyboardNotes: Array<{ screen: string; result: string; notes: string }> = [];

async function openUiQa(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ui-qa.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-qa-harness-ready")).toBeVisible({ timeout: 90_000 });
}

async function gotoPage(page: import("@playwright/test").Page, pageId: string) {
  await page.evaluate((id) => window.__uiQaGoto?.(id), pageId);
  await page.waitForTimeout(400);
}

test.describe.configure({ timeout: 240_000 });

test.describe("UI-0 accessibility baseline", () => {
  test("axe scans on critical screens", async ({ page }) => {
    await openUiQa(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    const screens = [
      { id: "dashboard", screen: "dashboard" },
      { id: "orbix", screen: "orbix" },
      { id: "billing", screen: "sales-invoice" },
      { id: "journal", screen: "journal" },
      { id: "parties", screen: "parties" },
      { id: "balance-sheet", screen: "balance-sheet" },
      { id: "bank-reconciliation", screen: "bank-reconciliation" },
    ];

    for (const s of screens) {
      await gotoPage(page, s.id);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      for (const v of results.violations) {
        findings.push({
          screen: s.screen,
          route: `app://${s.id}`,
          violation_id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          nodes: v.nodes.length,
        });
      }
    }

    // Keyboard smoke
    await gotoPage(page, "dashboard");
    await page.keyboard.press("Tab");
    const focus1 = await page.evaluate(() => document.activeElement?.tagName || "none");
    keyboardNotes.push({
      screen: "navigation",
      result: focus1 !== "none" && focus1 !== "BODY" ? "pass-partial" : "fail-or-weak",
      notes: `After Tab from dashboard, activeElement=${focus1}`,
    });

    await page.keyboard.press("Control+K");
    const palette = page.getByRole("dialog", { name: /Command palette/i });
    const paletteVisible = await palette.isVisible().catch(() => false);
    keyboardNotes.push({
      screen: "command-palette",
      result: paletteVisible ? "pass" : "fail",
      notes: paletteVisible ? "Ctrl+K opened command palette dialog" : "Command palette not visible",
    });
    if (paletteVisible) await page.keyboard.press("Escape");

    await gotoPage(page, "orbix");
    const orbixInput = page.locator('[data-component="ekhata-input"]');
    const orbixOk = await orbixInput.isVisible().catch(() => false);
    if (orbixOk) {
      await orbixInput.focus();
      keyboardNotes.push({
        screen: "orbix",
        result: "pass",
        notes: "Orbix input focusable",
      });
    } else {
      keyboardNotes.push({
        screen: "orbix",
        result: "blocked",
        notes: "ekhata-input not found",
      });
    }

    await gotoPage(page, "billing");
    keyboardNotes.push({
      screen: "transaction-form",
      result: "smoke",
      notes: "Sales invoice form loaded for keyboard smoke; full form tab order not exhaustively verified",
    });

    await gotoPage(page, "parties");
    keyboardNotes.push({
      screen: "table",
      result: "smoke",
      notes: "Party list loaded; table semantics deferred to axe findings",
    });

    await gotoPage(page, "balance-sheet");
    keyboardNotes.push({
      screen: "report-filters",
      result: "smoke",
      notes: "Balance sheet loaded for filter/report keyboard smoke",
    });

    // Login keyboard smoke blocked (harness auto-auth)
    keyboardNotes.push({
      screen: "login",
      result: "blocked",
      notes: "Login outside harness; not keyboard-tested in UI QA path",
    });

    const byImpact: Record<string, number> = {};
    for (const f of findings) {
      const k = f.impact || "unknown";
      byImpact[k] = (byImpact[k] || 0) + 1;
    }

    const payload = {
      generated_at: new Date().toISOString(),
      tool: "@axe-core/playwright",
      tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      screens_scanned: screens.map((s) => s.screen),
      violation_count: findings.length,
      by_impact: byImpact,
      findings,
      keyboard_smoke: keyboardNotes,
      notes: [
        "Baseline only — backlog not fixed in Phase UI-0",
        "Auth/login keyboard path blocked by harness auto-authentication",
      ],
    };

    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

    const md = `# UI Accessibility Baseline

Generated: ${payload.generated_at}

## Tooling

Playwright + \`@axe-core/playwright\` with tags: ${payload.tags.join(", ")}.

## Summary

| Metric | Value |
|--------|------:|
| Screens scanned | ${screens.length} |
| Axe violations (node groups) | ${findings.length} |
| Critical | ${byImpact.critical || 0} |
| Serious | ${byImpact.serious || 0} |
| Moderate | ${byImpact.moderate || 0} |
| Minor | ${byImpact.minor || 0} |

## Keyboard smoke

| Screen | Result | Notes |
|--------|--------|-------|
${keyboardNotes.map((k) => `| ${k.screen} | ${k.result} | ${k.notes} |`).join("\n")}

## Top violation IDs

${[...new Set(findings.map((f) => f.violation_id))]
  .slice(0, 30)
  .map((id) => {
    const n = findings.filter((f) => f.violation_id === id).length;
    return `- \`${id}\` (${n})`;
  })
  .join("\n") || "_None_"}

## Policy

Do not treat this report as a completed accessibility remediation. Phase UI-0 records the baseline only.
`;
    fs.writeFileSync(OUT_MD, md);
  });
});
