"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Accounting Language Brain tests
 * Run: npm run test:ekhata-brain
 */
var processMessage_1 = require("../src/lib/ekhata/processMessage");
var accountingLanguageBrain_1 = require("../src/lib/ekhata/accountingLanguageBrain");
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
check("detect English", (0, accountingLanguageBrain_1.detectUserLanguage)("What entry for bad debt write off?") === "english");
check("detect Nepali", (0, accountingLanguageBrain_1.detectUserLanguage)("bad debt ko entry k hunchha?") === "nepali");
var enEffect = (0, accountingLanguageBrain_1.understandAccountingLanguage)("What entry for bad debt write off?");
check("English entry effect", enEffect.kind === "answer" && enEffect.language === "english");
check("English mentions debit", enEffect.reply.toLowerCase().includes("debit") || enEffect.reply.includes("Dr"));
var neEffect = (0, accountingLanguageBrain_1.understandAccountingLanguage)("udhaar bikri ko entry k hunchha?");
check("Nepali entry effect", neEffect.kind === "answer" && neEffect.reply.length > 50);
var classify = (0, accountingLanguageBrain_1.understandAccountingLanguage)("Is debtors an asset or liability?");
check("classification question", classify.kind === "answer" && classify.reply.toLowerCase().includes("asset"));
var compare = (0, processMessage_1.processEKhataMessage)("difference between accrual and cash basis");
check("comparison accrual vs cash", compare.kind === "chat" && (compare.engine === "accounting-brain" || compare.engine === "framework-brain"));
var enChat = (0, processMessage_1.processEKhataMessage)("who are you?");
check("identity English", enChat.kind === "chat" && enChat.reply.toLowerCase().includes("e-khata"));
var stillEntry = (0, processMessage_1.processEKhataMessage)("salary accrual 500000");
check("entry still works", stillEntry.kind === "entry" && ((_a = stillEntry.card) === null || _a === void 0 ? void 0 : _a.intent) === "khata_salary_accrual");
var noTxError = (0, processMessage_1.processEKhataMessage)("khana khayeu?");
check("food not transaction error", noTxError.kind === "chat" && !noTxError.reply.includes("Ke transaction ho"));
console.log("\n=== Results: ".concat(passed, " passed, ").concat(failed, " failed ==="));
process.exit(failed > 0 ? 1 : 0);
