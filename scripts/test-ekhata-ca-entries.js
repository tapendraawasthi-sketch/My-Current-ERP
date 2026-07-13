"use strict";
var _a, _b, _c, _d, _e, _f, _g, _h;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CA-level e-Khata entry classifier evaluation
 * Run: npm run test:ekhata-ca
 */
var fs_1 = require("fs");
var path_1 = require("path");
var parseKhata_1 = require("../src/lib/ekhata/parseKhata");
var caEntryTemplates_1 = require("../src/lib/ekhata/caEntryTemplates");
var corpusPath = (0, path_1.join)(process.cwd(), "data/ekhata/ca-training-examples.json");
var corpus = JSON.parse((0, fs_1.readFileSync)(corpusPath, "utf-8"));
var passed = 0;
var failed = 0;
var failures = [];
function check(name, ok, detail) {
    if (ok) {
        passed += 1;
        console.log("PASS ".concat(name));
    }
    else {
        failed += 1;
        var msg = "FAIL ".concat(name).concat(detail ? ": ".concat(detail) : "");
        console.log(msg);
        failures.push(msg);
    }
}
console.log("\n=== e-Khata CA Entry Evaluator ===");
console.log("Testing ".concat(corpus.examples.length, " training examples\n"));
var _loop_1 = function (ex) {
    var result = (0, parseKhata_1.parseKhataMessage)(ex.narration);
    var card = result.card;
    check("".concat(ex.id, " intent: ").concat(ex.narration.slice(0, 40)), (card === null || card === void 0 ? void 0 : card.intent) === ex.intent, "expected ".concat(ex.intent, ", got ").concat((_a = card === null || card === void 0 ? void 0 : card.intent) !== null && _a !== void 0 ? _a : "none"));
    if (card) {
        check("".concat(ex.id, " amount"), card.amount === ex.amount, "expected ".concat(ex.amount, ", got ").concat(card.amount));
        var balance = (0, caEntryTemplates_1.validateJournalBalance)((_b = card.journalLines) !== null && _b !== void 0 ? _b : []);
        check("".concat(ex.id, " balanced"), balance.balanced, "Dr ".concat(balance.totalDebit, " Cr ").concat(balance.totalCredit));
        if (ex.lines.length > 0 && card.journalLines) {
            var linesMatch = ex.lines.every(function (expected, i) {
                var actual = card.journalLines[i];
                if (!actual)
                    return false;
                return (actual.accountCode === expected.account &&
                    actual.debit === expected.debit &&
                    actual.credit === expected.credit);
            });
            check("".concat(ex.id, " journal lines"), linesMatch && card.journalLines.length === ex.lines.length, "line count or amounts mismatch");
        }
        if (ex.party) {
            check("".concat(ex.id, " party"), ((_c = card.party) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === ex.party.toLowerCase(), "expected ".concat(ex.party, ", got ").concat(card.party));
        }
    }
};
for (var _i = 0, _j = corpus.examples; _i < _j.length; _i++) {
    var ex = _j[_i];
    _loop_1(ex);
}
// Backward compatibility checks
var legacyCash = (0, parseKhata_1.parseKhataMessage)("aaja 200 ko nagad bikri vayo");
check("legacy cash sale", ((_d = legacyCash.card) === null || _d === void 0 ? void 0 : _d.intent) === "khata_cash_sale");
var legacyCredit = (0, parseKhata_1.parseKhataMessage)("Ram lai 500 udharo becheko");
check("legacy credit sale", ((_e = legacyCredit.card) === null || _e === void 0 ? void 0 : _e.intent) === "khata_credit_sale");
var ssfEmp = (0, parseKhata_1.parseKhataMessage)("ssf employee 50000 gross salary");
check("SSF employee intent", ((_f = ssfEmp.card) === null || _f === void 0 ? void 0 : _f.intent) === "khata_ssf_employee");
var badDebt = (0, parseKhata_1.parseKhataMessage)("Ram ko 3000 bad debt write off");
check("bad debt writeoff", ((_g = badDebt.card) === null || _g === void 0 ? void 0 : _g.intent) === "khata_bad_debt_writeoff");
var gratuity = (0, parseKhata_1.parseKhataMessage)("gratuity provision 25000");
check("gratuity provision", ((_h = gratuity.card) === null || _h === void 0 ? void 0 : _h.intent) === "khata_gratuity_provision");
console.log("\n=== Results: ".concat(passed, " passed, ").concat(failed, " failed ==="));
if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach(function (f) { return console.log("  ".concat(f)); });
}
process.exit(failed > 0 ? 1 : 0);
