"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Generate 5000+ e-Khata training examples from seed corpus + CA templates.
 * Run: npm run generate:ekhata-corpus
 *
 * Outputs:
 *   data/ekhata/ca-training-corpus-generated.jsonl  — full structured examples
 *   data/ekhata/lora-instruction-dataset.jsonl      — Alpaca/LLaMA-Factory format
 *   data/ekhata/domain-classifier-dataset.jsonl       — domain routing labels
 */
var fs_1 = require("fs");
var path_1 = require("path");
var caEntryTemplates_1 = require("../src/lib/ekhata/caEntryTemplates");
var caEntryEngine_1 = require("../src/lib/ekhata/caEntryEngine");
var accountingLanguageBrain_1 = require("../src/lib/ekhata/accountingLanguageBrain");
var domainRouter_1 = require("../src/lib/ekhata/domainRouter");
var OUT_DIR = (0, path_1.join)(process.cwd(), "data/ekhata");
var PARTIES = [
    "Ram",
    "Shyam",
    "Gita",
    "Hari",
    "Binita",
    "Roshan",
    "Anand",
    "Kumari Co",
    "ABC Traders",
    "Nepal Suppliers",
];
var AMOUNTS = [200, 500, 750, 1000, 1500, 2000, 3500, 5000, 8500, 10000, 25000, 50000, 85000, 100000, 500000];
var ITEMS = ["saman", "chiya", "stationery", "mal", "goods", "inventory", "services"];
/** Paraphrase templates — {party}, {amount}, {item} placeholders */
var NARRATION_PATTERNS = {
    khata_credit_sale: [
        "{party} lai {amount} udhaar becheko",
        "{party} lai {amount} ko {item} udhaar ma diye",
        "sold {amount} on credit to {party}",
        "sold goods worth {amount} to {party} on account",
        "{party} lai {amount} udharo ma becheko",
        "credit sale {amount} {party}",
        "invoiced {party} for {amount} on credit",
        "extended {amount} worth of goods to {party} on tab",
    ],
    khata_cash_sale: [
        "aaja {amount} ko nagad bikri",
        "cash sale {amount}",
        "sold {amount} for cash",
        "nagad ma {amount} becheko",
        "{amount} ko bikri vayo cash ma",
        "received {amount} cash from sale",
    ],
    khata_payment_in: [
        "{party} le {amount} tiryo",
        "{party} le {amount} diyo",
        "payment received {amount} from {party}",
        "collected {amount} from {party}",
        "{party} bata {amount} aayo",
        "{party} le {amount} jama gareko",
    ],
    khata_payment_out: [
        "{party} lai {amount} payment gareko",
        "paid {amount} to {party}",
        "payment made {amount} supplier {party}",
        "{party} lai {amount} tirna diye",
    ],
    khata_purchase: [
        "{amount} ko saman kineko",
        "ram le {amount} ko saman kinyo",
        "cash purchase {amount}",
        "bought goods for {amount}",
        "kharid {amount} cash ma",
    ],
    khata_credit_purchase: [
        "{party} bata {amount} udhaar ma saman kineko",
        "credit purchase {amount} from {party}",
        "bought on account {amount} {party}",
        "{amount} ko saman udhaar ma kineko {party} bata",
    ],
    khata_expense: [
        "electricity kharcha {amount}",
        "expense {amount}",
        "kharcha {amount}",
        "rent expense {amount}",
        "paid {amount} for office supplies",
    ],
    khata_outstanding_expense: [
        "outstanding expense rent {amount}",
        "bill aayo {amount} tirna baki",
        "accrued expense {amount}",
        "baki kharcha {amount}",
    ],
    khata_bad_debt_writeoff: [
        "{party} ko {amount} bad debt write off",
        "write off {amount} irrecoverable from {party}",
        "bad debt writeoff {amount}",
        "{party} ko {amount} nasakne write off",
    ],
    khata_provision_bad_debt: [
        "provision for bad debt {amount}",
        "doubtful debt provision {amount}",
        "andaaja bad debt {amount}",
    ],
    khata_bad_debt_recovery: [
        "bad debt recovery {amount} from {party}",
        "recovered {amount} bad debt {party}",
    ],
    khata_salary_accrual: [
        "salary accrual {amount}",
        "talab provision {amount}",
        "month end salary {amount}",
        "accrued salary {amount}",
    ],
    khata_salary_payment: [
        "salary payment {amount}",
        "talab diyo {amount}",
        "paid salary {amount}",
    ],
    khata_ssf_employee: [
        "ssf employee {amount} gross salary",
        "employee ssf {amount}",
    ],
    khata_ssf_employer: [
        "ssf employer {amount} basic",
        "employer ssf {amount}",
    ],
    khata_gratuity_provision: [
        "gratuity provision {amount}",
        "gratuity accrual {amount}",
    ],
    khata_gratuity_payment: [
        "gratuity payment {amount}",
        "gratuity tiryo {amount}",
    ],
    khata_vat_sales: [
        "vat sale {amount}",
        "vat sanga becheko {amount}",
        "sales with vat {amount}",
    ],
    khata_vat_purchase: [
        "vat purchase {amount}",
        "input vat purchase {amount}",
    ],
    khata_vat_payment: [
        "vat payment {amount}",
        "vat tiryo {amount} IRD",
    ],
    khata_tds_deducted: [
        "tds deducted {amount}",
        "withholding tax {amount}",
    ],
    khata_tds_paid: [
        "tds paid {amount}",
        "tds remittance {amount}",
    ],
    khata_depreciation: [
        "depreciation {amount}",
        "mulya ghata {amount}",
    ],
    khata_bank_charges: [
        "bank charge {amount}",
        "bank fee {amount}",
    ],
    khata_other_income: [
        "interest received {amount}",
        "byaj aayo {amount}",
        "rent received {amount}",
    ],
    khata_capital_introduced: [
        "capital introduced {amount}",
        "puni lagaayo {amount}",
        "owner investment {amount}",
    ],
    khata_drawings: [
        "drawings {amount}",
        "nikasne {amount}",
    ],
    khata_loan_received: [
        "loan received {amount}",
        "rin liyo {amount}",
    ],
    khata_loan_repayment: [
        "loan repayment {amount}",
        "rin tiryo {amount}",
    ],
    khata_stock_purchase: [
        "stock purchase {amount}",
        "saman kineko {amount} stock",
        "inventory {amount}",
    ],
    khata_stock_sale_cogs: [
        "cogs {amount}",
        "cost of goods {amount}",
    ],
    khata_contra_cash_bank: [
        "contra cash to bank {amount}",
        "cash deposit {amount} bank ma jama",
        "transferred {amount} to bank",
    ],
    khata_sales_return: [
        "sales return {amount}",
        "saman firtayo {amount}",
        "credit note {amount}",
    ],
    khata_purchase_return: [
        "purchase return {amount}",
        "debit note {amount}",
    ],
    khata_customer_advance: [
        "customer advance {amount}",
        "advance received {amount}",
    ],
    khata_employee_advance: [
        "employee advance {amount}",
        "staff advance {amount}",
    ],
    khata_opening_balance: [
        "opening balance {amount}",
        "suruwati khata {amount}",
    ],
    khata_commission_income: [
        "commission aayo {amount}",
        "commission income {amount}",
    ],
    khata_rent_expense: [
        "bhaada tiryo {amount}",
        "rent paid {amount}",
    ],
    khata_prepaid_expense: [
        "prepaid expense {amount}",
        "advance rent {amount}",
    ],
    khata_discount_allowed: [
        "discount allowed {amount}",
        "chhut diye {amount}",
    ],
    khata_discount_received: [
        "discount received {amount}",
        "chhut paayo {amount}",
    ],
    khata_asset_disposal: [
        "sold asset {amount}",
        "asset disposal {amount}",
    ],
    khata_inventory_write_down: [
        "inventory write down {amount}",
        "stock adjustment {amount}",
    ],
};
var QA_PATTERNS = {
    definition_en: function (term, en) { return [
        "what is ".concat(term),
        "define ".concat(term),
        "explain ".concat(term, " in accounting"),
    ]; },
    definition_ne: function (term) { return [
        "".concat(term, " k ho"),
        "".concat(term, " ko arth k ho"),
        "".concat(term, " ke ho accounting ma"),
    ]; },
    entry_effect: function (term) { return [
        "what entry for ".concat(term),
        "".concat(term, " ko entry k hunchha"),
        "journal entry for ".concat(term),
    ]; },
    classification: function (term) { return [
        "is ".concat(term, " an asset or liability"),
        "".concat(term, " asset ho ki liability"),
        "classify ".concat(term),
    ]; },
};
function fill(pattern, party, amount, item) {
    return pattern
        .replace(/\{party\}/g, party)
        .replace(/\{amount\}/g, String(amount))
        .replace(/\{item\}/g, item);
}
function buildEntryOutput(intent, amount, party, narration) {
    var _a;
    var card = (0, caEntryEngine_1.generateCAEntry)(intent, {
        amount: amount,
        party: party,
        date: "2026-07-04",
        rawText: narration,
    }).card;
    return JSON.stringify({
        intent: card.intent,
        amount: card.amount,
        party: card.party,
        primaryClass: card.primaryClass,
        journalLines: (_a = card.journalLines) === null || _a === void 0 ? void 0 : _a.map(function (l) { return ({
            account: l.accountCode,
            name: l.accountName,
            debit: l.debit,
            credit: l.credit,
        }); }),
        explanation: card.caExplanation,
    }, null, 0);
}
function generateEntryExamples() {
    var _a;
    var out = [];
    var id = 0;
    for (var _i = 0, CA_ENTRY_TEMPLATES_1 = caEntryTemplates_1.CA_ENTRY_TEMPLATES; _i < CA_ENTRY_TEMPLATES_1.length; _i++) {
        var template = CA_ENTRY_TEMPLATES_1[_i];
        var patterns = (_a = NARRATION_PATTERNS[template.intent]) !== null && _a !== void 0 ? _a : ["".concat(template.intent, " {amount}")];
        var needsParty = [
            "khata_credit_sale",
            "khata_payment_in",
            "khata_payment_out",
            "khata_credit_purchase",
            "khata_bad_debt_writeoff",
            "khata_bad_debt_recovery",
            "khata_discount_allowed",
        ].includes(template.intent);
        for (var _b = 0, patterns_1 = patterns; _b < patterns_1.length; _b++) {
            var pattern = patterns_1[_b];
            for (var i = 0; i < 12; i++) {
                var party = needsParty ? PARTIES[(id + i) % PARTIES.length] : null;
                var amount = AMOUNTS[(id + i * 3) % AMOUNTS.length];
                var item = ITEMS[(id + i) % ITEMS.length];
                var narration = fill(pattern, party !== null && party !== void 0 ? party : "Ram", amount, item);
                // Language/style variants
                if (i % 3 === 1)
                    narration = narration.replace(/(\d+)/, "Rs $1");
                if (i % 3 === 2)
                    narration = "aaja ".concat(narration);
                try {
                    out.push({
                        id: "gen-entry-".concat(String(++id).padStart(5, "0")),
                        type: "entry",
                        narration: narration,
                        intent: template.intent,
                        amount: amount,
                        party: party,
                        output: buildEntryOutput(template.intent, amount, party, narration),
                    });
                }
                catch (_c) {
                    // skip unbalanced edge cases
                }
            }
        }
    }
    return out;
}
function generateQaExamples() {
    var _a, _b, _c;
    var out = [];
    var id = 0;
    for (var _i = 0, ACCOUNTING_LEXICON_1 = accountingLanguageBrain_1.ACCOUNTING_LEXICON; _i < ACCOUNTING_LEXICON_1.length; _i++) {
        var term = ACCOUNTING_LEXICON_1[_i];
        var concept = term.concept;
        var enTerms = term.en.slice(0, 2);
        var neTerms = term.ne.slice(0, 2);
        for (var _d = 0, enTerms_1 = enTerms; _d < enTerms_1.length; _d++) {
            var en = enTerms_1[_d];
            for (var _e = 0, _f = QA_PATTERNS.definition_en(en, en); _e < _f.length; _e++) {
                var q = _f[_e];
                out.push({
                    id: "gen-qa-".concat(String(++id).padStart(5, "0")),
                    type: "qa",
                    narration: q,
                    output: JSON.stringify({
                        concept: concept,
                        accountClass: term.accountClass,
                        intent: term.intent,
                        reply_en: "".concat(concept, ": ").concat((_a = term.accountClass) !== null && _a !== void 0 ? _a : "see CA guide", " \u2014 related to ").concat(en, ". In Nepal double-entry, classify per NAS/IFRS."),
                        reply_ne: "".concat(concept, " (").concat(en, ") \u2014 ").concat((_b = term.accountClass) !== null && _b !== void 0 ? _b : "khata", " shreni. Nepal ma double-entry anusar record garnu."),
                    }),
                });
            }
            for (var _g = 0, _h = QA_PATTERNS.entry_effect(en); _g < _h.length; _g++) {
                var q = _h[_g];
                if (!term.intent)
                    continue;
                out.push({
                    id: "gen-qa-".concat(String(++id).padStart(5, "0")),
                    type: "qa",
                    narration: q,
                    intent: term.intent,
                    output: JSON.stringify({
                        intent: term.intent,
                        explanation: "Use ".concat(term.intent, " template. Dr/Cr per Nepal CA practice."),
                    }),
                });
            }
        }
        for (var _j = 0, neTerms_1 = neTerms; _j < neTerms_1.length; _j++) {
            var ne = neTerms_1[_j];
            for (var _k = 0, _l = QA_PATTERNS.definition_ne(ne); _k < _l.length; _k++) {
                var q = _l[_k];
                out.push({
                    id: "gen-qa-".concat(String(++id).padStart(5, "0")),
                    type: "qa",
                    narration: q,
                    output: JSON.stringify({
                        concept: concept,
                        reply_ne: "".concat(ne, " = ").concat(concept, ". IFRS/NAS anusar ").concat((_c = term.accountClass) !== null && _c !== void 0 ? _c : "khata", " shreni."),
                    }),
                });
            }
        }
    }
    // Framework terms — expanded
    var frameworkQs = [
        { q: "faithful representation k ho", a: "Biswasilo pratinidhitwo — IFRS Ch 2. Financial info must be complete, neutral, free from error." },
        { q: "recognition criteria IFRS", a: "Para 5.1: meets element definition AND provides relevant + faithfully represented information." },
        { q: "going concern k ho", a: "Chalirakhne aadhar — entity will continue operations for foreseeable future." },
        { q: "accrual vs cash basis", a: "Accrual: record when earned/incurred. Cash: when money moves. Nepal IRD VAT uses accrual." },
        { q: "sampati k ho", a: "Sampatti = Asset (IFRS Para 4.3). Present economic resource controlled by entity." },
        { q: "what is sampati", a: "Sampatti (asset) — present economic resource controlled by the entity from past events (IFRS Para 4.3)." },
        { q: "what is sampatti", a: "Sampatti (सम्पत्ति) = Asset. Economic resource in your khata: cash, debtors, stock, fixed assets." },
        { q: "bank overdraft asset or liability", a: "Bank overdraft is a LIABILITY — you owe the bank." },
        { q: "provision vs accrual", a: "Accrual: known obligation. Provision: uncertain timing/amount (IAS 37)." },
        { q: "what is goodwill", a: "Goodwill is an intangible asset from business acquisition — not ordinary English goodwill." },
        { q: "what is provision", a: "Accounting provision = liability for uncertain amount (bad debts, warranty)." },
        { q: "what is depreciation", a: "Depreciation allocates fixed asset cost over useful life. Dr Depreciation Exp, Cr Acc Dep." },
        { q: "what is equity", a: "Equity (puni) = residual interest: Assets minus Liabilities." },
        { q: "what is liability", a: "Liability (dayitwo) = present obligation to transfer economic resource." },
        { q: "double entry k ho", a: "Har transaction ma Debit = Credit. Assets = Liabilities + Equity." },
        { q: "trial balance k ho", a: "Trial balance lists all ledger balances; total Dr must equal total Cr." },
        { q: "balance sheet k ho", a: "Assets = Liabilities + Equity at a point in time." },
        { q: "VAT Nepal kati percent", a: "Nepal ma standard VAT 13% ho." },
        { q: "SSF employee kati percent", a: "SSF employee contribution = 10% of basic salary." },
        { q: "SSF employer kati percent", a: "SSF employer contribution = 11% of basic salary." },
        { q: "TDS services Nepal", a: "TDS on professional services = 15% at source." },
        { q: "TDS rent Nepal", a: "TDS on rent = 10%." },
        { q: "receivable vs payable", a: "Receivable = they owe you (asset). Payable = you owe them (liability)." },
        { q: "income vs expense", a: "Income = revenue from operations. Expense = cost to earn revenue." },
        { q: "gain vs income", a: "Income = ordinary revenue. Gain = non-operating (e.g. asset sold above book value)." },
        { q: "nyaya mulya k ho", a: "Nyaya mulya = Fair value — price in orderly transaction between market participants." },
        { q: "manyata ko criteria", a: "Recognition: meets definition + relevant + faithfully represented (IFRS Para 5)." },
        { q: "sambandhitata accounting", a: "Sambandhitata = Relevance — info affects decisions of users." },
        { q: "fiscal year Nepal", a: "Nepal fiscal year: Shrawan 1 to Ashadh end (BS). VAT/ tax returns follow this." },
        { q: "sales return entry k ho", a: "Dr Sales/Sales Return, Cr Debtor/Cash — reverses revenue and receivable." },
        { q: "customer advance entry", a: "Dr Cash, Cr Customer Advance (liability until goods delivered)." },
    ];
    for (var _m = 0, frameworkQs_1 = frameworkQs; _m < frameworkQs_1.length; _m++) {
        var _o = frameworkQs_1[_m], q = _o.q, a = _o.a;
        out.push({
            id: "gen-qa-".concat(String(++id).padStart(5, "0")),
            type: "qa",
            narration: q,
            output: JSON.stringify({ reply: a }),
        });
        // Nepali phrasing variant
        if (/what is/i.test(q)) {
            var neQ = q.replace(/what is/i, "").trim() + " k ho";
            out.push({
                id: "gen-qa-".concat(String(++id).padStart(5, "0")),
                type: "qa",
                narration: neQ,
                output: JSON.stringify({ reply: a }),
            });
        }
    }
    // Entry-effect questions for every intent
    for (var _p = 0, CA_ENTRY_TEMPLATES_2 = caEntryTemplates_1.CA_ENTRY_TEMPLATES; _p < CA_ENTRY_TEMPLATES_2.length; _p++) {
        var template = CA_ENTRY_TEMPLATES_2[_p];
        var labels = __spreadArray([template.intent.replace("khata_", "")], template.keywords.slice(0, 2), true);
        for (var _q = 0, labels_1 = labels; _q < labels_1.length; _q++) {
            var label = labels_1[_q];
            for (var _r = 0, _s = ["what entry for ".concat(label), "".concat(label, " ko entry k hunchha"), "journal entry ".concat(label)]; _r < _s.length; _r++) {
                var q = _s[_r];
                out.push({
                    id: "gen-qa-".concat(String(++id).padStart(5, "0")),
                    type: "qa",
                    narration: q,
                    intent: template.intent,
                    output: JSON.stringify({
                        intent: template.intent,
                        explanation: template.explanation,
                        primaryClass: template.primaryClass,
                    }),
                });
            }
        }
    }
    return out;
}
function generateDomainExamples(entries, qas) {
    var out = [];
    var id = 0;
    for (var _i = 0, _a = __spreadArray(__spreadArray([], entries, true), qas, true); _i < _a.length; _i++) {
        var ex = _a[_i];
        var route = (0, domainRouter_1.classifyDomain)(ex.narration);
        out.push({
            id: "gen-dom-".concat(String(++id).padStart(5, "0")),
            type: "domain",
            narration: ex.narration,
            domain: route.domain,
            output: JSON.stringify({ domain: route.domain, blockWebSearch: route.blockWebSearch }),
        });
    }
    var external = [
        "what is the weather today",
        "who is the prime minister of Nepal",
        "population of Kathmandu",
        "latest news Nepal",
    ];
    for (var _b = 0, external_1 = external; _b < external_1.length; _b++) {
        var q = external_1[_b];
        var route = (0, domainRouter_1.classifyDomain)(q);
        out.push({
            id: "gen-dom-".concat(String(++id).padStart(5, "0")),
            type: "domain",
            narration: q,
            domain: route.domain,
            output: JSON.stringify({ domain: route.domain, blockWebSearch: route.blockWebSearch }),
        });
    }
    return out;
}
function loadUserFeedbackExamples() {
    var _a, _b, _c, _d;
    var path = (0, path_1.join)(OUT_DIR, "user-feedback.jsonl");
    if (!(0, fs_1.existsSync)(path))
        return [];
    var out = [];
    var id = 0;
    for (var _i = 0, _e = (0, fs_1.readFileSync)(path, "utf-8").trim().split("\n"); _i < _e.length; _i++) {
        var line = _e[_i];
        if (!line.trim())
            continue;
        try {
            var row = JSON.parse(line);
            if (row.label !== "confirmed" || !row.intent || !row.amount)
                continue;
            var narration = ((_b = (_a = row.correctedNarration) !== null && _a !== void 0 ? _a : row.narration) !== null && _b !== void 0 ? _b : "").trim();
            if (!narration)
                continue;
            out.push({
                id: "fb-".concat(String(++id).padStart(5, "0")),
                type: "entry",
                narration: narration,
                intent: row.intent,
                amount: row.amount,
                party: (_c = row.party) !== null && _c !== void 0 ? _c : null,
                output: JSON.stringify({
                    intent: row.intent,
                    amount: row.amount,
                    party: (_d = row.party) !== null && _d !== void 0 ? _d : null,
                    journalLines: row.journalLines,
                    source: "user_confirmed",
                }),
            });
        }
        catch (_f) {
            // skip malformed lines
        }
    }
    return out;
}
function toLoraInstruction(ex) {
    if (ex.type === "entry") {
        return {
            instruction: "You are e-Khata CA parser. Parse the Nepal accounting transaction to structured JSON with intent, amount, party, journalLines. Never invent amounts.",
            input: ex.narration,
            output: ex.output,
        };
    }
    if (ex.type === "qa") {
        return {
            instruction: "You are e-Khata CA assistant. Answer accounting questions for Nepal (NAS/IFRS, VAT 13%, SSF, TDS). Reply in user's language.",
            input: ex.narration,
            output: ex.output,
        };
    }
    return {
        instruction: "Classify user message domain for e-Khata router. Return JSON with domain and blockWebSearch.",
        input: ex.narration,
        output: ex.output,
    };
}
// Load seed examples
var seedPath = (0, path_1.join)(OUT_DIR, "ca-training-examples.json");
var seed = JSON.parse((0, fs_1.readFileSync)(seedPath, "utf-8"));
var seedGenerated = seed.examples.map(function (ex) {
    var _a, _b;
    return ({
        id: ex.id,
        type: "entry",
        narration: ex.narration,
        intent: ex.intent,
        amount: ex.amount,
        party: (_a = ex.party) !== null && _a !== void 0 ? _a : null,
        output: buildEntryOutput(ex.intent, ex.amount, (_b = ex.party) !== null && _b !== void 0 ? _b : null, ex.narration),
    });
});
var feedbackEntries = loadUserFeedbackExamples();
var entries = __spreadArray(__spreadArray(__spreadArray([], seedGenerated, true), generateEntryExamples(), true), feedbackEntries, true);
var qas = generateQaExamples();
var domains = generateDomainExamples(entries, qas);
var all = __spreadArray(__spreadArray(__spreadArray([], entries, true), qas, true), domains, true);
(0, fs_1.mkdirSync)(OUT_DIR, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.join)(OUT_DIR, "ca-training-corpus-generated.jsonl"), all.map(function (e) { return JSON.stringify(e); }).join("\n"));
(0, fs_1.writeFileSync)((0, path_1.join)(OUT_DIR, "lora-instruction-dataset.jsonl"), all.map(function (e) { return JSON.stringify(toLoraInstruction(e)); }).join("\n"));
(0, fs_1.writeFileSync)((0, path_1.join)(OUT_DIR, "domain-classifier-dataset.jsonl"), domains.map(function (e) { return JSON.stringify(toLoraInstruction(e)); }).join("\n"));
console.log("Generated ".concat(all.length, " training examples:"));
console.log("  Entry:   ".concat(entries.length, " (incl. ").concat(feedbackEntries.length, " user feedback)"));
console.log("  Q&A:     ".concat(qas.length));
console.log("  Domain:  ".concat(domains.length));
console.log("Written to ".concat(OUT_DIR, "/"));
