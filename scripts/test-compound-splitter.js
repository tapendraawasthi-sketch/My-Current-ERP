"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Compound splitter + batch builder smoke tests.
 * Run: npx tsx scripts/test-compound-splitter.ts
 */
var compound_1 = require("../src/lib/ekhata/compound");
var compoundBatch_1 = require("../src/lib/ekhata/compoundBatch");
var processMessage_1 = require("../src/lib/ekhata/processMessage");
var passed = 0;
var failed = 0;
function check(name, ok, detail) {
    if (ok) {
        passed += 1;
        console.log("PASS ".concat(name));
    }
    else {
        failed += 1;
        console.log("FAIL ".concat(name).concat(detail ? ": ".concat(detail) : ""));
    }
}
var daily = (0, compound_1.splitCompoundTransactions)("aaja bikri 8500, rent 8000 tiryo");
check("split daily summary", daily.length === 2 && daily[0].includes("8500") && daily[1].includes("8000"));
var noSplit = (0, compound_1.splitCompoundTransactions)("Ram lai saman becheko Rs 1,500 cash ma");
check("no split amount comma", noSplit.length === 1);
var raSplit = (0, compound_1.splitCompoundTransactions)("Ram lai 5000 becheko ra electricity kharcha 2000");
check("split ra conjunct", raSplit.length === 2 && raSplit[0].includes("5000") && raSplit[1].includes("2000"));
check("is compound message", (0, compound_1.isCompoundMessage)("aaja bikri 8500, rent 8000 tiryo") &&
    !(0, compound_1.isCompoundMessage)("Ram lai 500 cash ma becheko"));
var batchPhrase = "aaja 8500 ko nagad bikri vayo, electricity kharcha 8000";
var built = (0, compoundBatch_1.buildCompoundBatch)(batchPhrase);
check("build compound batch", built.ok &&
    built.batch.compoundCount === 2 &&
    built.batch.parts[0].card.intent === "khata_cash_sale" &&
    built.batch.parts[1].card.intent === "khata_expense", built.ok ? undefined : built.reply);
var routed = (0, processMessage_1.processEKhataMessage)(batchPhrase);
check("process routes compound", routed.kind === "compound" && routed.batch.compoundCount === 2, routed.kind);
console.log("\n".concat(passed, "/").concat(passed + failed, " passed"));
process.exit(failed > 0 ? 1 : 0);
