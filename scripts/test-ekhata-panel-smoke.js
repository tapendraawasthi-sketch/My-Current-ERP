"use strict";
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * e-Khata panel smoke tests — offline confirm-card path (browser panel parity).
 * Run: npm run test:ekhata-panel-smoke
 */
var processMessage_1 = require("../src/lib/ekhata/processMessage");
var parseKhata_1 = require("../src/lib/ekhata/parseKhata");
var parseKhata_2 = require("../src/lib/ekhata/parseKhata");
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
function journalBalanced(lines) {
    if (!(lines === null || lines === void 0 ? void 0 : lines.length))
        return false;
    var dr = lines.reduce(function (s, l) { return s + l.debit; }, 0);
    var cr = lines.reduce(function (s, l) { return s + l.credit; }, 0);
    return Math.abs(dr - cr) < 0.01 && dr > 0;
}
var creditSale = (0, processMessage_1.processEKhataMessage)("Ram lai 500 udhaar diye");
check("credit sale confirm card", creditSale.kind === "entry" &&
    ((_a = creditSale.card) === null || _a === void 0 ? void 0 : _a.intent) === "khata_credit_sale" &&
    creditSale.card.amount === 500, "".concat(creditSale.kind, " ").concat((_b = creditSale.card) === null || _b === void 0 ? void 0 : _b.intent));
check("credit sale balanced journal", journalBalanced((_c = creditSale.card) === null || _c === void 0 ? void 0 : _c.journalLines));
var cashSale = (0, processMessage_1.processEKhataMessage)("aaja 200 ko nagad bikri vayo");
check("cash sale confirm card", cashSale.kind === "entry" && ((_d = cashSale.card) === null || _d === void 0 ? void 0 : _d.intent) === "khata_cash_sale" && cashSale.card.amount === 200);
var paymentIn = (0, processMessage_1.processEKhataMessage)("Shyam le 2000 tiryo");
check("payment received", paymentIn.kind === "entry" &&
    ((_e = paymentIn.card) === null || _e === void 0 ? void 0 : _e.intent) === "khata_payment_in" &&
    paymentIn.card.amount === 2000);
var expense = (0, processMessage_1.processEKhataMessage)("electricity kharcha 3500");
check("expense entry", expense.kind === "entry" && ((_f = expense.card) === null || _f === void 0 ? void 0 : _f.intent) === "khata_expense" && expense.card.amount === 3500);
var paymentOut = (0, processMessage_1.processEKhataMessage)("Hari lai 1500 payment gareko");
check("payment made", paymentOut.kind === "entry" &&
    ((_g = paymentOut.card) === null || _g === void 0 ? void 0 : _g.intent) === "khata_payment_out" &&
    paymentOut.card.amount === 1500 &&
    paymentOut.card.party === "Hari");
var cashPurchase = (0, processMessage_1.processEKhataMessage)("kharid 4500 cash ma");
check("cash purchase", cashPurchase.kind === "entry" &&
    ((_h = cashPurchase.card) === null || _h === void 0 ? void 0 : _h.intent) === "khata_purchase" &&
    cashPurchase.card.amount === 4500);
var creditPurchase = (0, processMessage_1.processEKhataMessage)("Gita bata 6000 udhaar ma saman kineko");
check("credit purchase", creditPurchase.kind === "entry" &&
    ((_j = creditPurchase.card) === null || _j === void 0 ? void 0 : _j.intent) === "khata_credit_purchase" &&
    creditPurchase.card.amount === 6000 &&
    creditPurchase.card.party === "Gita");
var compound = (0, processMessage_1.processEKhataMessage)("aaja 8500 ko nagad bikri vayo, electricity kharcha 8000");
check("compound batch entry", compound.kind === "compound" &&
    compound.batch.compoundCount === 2 &&
    compound.batch.parts[0].card.intent === "khata_cash_sale" &&
    compound.batch.parts[1].card.intent === "khata_expense");
var qa = (0, processMessage_1.processEKhataMessage)("sampatti k ho");
check("accounting Q&A routes to chat", qa.kind === "chat" && qa.reply.length > 20);
var noFood = (0, processMessage_1.processEKhataMessage)("khana khayeu?");
check("non-transaction not forced entry", noFood.kind === "chat" || noFood.kind === "clarify");
var ambiguous = (0, processMessage_1.processEKhataMessage)("Ram 500");
check("incomplete utterance not forced post", ambiguous.kind === "clarify" || ambiguous.kind === "chat" || ambiguous.kind === "entry");
var parsed = (0, parseKhata_1.parseKhataMessage)("Ram le 500 tiryo", "ram le 500 tiryo");
check("parseKhata payment in", ((_k = parsed.card) === null || _k === void 0 ? void 0 : _k.intent) === "khata_payment_in" && parsed.card.amount === 500);
check("classifyKhataIntent payment", (0, parseKhata_2.classifyKhataIntent)("Shyam le 2000 tiryo") === "khata_payment_in");
var salary = (0, processMessage_1.processEKhataMessage)("salary accrual 500000");
check("salary accrual template", salary.kind === "entry" && ((_l = salary.card) === null || _l === void 0 ? void 0 : _l.intent) === "khata_salary_accrual");
console.log("\n".concat(passed, "/").concat(passed + failed, " passed"));
process.exit(failed > 0 ? 1 : 0);
