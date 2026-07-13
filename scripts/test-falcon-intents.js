"use strict";
/**
 * Intent taxonomy regression tests — mirror of erp_bot/scripts/test_intents.py
 * Run: npx tsx scripts/test-falcon-intents.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
var intentTaxonomy_1 = require("../src/lib/falcon/intentTaxonomy");
var TEST_CASES = [
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
var passed = 0;
var failed = 0;
var failures = [];
console.log("Falcon Intent Taxonomy Tests");
console.log("=".repeat(60));
for (var _i = 0, TEST_CASES_1 = TEST_CASES; _i < TEST_CASES_1.length; _i++) {
    var _a = TEST_CASES_1[_i], question = _a[0], expected = _a[1];
    var actual = (0, intentTaxonomy_1.classifyIntent)(question);
    if (actual === expected) {
        passed++;
        console.log("  \u2713 \"".concat(question, "\" \u2192 ").concat(actual));
    }
    else {
        failed++;
        failures.push({ question: question, expected: expected, actual: actual });
        console.log("  \u2717 \"".concat(question, "\" \u2192 expected ").concat(expected, ", got ").concat(actual));
    }
}
console.log("\nBare topic detection:");
var bareCases = [
    ["journal voucher", true],
    ["payment voucher", true],
    ["how to make journal entry", false],
];
for (var _b = 0, bareCases_1 = bareCases; _b < bareCases_1.length; _b++) {
    var _c = bareCases_1[_b], q = _c[0], expected = _c[1];
    var actual = (0, intentTaxonomy_1.isBareTopicQuery)(q);
    if (actual === expected) {
        passed++;
        console.log("  \u2713 isBareTopicQuery(\"".concat(q, "\") = ").concat(actual));
    }
    else {
        failed++;
        console.log("  \u2717 isBareTopicQuery(\"".concat(q, "\") expected ").concat(expected, ", got ").concat(actual));
    }
}
console.log("\n" + "=".repeat(60));
console.log("SUMMARY: ".concat(passed, " passed, ").concat(failed, " failed"));
if (failures.length > 0) {
    console.log("\nFAILURES:");
    for (var _d = 0, failures_1 = failures; _d < failures_1.length; _d++) {
        var f = failures_1[_d];
        console.log("  \u2022 \"".concat(f.question, "\" expected ").concat(f.expected, ", got ").concat(f.actual));
    }
    process.exit(1);
}
process.exit(0);
