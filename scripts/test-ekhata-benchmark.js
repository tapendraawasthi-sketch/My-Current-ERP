"use strict";
var _a, _b, _c, _d, _e, _f, _g, _h, _j;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * e-Khata benchmark — key failures from audit doc (505 questions subset).
 * Run: npm run test:ekhata-benchmark
 */
var domainRouter_1 = require("../src/lib/ekhata/domainRouter");
var processMessage_1 = require("../src/lib/ekhata/processMessage");
var accountingLanguageBrain_1 = require("../src/lib/ekhata/accountingLanguageBrain");
var parseKhata_1 = require("../src/lib/ekhata/parseKhata");
var negationDetector_1 = require("../src/lib/ekhata/negationDetector");
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
// Domain gate — sampatti must not trigger web search
check("block web for sampati", (0, domainRouter_1.shouldBlockWebSearch)("what is sampati"));
check("block web for sampatti k ho", (0, domainRouter_1.shouldBlockWebSearch)("sampatti k ho?"));
check("allow web for weather", !(0, domainRouter_1.shouldBlockWebSearch)("what is the weather today"));
// Accounting Q&A — sampati definition
var sampati = (0, processMessage_1.processEKhataMessage)("what is sampati");
check("sampati routes to accounting not web", sampati.kind === "chat" &&
    (sampati.engine === "accounting-brain" || sampati.engine === "framework-brain") &&
    !sampati.reply.toLowerCase().includes("jatayu"), "engine=".concat(sampati.engine));
var sampatiNe = (0, accountingLanguageBrain_1.understandAccountingLanguage)("sampati k ho");
check("sampati k ho accounting answer", sampatiNe.kind === "answer" && /sampatti|asset|para|resource/i.test(sampatiNe.reply));
// Negation blocks entry
var neg = (0, negationDetector_1.detectNegation)("Ram le tiryena 500");
check("negation blocks entry", neg.blockEntry === true);
// Payment vs credit sale fix
var payIn = (0, parseKhata_1.parseKhataMessage)("Ram le 1500 diyo");
check("Ram le diyo = payment in not credit sale", ((_a = payIn.card) === null || _a === void 0 ? void 0 : _a.intent) === "khata_payment_in", "got ".concat((_b = payIn.card) === null || _b === void 0 ? void 0 : _b.intent));
var creditSale = (0, parseKhata_1.parseKhataMessage)("Gita lai 700 ko saman diye udhaar ma");
check("Gita lai udhaar = credit sale", ((_c = creditSale.card) === null || _c === void 0 ? void 0 : _c.intent) === "khata_credit_sale", "got ".concat((_d = creditSale.card) === null || _d === void 0 ? void 0 : _d.intent));
// New intents
var salesReturn = (0, parseKhata_1.parseKhataMessage)("sales return 1500");
check("sales return intent", ((_e = salesReturn.card) === null || _e === void 0 ? void 0 : _e.intent) === "khata_sales_return");
var commission = (0, parseKhata_1.parseKhataMessage)("commission aayo 8500");
check("commission income", ((_f = commission.card) === null || _f === void 0 ? void 0 : _f.intent) === "khata_commission_income");
var rent = (0, parseKhata_1.parseKhataMessage)("bhaada tiryo 9000");
check("rent expense", ((_g = rent.card) === null || _g === void 0 ? void 0 : _g.intent) === "khata_rent_expense");
// Framework in sync path
var fw = (0, processMessage_1.processEKhataMessage)("faithful representation k ho");
check("framework brain offline", fw.kind === "chat" && (fw.engine === "framework-brain" || fw.engine === "accounting-brain"), "engine=".concat(fw.engine));
// English credit sale paraphrase
var extended = (0, parseKhata_1.parseKhataMessage)("sold goods worth 800 to Deepak on credit");
check("English credit sale", ((_h = extended.card) === null || _h === void 0 ? void 0 : _h.intent) === "khata_credit_sale", "got ".concat((_j = extended.card) === null || _j === void 0 ? void 0 : _j.intent));
// Ledger-aware balance (audit A8)
var balanceSnap = { udhaarOut: 125000, udhaarIn: 45000 };
var receivableQ = (0, processMessage_1.processEKhataMessage)("total receivable kati", { balance: balanceSnap });
check("ledger receivable query uses balance", receivableQ.engine === "ca" && receivableQ.reply.includes("125,000"), "engine=".concat(receivableQ.engine));
var debtorsQ = (0, processMessage_1.processEKhataMessage)("what is my debtors balance", { balance: balanceSnap });
check("ledger debtors balance query", debtorsQ.engine === "ca" && debtorsQ.reply.includes("125,000"), "engine=".concat(debtorsQ.engine));
var payableQ = (0, processMessage_1.processEKhataMessage)("total payable kati", { balance: balanceSnap });
check("ledger payable query", payableQ.engine === "ca" && payableQ.reply.includes("45,000"), "engine=".concat(payableQ.engine));
console.log("\n=== Benchmark: ".concat(passed, " passed, ").concat(failed, " failed ==="));
process.exit(failed > 0 ? 1 : 0);
