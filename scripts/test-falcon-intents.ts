/**
 * Intent taxonomy regression tests — mirror of erp_bot/scripts/test_intents.py
 * Run: npx tsx scripts/test-falcon-intents.ts
 */

import { classifyIntent, isBareTopicQuery } from "../src/lib/falcon/intentTaxonomy";

const TEST_CASES: Array<[string, ReturnType<typeof classifyIntent>]> = [
  ["how to make a journal entry", "action_path"],
  ["how do I make a journal entry", "action_path"],
  ["how to create a sales invoice", "action_path"],
  ["how do I create a payment voucher", "action_path"],
  ["how to pass a journal", "action_path"],
  ["how can I post a receipt voucher", "action_path"],
  ["how to enter a contra entry", "action_path"],
  ["how do I add a new party", "action_path"],
  ["how to record a purchase invoice", "action_path"],
  ["how to generate a sales return", "action_path"],
  ["how to cut a bill", "action_path"],
  ["how do I book a debit note", "action_path"],

  ["what is a journal voucher", "definition"],
  ["tell me about journal voucher", "definition"],
  ["what is a debit note", "definition"],
  ["explain sales invoice", "definition"],
  ["what is VAT in Nepal", "definition"],
  ["what are TDS rules", "definition"],
  ["define contra voucher", "definition"],
  ["meaning of fiscal year", "definition"],

  ["steps to create a payment voucher", "steps"],
  ["step by step process for sales invoice", "steps"],
  ["walk me through creating a journal entry", "steps"],
  ["procedure for posting a receipt voucher", "steps"],
  ["guide me through adding a party", "steps"],
  ["detailed steps for stock transfer", "steps"],

  ["where is the day book", "nav"],
  ["where do I find the trial balance", "nav"],
  ["how to open the chart of accounts", "nav"],
  ["shortcut for journal entry", "nav"],
  ["keyboard shortcut for sales invoice", "nav"],
  ["how do I access the VAT report", "nav"],
  ["path to stock summary", "nav"],

  ["what gets debited in a payment voucher", "effect"],
  ["what gets credited in a receipt voucher", "effect"],
  ["accounting entry for sales invoice", "effect"],
  ["journal entry for purchase return", "effect"],
  ["which account is debited for salary payment", "effect"],
  ["debit credit for contra voucher", "effect"],
  ["what is the GL entry for depreciation", "effect"],

  ["why is my journal not balanced", "troubleshoot"],
  ["journal voucher not posting", "troubleshoot"],
  ["error when saving invoice", "troubleshoot"],
  ["sales invoice not working", "troubleshoot"],
  ["can't post payment voucher", "troubleshoot"],
  ["why isn't my stock updating", "troubleshoot"],
  ["getting negative stock error", "troubleshoot"],
  ["voucher won't save", "troubleshoot"],

  ["which function renders the sales invoice form", "code"],
  ["where in the code is the journal validation", "code"],
  ["what component handles party master", "code"],
  ["how is VAT calculation implemented", "code"],
  ["which file has the billing logic", "code"],
  ["show me the API endpoint for vouchers", "code"],
  ["database schema for invoices", "code"],
  ["supabase query for stock", "code"],

  ["hello", "general"],
  ["thanks", "general"],
  ["ok", "general"],

  // Phase 1 extensions
  ["journal voucher", "definition"],
  ["payment voucher", "definition"],
  ["how to make payment vouche", "action_path"],
  ["how to make payment voucher", "action_path"],
];

let passed = 0;
let failed = 0;
const failures: Array<{ question: string; expected: string; actual: string }> = [];

console.log("Falcon Intent Taxonomy Tests");
console.log("=".repeat(60));

for (const [question, expected] of TEST_CASES) {
  const actual = classifyIntent(question);
  if (actual === expected) {
    passed++;
    console.log(`  ✓ "${question}" → ${actual}`);
  } else {
    failed++;
    failures.push({ question, expected, actual });
    console.log(`  ✗ "${question}" → expected ${expected}, got ${actual}`);
  }
}

console.log("\nBare topic detection:");
const bareCases = [
  ["journal voucher", true],
  ["payment voucher", true],
  ["how to make journal entry", false],
] as const;
for (const [q, expected] of bareCases) {
  const actual = isBareTopicQuery(q);
  if (actual === expected) {
    passed++;
    console.log(`  ✓ isBareTopicQuery("${q}") = ${actual}`);
  } else {
    failed++;
    console.log(`  ✗ isBareTopicQuery("${q}") expected ${expected}, got ${actual}`);
  }
}

console.log("\n" + "=".repeat(60));
console.log(`SUMMARY: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) {
    console.log(`  • "${f.question}" expected ${f.expected}, got ${f.actual}`);
  }
  process.exit(1);
}

process.exit(0);
