"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * AI Runtime — bank payment scenario
 * Run: npm run test:ai-runtime-payment
 *
 * Flow: "I paid Ram 50,000 by bank"
 *   → Intent Extraction → Accounting Reasoning → Journal Proposal
 *   → Confidence → Approval → Command Bus → Explain
 */
var registry_1 = require("../src/platform/flags/registry");
var ai_runtime_1 = require("../src/platform/ai-runtime");
var INPUT = "I paid Ram 50,000 by bank";
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
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var extract, proposal, dr, cr, result;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    (0, registry_1.clearMigrationFlagOverrides)();
                    (0, registry_1.setMigrationFlagOverride)("MIGRATION_AI_RUNTIME", true);
                    (0, registry_1.setMigrationFlagOverride)("MIGRATION_QUERY_BUS", true);
                    (0, registry_1.setMigrationFlagOverride)("MIGRATION_COMMAND_BUS", true);
                    (0, registry_1.setMigrationFlagOverride)("MIGRATION_AI_PROPOSALS", true);
                    (0, ai_runtime_1.resetAiRuntime)();
                    (0, ai_runtime_1.resetMemoryStore)();
                    (0, ai_runtime_1.bootstrapAiRuntime)();
                    console.log("\n=== Intent Extraction ===");
                    extract = (0, ai_runtime_1.extractAccountingIntent)(INPUT);
                    check("extract intent", (extract === null || extract === void 0 ? void 0 : extract.khataIntent) === "khata_payment_out", extract === null || extract === void 0 ? void 0 : extract.khataIntent);
                    check("party Ram", ((_a = extract === null || extract === void 0 ? void 0 : extract.party) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === "ram", (_b = extract === null || extract === void 0 ? void 0 : extract.party) !== null && _b !== void 0 ? _b : "null");
                    check("amount 50000", (extract === null || extract === void 0 ? void 0 : extract.amount) === 50000, String(extract === null || extract === void 0 ? void 0 : extract.amount));
                    check("payment mode bank", (extract === null || extract === void 0 ? void 0 : extract.paymentMode) === "bank", extract === null || extract === void 0 ? void 0 : extract.paymentMode);
                    console.log("\n=== Journal Proposal ===");
                    proposal = extract ? (0, ai_runtime_1.buildJournalProposal)(extract) : null;
                    check("balanced journal", (proposal === null || proposal === void 0 ? void 0 : proposal.balanced) === true);
                    dr = proposal === null || proposal === void 0 ? void 0 : proposal.lines.find(function (l) { return l.debit > 0; });
                    cr = proposal === null || proposal === void 0 ? void 0 : proposal.lines.find(function (l) { return l.credit > 0; });
                    check("debit creditor", (dr === null || dr === void 0 ? void 0 : dr.accountCode) === "KH-CRED", dr === null || dr === void 0 ? void 0 : dr.accountCode);
                    check("credit bank", (cr === null || cr === void 0 ? void 0 : cr.accountCode) === "KH-BANK", cr === null || cr === void 0 ? void 0 : cr.accountCode);
                    check("amount on lines", (dr === null || dr === void 0 ? void 0 : dr.debit) === 50000 && (cr === null || cr === void 0 ? void 0 : cr.credit) === 50000);
                    console.log("\n=== Full Pipeline ===");
                    return [4 /*yield*/, (0, ai_runtime_1.processAiRequest)((0, ai_runtime_1.createAiRequest)({ sessionId: "payment-test", input: INPUT, tenantId: "t1" }))];
                case 1:
                    result = _d.sent();
                    check("structured output", result.stage === "complete" || result.stage === "refused");
                    check("intent khata_payment_out", result.intent.action === "khata_payment_out", result.intent.action);
                    check("confidence present", result.confidence.score > 0.5, String(result.confidence.score));
                    check("explanation mentions bank or creditor", /bank|creditor|payable/i.test(result.explanation));
                    check("command proposed", result.commands.length > 0 && result.commands[0].commandType === "PostKhataEntry", (_c = result.commands[0]) === null || _c === void 0 ? void 0 : _c.commandType);
                    check("pending approval", result.commands.some(function (c) { return c.status === "pending"; }) ||
                        result.warnings.some(function (w) { return w.includes("approval"); }));
                    console.log("\n=== Explanation ===");
                    console.log(result.explanation.slice(0, 500));
                    (0, registry_1.clearMigrationFlagOverrides)();
                    console.log("\n=== Results: ".concat(passed, " passed, ").concat(failed, " failed ==="));
                    process.exit(failed > 0 ? 1 : 0);
                    return [2 /*return*/];
            }
        });
    });
}
run().catch(function (e) {
    console.error(e);
    process.exit(1);
});
