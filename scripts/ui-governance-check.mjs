/**
 * UI-0.11 — Baseline-aware UI governance checks.
 * Fails only on NEW violations vs tools/ui-governance/baselines/*.
 *
 * Modes:
 *   --write-baseline   regenerate baselines from current tree
 *   (default)          compare against baselines and exit 1 on new debt
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const BASE = path.join(ROOT, "tools/ui-governance/baselines");
const WRITE = process.argv.includes("--write-baseline");

const APPROVED_TOKEN_FILES = new Set([
  "src/styles.css",
  "src/styles/design-tokens.css",
  "src/styles/tally-green.css",
  "src/design-system/foundations/tokens.css",
  "src/design-system/foundations/typography.css",
  "src/design-system/foundations/focus.css",
  "src/design-system/foundations/print.css",
  "src/design-system/foundations/index.css",
]);

const APPROVED_IMPORTANT_FILES = new Set([
  "src/styles.css",
  "src/styles/design-tokens.css",
  "src/styles/tally-green.css",
  "src/design-system/foundations/tokens.css",
  "src/design-system/foundations/focus.css",
  "src/design-system/foundations/print.css",
]);

/** New design-system feature code must still obey rules; only foundation token CSS may hold raw hex. */
function isDesignSystemFoundation(file) {
  return file.startsWith("src/design-system/foundations/");
}

function isDesignSystemIcon(file) {
  return file.startsWith("src/design-system/icons/");
}

function isE2eHarness(file) {
  return file.startsWith("src/e2e/");
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", "dist", "e2e"].includes(ent.name)) continue;
      walk(p, files);
    } else if (/\.(tsx|ts|jsx|css)$/.test(ent.name)) files.push(p);
  }
  return files;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function hashLine(file, line, rule, snippet) {
  return crypto
    .createHash("sha1")
    .update(`${rule}|${file}|${line}|${snippet.trim()}`)
    .digest("hex")
    .slice(0, 16);
}

function scan() {
  const violations = [];
  const files = walk(SRC);

  for (const abs of files) {
    const file = rel(abs);
    const text = fs.readFileSync(abs, "utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, idx) => {
      const n = idx + 1;

      // G: @ts-nocheck in UI files
      if (/@ts-nocheck/.test(line) && /\.(tsx|ts)$/.test(file)) {
        violations.push({
          rule: "no-ts-nocheck",
          file,
          line: n,
          snippet: line.trim().slice(0, 120),
          id: hashLine(file, n, "no-ts-nocheck", line),
        });
      }

      // H: new tally-green imports
      if (/tally-green\.css|styles\/tally-green/.test(line)) {
        violations.push({
          rule: "no-legacy-green-import",
          file,
          line: n,
          snippet: line.trim().slice(0, 120),
          id: hashLine(file, n, "no-legacy-green-import", line),
        });
      }

      // B: !important outside approved files
      if (/!important/.test(line) && !APPROVED_IMPORTANT_FILES.has(file)) {
        violations.push({
          rule: "no-new-important",
          file,
          line: n,
          snippet: line.trim().slice(0, 120),
          id: hashLine(file, n, "no-new-important", line),
        });
      }

      // A: raw hex in feature components (not token files, not charts allowlist heuristic)
      if (
        !APPROVED_TOKEN_FILES.has(file) &&
        !isDesignSystemFoundation(file) &&
        !isDesignSystemIcon(file) &&
        !isE2eHarness(file) &&
        /\.(tsx|jsx)$/.test(file) &&
        /#[0-9a-fA-F]{3,8}\b/.test(line) &&
        !/chart|palette|recharts|COLORS|COLOR_/.test(file) &&
        !/^\s*\/\//.test(line) &&
        !/^\s*\*/.test(line)
      ) {
        violations.push({
          rule: "no-raw-hex-in-features",
          file,
          line: n,
          snippet: line.trim().slice(0, 120),
          id: hashLine(file, n, "no-raw-hex-in-features", line),
        });
      }

      // C: essential UI text below 12px (text-[9|10|11px]) — design-system + new code
      if (
        /\.(tsx|jsx)$/.test(file) &&
        /text-\[(9|10|11)px\]/.test(line) &&
        !isE2eHarness(file)
      ) {
        violations.push({
          rule: "min-font-12px",
          file,
          line: n,
          snippet: line.trim().slice(0, 120),
          id: hashLine(file, n, "min-font-12px", line),
        });
      }

      // D: static inline style objects (heuristic: style={{ with colour/font)
      if (
        /\.(tsx|jsx)$/.test(file) &&
        !isE2eHarness(file) &&
        /style=\{\{/.test(line) &&
        /(color|background|fontSize|border|padding|margin)/.test(line)
      ) {
        violations.push({
          rule: "no-static-inline-style",
          file,
          line: n,
          snippet: line.trim().slice(0, 120),
          id: hashLine(file, n, "no-static-inline-style", line),
        });
      }

      // I: arbitrary numeric z-index outside design-system foundations (UI-2)
      // Allow z-[var(--ds-z-*)] only; flag z-[NNN] / style zIndex literals in new DS + features.
      if (
        /\.(tsx|jsx)$/.test(file) &&
        !isE2eHarness(file) &&
        !isDesignSystemFoundation(file) &&
        (/z-\[\d+\]/.test(line) || /zIndex\s*:\s*\d+/.test(line) || /z-index\s*:\s*\d+/.test(line))
      ) {
        violations.push({
          rule: "no-arbitrary-z-index",
          file,
          line: n,
          snippet: line.trim().slice(0, 120),
          id: hashLine(file, n, "no-arbitrary-z-index", line),
        });
      }
    });

    // E: icon-only buttons without accessible name (heuristic multiline-ish)
    if (/\.(tsx|jsx)$/.test(file)) {
      const iconBtn =
        /<button([^>]*)>\s*<(?:[A-Z][A-Za-z0-9]*)\b[^>]*\/?\s*>\s*<\/button>/gs;
      let m;
      while ((m = iconBtn.exec(text))) {
        const attrs = m[1] || "";
        const hasName =
          /aria-label=/.test(attrs) ||
          /title=/.test(attrs) ||
          /aria-labelledby=/.test(attrs);
        if (!hasName) {
          const line = text.slice(0, m.index).split(/\r?\n/).length;
          const snippet = m[0].replace(/\s+/g, " ").slice(0, 120);
          violations.push({
            rule: "icon-button-accessible-name",
            file,
            line,
            snippet,
            id: hashLine(file, line, "icon-button-accessible-name", snippet),
          });
        }
      }
    }

    // F: design-system import direction — flag deep relative imports that bypass ui barrel
    // Only record; baseline absorbs existing. New = fail.
    if (/\.(tsx|jsx)$/.test(file) && !file.startsWith("src/components/ui/")) {
      // no additional scan beyond recording rule id space
    }
  }

  return violations;
}

function loadBaseline(name) {
  const p = path.join(BASE, name);
  if (!fs.existsSync(p)) return new Set();
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  return new Set(data.ids || []);
}

function writeBaseline(name, violations, rule) {
  const filtered = violations.filter((v) => v.rule === rule);
  const payload = {
    rule,
    generated_at: new Date().toISOString(),
    count: filtered.length,
    ids: filtered.map((v) => v.id).sort(),
    samples: filtered.slice(0, 50).map((v) => ({
      id: v.id,
      file: v.file,
      line: v.line,
      snippet: v.snippet,
    })),
  };
  fs.mkdirSync(BASE, { recursive: true });
  fs.writeFileSync(path.join(BASE, name), JSON.stringify(payload, null, 2));
  return filtered.length;
}

const violations = scan();
const rules = [
  ["raw-hex.json", "no-raw-hex-in-features"],
  ["important.json", "no-new-important"],
  ["min-font.json", "min-font-12px"],
  ["inline-style.json", "no-static-inline-style"],
  ["icon-button-a11y.json", "icon-button-accessible-name"],
  ["ts-nocheck.json", "no-ts-nocheck"],
  ["legacy-green.json", "no-legacy-green-import"],
  ["arbitrary-z-index.json", "no-arbitrary-z-index"],
];

if (WRITE) {
  fs.mkdirSync(BASE, { recursive: true });
  for (const [file, rule] of rules) {
    const n = writeBaseline(file, violations, rule);
    console.log(`Wrote baseline ${file}: ${n}`);
  }
  // Architecture note for import direction
  fs.writeFileSync(
    path.join(BASE, "approved-ui-import-path.json"),
    JSON.stringify(
      {
        approved_path: "@/components/ui",
        barrel: "src/components/ui/index.ts",
        note: "Future feature components should import primitives from this path. Existing direct imports are baseline debt.",
      },
      null,
      2,
    ),
  );
  console.log("Baselines written.");
  process.exit(0);
}

let failed = false;
const report = { generated_at: new Date().toISOString(), rules: {} };

for (const [file, rule] of rules) {
  const baseline = loadBaseline(file);
  const current = violations.filter((v) => v.rule === rule);
  const currentIds = new Set(current.map((v) => v.id));
  const newOnes = current.filter((v) => !baseline.has(v.id));
  // Removed debt is OK (improvement)
  report.rules[rule] = {
    baseline: baseline.size,
    current: current.length,
    new_violations: newOnes.length,
    new_samples: newOnes.slice(0, 20),
  };
  if (newOnes.length > 0) {
    failed = true;
    console.error(`FAIL ${rule}: ${newOnes.length} new violation(s)`);
    for (const v of newOnes.slice(0, 10)) {
      console.error(`  ${v.file}:${v.line} ${v.snippet}`);
    }
  } else {
    console.log(`PASS ${rule}: current=${current.length} baseline=${baseline.size} new=0`);
  }
}

fs.mkdirSync(path.join(ROOT, "artifacts/ui-0"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "artifacts/ui-0/governance-report.json"),
  JSON.stringify(report, null, 2),
);

if (failed) {
  console.error("UI governance check FAILED");
  process.exit(1);
}
console.log("UI governance check PASSED (no new debt vs baselines)");
process.exit(0);
