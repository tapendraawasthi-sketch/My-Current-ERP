/**
 * UI-3.17 — Authenticated route inventory smoke (static + critical list).
 * Does not launch a browser; pairs with Playwright shell/QA tests for render proof.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(ROOT, "src/App.tsx");
const outDir = path.join(ROOT, "artifacts/ui-redesign/phase-ui-3");
const app = fs.readFileSync(appPath, "utf8");

const cases = new Set();
for (const m of app.matchAll(/case\s+["']([^"']+)["']\s*:/g)) {
  cases.add(m[1]);
}

const CRITICAL = [
  "dashboard",
  "orbix",
  "billing",
  "purchase",
  "receipt",
  "payment",
  "journal",
  "accounts",
  "parties",
  "items",
  "day-book",
  "ledger",
  "trial-balance",
  "profit-loss",
  "balance-sheet",
  "bank-reconciliation",
  "bank-statement-import",
  "stock-summary",
  "audit-log",
  "users",
  "settings",
  "backup-restore",
];

const results = [];
for (const route of [...cases].sort()) {
  const critical = CRITICAL.includes(route);
  results.push({
    route,
    role: "any_authenticated",
    company: "n/a-static",
    permission_result: "not_evaluated_static",
    render_result: "registered_in_App_switch",
    shell_mode: "AppShell",
    active_navigation: "see SHELL_NAV",
    overflow: "browser_validated_separately",
    error: "",
    screenshot: critical ? `artifacts/ui-redesign/phase-ui-3/critical-${route}.png` : "",
    notes: critical ? "critical" : "",
  });
}

const missingCritical = CRITICAL.filter((r) => !cases.has(r));
fs.mkdirSync(outDir, { recursive: true });
const payload = {
  generated_at: new Date().toISOString(),
  authenticated_route_count: cases.size,
  critical_count: CRITICAL.length,
  critical_missing_from_app: missingCritical,
  passed: cases.size,
  failed: missingCritical.length,
  permission_blocked_as_expected: 0,
  environment_blocked: 0,
  results,
};
fs.writeFileSync(path.join(outDir, "route-smoke-results.json"), JSON.stringify(payload, null, 2));
console.log(
  `UI-3 route smoke inventory: ${cases.size} App.tsx cases; critical missing=${missingCritical.length}`,
);
if (missingCritical.length) {
  console.error("Missing critical routes:", missingCritical.join(", "));
  process.exit(1);
}
process.exit(0);
