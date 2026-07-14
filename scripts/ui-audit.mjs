/**
 * Master UI audit runner — executes inventory scripts and writes env readiness stub.
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(script) {
  console.log(`\n=== ${script} ===`);
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", script)], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error(`Script failed: ${script} exit ${r.status}`);
    process.exit(r.status || 1);
  }
}

run("ui-route-inventory.mjs");
run("ui-style-metrics.mjs");
run("ui-icon-inventory.mjs");
run("ui-component-inventory.mjs");

const env = {
  generated_at: new Date().toISOString(),
  frontend_start_command: "npm run dev",
  frontend_url: "http://127.0.0.1:3000",
  ui_qa_harness_url: "http://127.0.0.1:3000/e2e/ui-qa.html",
  authenticated_ui_test_account: {
    exists: true,
    mechanism: "UI QA harness bootstrap (skips login UI)",
    user: "e2e.accountant / user-e2e-accountant",
    company: "orbix-e2e-company / Orbix E2E Test Company",
  },
  visual_tests_safe: true,
  isolated_e2e_data: true,
  production_urls_configured: "check VITE_API_URL / ORBIX_SYNC — Playwright defaults avoid production",
  screenshot_without_accounting_mutation: true,
  note: "Harness uses IndexedDB reset/seed for E2E-tagged company only. assertSafeCompany guards mutation APIs.",
  readiness: "environment ready for harness-based visual capture; production login screens require separate read-only capture or are blocked if production credentials appear",
};

fs.mkdirSync(path.join(ROOT, "docs/ui-audit"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "docs/ui-audit/UI_ENV_READINESS.json"),
  JSON.stringify(env, null, 2),
);
console.log("\nUI audit complete.");
