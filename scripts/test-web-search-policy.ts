/**
 * Web search policy tests
 * Run: npx tsx scripts/test-web-search-policy.ts
 */

import { analyzeIntent } from "../src/lib/falcon/smartIntentEngine";
import { shouldUseWebSearchForIntent } from "../src/lib/falcon/webSearchPolicy";

const CASES: Array<[string, boolean]> = [
  ["how to make journal entry", false],
  ["where is day book", false],
  ["steps to create payment voucher", false],
  ["what is TDS rate in Nepal", true],
  ["search latest VAT news Nepal", true],
  ["journal voucher", false],
  ["which function renders sales invoice", false],
];

let passed = 0;
let failed = 0;

for (const [query, expected] of CASES) {
  const intent = analyzeIntent(query);
  const actual = shouldUseWebSearchForIntent(intent, 0.4);
  if (actual === expected) {
    passed++;
    console.log(`  ✓ "${query}" → web=${actual}`);
  } else {
    failed++;
    console.log(`  ✗ "${query}" expected web=${expected}, got ${actual}`);
  }
}

console.log(`\nWeb search policy: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
