/**
 * PR-B6 — Orbix launch vitest pack with elevated timeout (no vacuous skip).
 */
import { spawnSync } from "node:child_process";

const targets = [
  "src/__tests__/orbix/maiNext*.test.ts",
  "src/__tests__/orbix/maiPrB*.test.ts",
  "src/__tests__/orbix/maiPrC*.test.ts",
  "src/__tests__/orbix/maiPrH*.test.ts",
  "src/__tests__/orbix/maiPrD*.test.ts",
  "src/__tests__/orbix/postSalesTransaction.test.ts",
  "src/__tests__/orbix/postPurchaseTransaction.test.ts",
];

console.log("Running Orbix launch vitest pack…");
const r = spawnSync(
  "npx",
  ["vitest", "run", ...targets, "--reporter=dot", "--testTimeout=30000"],
  { stdio: "inherit", shell: true, cwd: process.cwd() },
);
process.exit(r.status ?? 1);
