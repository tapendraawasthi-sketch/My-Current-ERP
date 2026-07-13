#!/usr/bin/env node
/**
 * Fails if unexpected emitted .js files appear under TypeScript sources.
 * Remediation: delete the .js file and ensure `tsc --noEmit` (or Vite) is used.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Known hand-authored JS allowlist (legacy Node server under src/). */
const ALLOWLIST = new Set([
  "src/server.js",
  "src/db/migrate.js",
  "src/db/pool.js",
  "src/middleware/audit.js",
  "src/controllers/auditController.js",
  "src/controllers/backupController.js",
  "src/controllers/companyController.js",
  "src/controllers/companyFeaturesController.js",
  "src/controllers/fiscalYearController.js",
  "src/controllers/shortcutController.js",
  "src/routes/auditRoutes.js",
  "src/routes/backupRoutes.js",
  "src/routes/companyFeaturesRoutes.js",
  "src/routes/companyRoutes.js",
  "src/routes/fiscalYearRoutes.js",
  "src/routes/shortcutRoutes.js",
  "src/routes/topbarRoutes.js",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const unexpected = [];

for (const file of walk(path.join(root, "src"))) {
  if (!file.endsWith(".js")) continue;
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (ALLOWLIST.has(rel)) continue;
  unexpected.push({
    file: rel,
    remediation: `Delete ${rel} and ensure TypeScript sources compile with tsc --noEmit / Vite (no emit-to-src).`,
  });
}

for (const file of walk(path.join(root, "e2e"))) {
  if (!file.endsWith(".js")) continue;
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (ALLOWLIST.has(rel)) continue;
  unexpected.push({
    file: rel,
    remediation: `Delete ${rel}; keep Playwright specs as .ts.`,
  });
}

const viteJs = path.join(root, "vite.config.js");
const viteTs = path.join(root, "vite.config.ts");
if (fs.existsSync(viteJs) && fs.existsSync(viteTs)) {
  unexpected.push({
    file: "vite.config.js",
    remediation: "Delete vite.config.js; vite.config.ts already exists.",
  });
}

if (unexpected.length) {
  console.error("Unexpected emitted/hand JS files detected:");
  for (const u of unexpected) {
    console.error(`  - ${u.file}`);
    console.error(`    ${u.remediation}`);
  }
  process.exit(1);
}

console.log("check:no-emitted-js OK");
