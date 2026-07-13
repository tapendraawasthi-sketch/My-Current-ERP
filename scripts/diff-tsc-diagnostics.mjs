/**
 * Normalize and diff TypeScript diagnostics (Phase 6.5 verification).
 * Usage: node scripts/diff-tsc-diagnostics.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const PHASE65_PATHS = [
  "src/domains/sales/inventoryAccountingPolicy.ts",
  "src/domains/sales/costAllocation.ts",
  "src/domains/sales/salesVatEngine.ts",
  "src/domains/sales/postSalesTransaction.ts",
  "src/domains/sales/e2eSeed.ts",
  "src/domains/sales/index.ts",
  "src/domains/sales/transactionClassification.ts",
  "src/store/invoicePostingWriters.ts",
  "src/lib/db.ts",
  "src/platform/sync/applyRemoteEvent.ts",
  "src/platform/sync/accountingSyncContract.ts",
  "src/platform/sync/reconciliation.ts",
  "src/platform/sync/syncStatusAggregate.ts",
  "src/platform/sync/syncTransport.ts",
  "src/platform/sync/enqueueSalesSync.ts",
  "src/App.tsx",
  "src/components/SalesReconciliationPanel.tsx",
  "src/components/shell/SyncStatusControl.tsx",
  "src/e2e/bootstrapUiQaHarness.ts",
  "src/__tests__/orbix/postSalesTransaction.test.ts",
  "src/__tests__/orbix/salesRemoteApplyNoRecalc.test.ts",
  "src/__tests__/orbix/salesVatAndCost.test.ts",
  "src/__tests__/orbix/deviceRegistration.test.ts",
  "src/__tests__/orbix/noDoubleSync.test.ts",
];

const PHASE65_PREFIXES = [
  "src/domains/sales/",
  "src/store/invoicePostingWriters.ts",
  "src/platform/sync/applyRemoteEvent.ts",
  "src/platform/sync/accountingSyncContract.ts",
  "src/platform/sync/reconciliation.ts",
  "src/platform/sync/syncStatusAggregate.ts",
  "src/platform/sync/enqueueSalesSync.ts",
  "src/components/SalesReconciliationPanel.tsx",
];

function normalizePath(p) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function parseDiagnostics(text) {
  const re = /^(.*?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) continue;
    const file = normalizePath(m[1]);
    out.push({
      file,
      line: Number(m[2]),
      column: Number(m[3]),
      code: m[4],
      message: m[5].trim(),
      keyExact: `${file}|${m[2]}|${m[3]}|${m[4]}|${m[5].trim()}`,
      keySoft: `${file}|${m[4]}|${m[5].trim()}`,
      keyFileCode: `${file}|${m[4]}`,
    });
  }
  return out;
}

function isPhase65File(file) {
  const f = normalizePath(file);
  if (PHASE65_PATHS.some((p) => f === p || f.endsWith("/" + p))) return true;
  return PHASE65_PREFIXES.some((p) => f === p || f.startsWith(p));
}

function load(name) {
  return fs.readFileSync(path.join(ROOT, "artifacts", name), "utf8");
}

const baseline = parseDiagnostics(load("typecheck-baseline-raw.txt"));
const current = parseDiagnostics(load("typecheck-current-raw.txt"));

const baselineSoft = new Map();
for (const d of baseline) {
  if (!baselineSoft.has(d.keySoft)) baselineSoft.set(d.keySoft, []);
  baselineSoft.get(d.keySoft).push(d);
}

const currentSoft = new Map();
for (const d of current) {
  if (!currentSoft.has(d.keySoft)) currentSoft.set(d.keySoft, []);
  currentSoft.get(d.keySoft).push(d);
}

const baselineOnly = [];
for (const [k, arr] of baselineSoft) {
  if (!currentSoft.has(k)) baselineOnly.push(...arr);
}

const currentOnly = [];
for (const [k, arr] of currentSoft) {
  if (!baselineSoft.has(k)) currentOnly.push(...arr);
}

const currentOnlyPhase65 = currentOnly.filter((d) => isPhase65File(d.file));
const currentOnlyOther = currentOnly.filter((d) => !isPhase65File(d.file));

// Transitive: new diagnostics in untouched files that import phase65 contracts
const SHARED_TOUCHED = new Set([
  "src/platform/sync/accountingSyncContract.ts",
  "src/platform/sync/syncStatusAggregate.ts",
  "src/platform/sync/syncTransport.ts",
  "src/platform/sync/reconciliation.ts",
  "src/lib/db.ts",
  "src/store/invoicePostingWriters.ts",
  "src/App.tsx",
]);

const transitiveSuspect = currentOnlyOther.filter((d) => {
  // heuristics: sync/purchase/sales related messages
  const msg = d.message.toLowerCase();
  const file = d.file.toLowerCase();
  return (
    file.includes("purchase") ||
    file.includes("sync") ||
    file.includes("sales") ||
    file.includes("invoice") ||
    msg.includes("salesposted") ||
    msg.includes("purchaseposted") ||
    msg.includes("aggregatedsyncstatus") ||
    msg.includes("deviceidshort") ||
    msg.includes("registrationstatus") ||
    msg.includes("salescostallocation")
  );
});

const byFile = (arr) => {
  const m = {};
  for (const d of arr) {
    m[d.file] = (m[d.file] || 0) + 1;
  }
  return m;
};

const report = {
  command: "npx tsc --noEmit --pretty false",
  tsconfig: "tsconfig.json (include: src)",
  baseline_commit: "753fc80e",
  baseline_method: "git worktree at HEAD (pre-uncommitted Orbix/Phase5-6.5 tree)",
  baseline: {
    total: baseline.length,
    unique_files: new Set(baseline.map((d) => d.file)).size,
    codes: Object.fromEntries(
      [...baseline.reduce((m, d) => m.set(d.code, (m.get(d.code) || 0) + 1), new Map())].sort(),
    ),
  },
  current: {
    total: current.length,
    unique_files: new Set(current.map((d) => d.file)).size,
    codes: Object.fromEntries(
      [...current.reduce((m, d) => m.set(d.code, (m.get(d.code) || 0) + 1), new Map())].sort(),
    ),
  },
  baseline_only_count: baselineOnly.length,
  current_only_count: currentOnly.length,
  current_only_in_phase65_files: currentOnlyPhase65,
  current_only_outside_phase65_files_count: currentOnlyOther.length,
  transitive_suspect: transitiveSuspect,
  phase65_changed_file_diagnostics_current: current.filter((d) => isPhase65File(d.file)),
  phase65_changed_file_diagnostics_baseline: baseline.filter((d) => isPhase65File(d.file)),
  files_current_only: byFile(currentOnly),
  files_phase65_current_only: byFile(currentOnlyPhase65),
};

fs.writeFileSync(
  path.join(ROOT, "artifacts/typecheck-diff-report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);

const md = [];
md.push("# TypeScript baseline-difference report (Phase 6.5)");
md.push("");
md.push(`- Command: \`${report.command}\``);
md.push(`- Config: \`${report.tsconfig}\``);
md.push(`- Baseline: commit \`${report.baseline_commit}\` via worktree`);
md.push(`- Baseline diagnostics: **${report.baseline.total}** (${report.baseline.unique_files} files)`);
md.push(`- Current diagnostics: **${report.current.total}** (${report.current.unique_files} files)`);
md.push(`- Baseline-only (resolved or moved soft-key): **${report.baseline_only_count}**`);
md.push(`- Current-only (new soft-key): **${report.current_only_count}**`);
md.push(`- Current-only in Phase 6.5 file scope: **${currentOnlyPhase65.length}**`);
md.push(`- Transitive suspects: **${transitiveSuspect.length}**`);
md.push("");
md.push("## Current-only diagnostics in Phase 6.5 files");
if (!currentOnlyPhase65.length) {
  md.push("_None_");
} else {
  for (const d of currentOnlyPhase65) {
    md.push(`- \`${d.file}:${d.line}:${d.column}\` ${d.code}: ${d.message}`);
  }
}
md.push("");
md.push("## Transitive suspects (untouched / non-phase65 files)");
if (!transitiveSuspect.length) {
  md.push("_None matching heuristics_");
} else {
  for (const d of transitiveSuspect.slice(0, 50)) {
    md.push(`- \`${d.file}:${d.line}:${d.column}\` ${d.code}: ${d.message}`);
  }
}
md.push("");
md.push("## Current-only files (top 30)");
for (const [f, n] of Object.entries(byFile(currentOnly))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)) {
  md.push(`- \`${f}\`: ${n}`);
}

fs.writeFileSync(path.join(ROOT, "artifacts/typecheck-diff-report.md"), md.join("\n"), "utf8");

console.log(JSON.stringify({
  baseline: report.baseline.total,
  current: report.current.total,
  current_only: currentOnly.length,
  phase65_new: currentOnlyPhase65.length,
  transitive_suspect: transitiveSuspect.length,
}, null, 2));
console.log("\nPhase 6.5 new diagnostics:");
for (const d of currentOnlyPhase65) {
  console.log(`  ${d.file}:${d.line} ${d.code} ${d.message}`);
}
