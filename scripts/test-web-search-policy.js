"use strict";
/**
 * Web search policy tests
 * Run: npx tsx scripts/test-web-search-policy.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
var smartIntentEngine_1 = require("../src/lib/falcon/smartIntentEngine");
var webSearchPolicy_1 = require("../src/lib/falcon/webSearchPolicy");
var CASES = [
    ["how to make journal entry", false],
    ["where is day book", false],
    ["steps to create payment voucher", false],
    ["what is TDS rate in Nepal", true],
    ["search latest VAT news Nepal", true],
    ["journal voucher", false],
    ["which function renders sales invoice", false],
];
var passed = 0;
var failed = 0;
for (var _i = 0, CASES_1 = CASES; _i < CASES_1.length; _i++) {
    var _a = CASES_1[_i], query = _a[0], expected = _a[1];
    var intent = (0, smartIntentEngine_1.analyzeIntent)(query);
    var actual = (0, webSearchPolicy_1.shouldUseWebSearchForIntent)(intent, 0.4);
    if (actual === expected) {
        passed++;
        console.log("  \u2713 \"".concat(query, "\" \u2192 web=").concat(actual));
    }
    else {
        failed++;
        console.log("  \u2717 \"".concat(query, "\" expected web=").concat(expected, ", got ").concat(actual));
    }
}
console.log("\nWeb search policy: ".concat(passed, " passed, ").concat(failed, " failed"));
process.exit(failed > 0 ? 1 : 0);
