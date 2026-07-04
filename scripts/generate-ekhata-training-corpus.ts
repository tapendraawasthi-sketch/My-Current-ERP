/**
 * Generate 5000+ e-Khata training examples from seed corpus + CA templates.
 * Run: npm run generate:ekhata-corpus
 *
 * Outputs:
 *   data/ekhata/ca-training-corpus-generated.jsonl  — full structured examples
 *   data/ekhata/lora-instruction-dataset.jsonl      — Alpaca/LLaMA-Factory format
 *   data/ekhata/domain-classifier-dataset.jsonl       — domain routing labels
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { CA_ENTRY_TEMPLATES } from "../src/lib/ekhata/caEntryTemplates";
import { generateCAEntry } from "../src/lib/ekhata/caEntryEngine";
import { ACCOUNTING_LEXICON } from "../src/lib/ekhata/accountingLanguageBrain";
import { classifyDomain } from "../src/lib/ekhata/domainRouter";
import type { KhataIntent } from "../src/lib/ekhata/types";

const OUT_DIR = join(process.cwd(), "data/ekhata");

const PARTIES = [
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

const AMOUNTS = [200, 500, 750, 1000, 1500, 2000, 3500, 5000, 8500, 10000, 25000, 50000, 85000, 100000, 500000];

const ITEMS = ["saman", "chiya", "stationery", "mal", "goods", "inventory", "services"];

/** Paraphrase templates — {party}, {amount}, {item} placeholders */
const NARRATION_PATTERNS: Partial<Record<KhataIntent, string[]>> = {
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

const QA_PATTERNS = {
  definition_en: (term: string, en: string) => [
    `what is ${term}`,
    `define ${term}`,
    `explain ${term} in accounting`,
  ],
  definition_ne: (term: string) => [
    `${term} k ho`,
    `${term} ko arth k ho`,
    `${term} ke ho accounting ma`,
  ],
  entry_effect: (term: string) => [
    `what entry for ${term}`,
    `${term} ko entry k hunchha`,
    `journal entry for ${term}`,
  ],
  classification: (term: string) => [
    `is ${term} an asset or liability`,
    `${term} asset ho ki liability`,
    `classify ${term}`,
  ],
};

interface GeneratedExample {
  id: string;
  type: "entry" | "qa" | "domain";
  narration: string;
  intent?: KhataIntent;
  amount?: number;
  party?: string | null;
  output: string;
  domain?: string;
}

function fill(pattern: string, party: string, amount: number, item: string): string {
  return pattern
    .replace(/\{party\}/g, party)
    .replace(/\{amount\}/g, String(amount))
    .replace(/\{item\}/g, item);
}

function buildEntryOutput(intent: KhataIntent, amount: number, party: string | null, narration: string): string {
  const { card } = generateCAEntry(intent, {
    amount,
    party,
    date: "2026-07-04",
    rawText: narration,
  });
  return JSON.stringify(
    {
      intent: card.intent,
      amount: card.amount,
      party: card.party,
      primaryClass: card.primaryClass,
      journalLines: card.journalLines?.map((l) => ({
        account: l.accountCode,
        name: l.accountName,
        debit: l.debit,
        credit: l.credit,
      })),
      explanation: card.caExplanation,
    },
    null,
    0,
  );
}

function generateEntryExamples(): GeneratedExample[] {
  const out: GeneratedExample[] = [];
  let id = 0;

  for (const template of CA_ENTRY_TEMPLATES) {
    const patterns = NARRATION_PATTERNS[template.intent] ?? [`${template.intent} {amount}`];
    const needsParty = [
      "khata_credit_sale",
      "khata_payment_in",
      "khata_payment_out",
      "khata_credit_purchase",
      "khata_bad_debt_writeoff",
      "khata_bad_debt_recovery",
      "khata_discount_allowed",
    ].includes(template.intent);

    for (const pattern of patterns) {
      for (let i = 0; i < 12; i++) {
        const party = needsParty ? PARTIES[(id + i) % PARTIES.length] : null;
        const amount = AMOUNTS[(id + i * 3) % AMOUNTS.length];
        const item = ITEMS[(id + i) % ITEMS.length];
        let narration = fill(pattern, party ?? "Ram", amount, item);

        // Language/style variants
        if (i % 3 === 1) narration = narration.replace(/(\d+)/, "Rs $1");
        if (i % 3 === 2) narration = `aaja ${narration}`;

        try {
          out.push({
            id: `gen-entry-${String(++id).padStart(5, "0")}`,
            type: "entry",
            narration,
            intent: template.intent,
            amount,
            party,
            output: buildEntryOutput(template.intent, amount, party, narration),
          });
        } catch {
          // skip unbalanced edge cases
        }
      }
    }
  }

  return out;
}

function generateQaExamples(): GeneratedExample[] {
  const out: GeneratedExample[] = [];
  let id = 0;

  for (const term of ACCOUNTING_LEXICON) {
    const concept = term.concept;
    const enTerms = term.en.slice(0, 2);
    const neTerms = term.ne.slice(0, 2);

    for (const en of enTerms) {
      for (const q of QA_PATTERNS.definition_en(en, en)) {
        out.push({
          id: `gen-qa-${String(++id).padStart(5, "0")}`,
          type: "qa",
          narration: q,
          output: JSON.stringify({
            concept,
            accountClass: term.accountClass,
            intent: term.intent,
            reply_en: `${concept}: ${term.accountClass ?? "see CA guide"} — related to ${en}. In Nepal double-entry, classify per NAS/IFRS.`,
            reply_ne: `${concept} (${en}) — ${term.accountClass ?? "khata"} shreni. Nepal ma double-entry anusar record garnu.`,
          }),
        });
      }
      for (const q of QA_PATTERNS.entry_effect(en)) {
        if (!term.intent) continue;
        out.push({
          id: `gen-qa-${String(++id).padStart(5, "0")}`,
          type: "qa",
          narration: q,
          intent: term.intent,
          output: JSON.stringify({
            intent: term.intent,
            explanation: `Use ${term.intent} template. Dr/Cr per Nepal CA practice.`,
          }),
        });
      }
    }

    for (const ne of neTerms) {
      for (const q of QA_PATTERNS.definition_ne(ne)) {
        out.push({
          id: `gen-qa-${String(++id).padStart(5, "0")}`,
          type: "qa",
          narration: q,
          output: JSON.stringify({
            concept,
            reply_ne: `${ne} = ${concept}. IFRS/NAS anusar ${term.accountClass ?? "khata"} shreni.`,
          }),
        });
      }
    }
  }

  // Framework terms — expanded
  const frameworkQs = [
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

  for (const { q, a } of frameworkQs) {
    out.push({
      id: `gen-qa-${String(++id).padStart(5, "0")}`,
      type: "qa",
      narration: q,
      output: JSON.stringify({ reply: a }),
    });
    // Nepali phrasing variant
    if (/what is/i.test(q)) {
      const neQ = q.replace(/what is/i, "").trim() + " k ho";
      out.push({
        id: `gen-qa-${String(++id).padStart(5, "0")}`,
        type: "qa",
        narration: neQ,
        output: JSON.stringify({ reply: a }),
      });
    }
  }

  // Entry-effect questions for every intent
  for (const template of CA_ENTRY_TEMPLATES) {
    const labels = [template.intent.replace("khata_", ""), ...template.keywords.slice(0, 2)];
    for (const label of labels) {
      for (const q of [`what entry for ${label}`, `${label} ko entry k hunchha`, `journal entry ${label}`]) {
        out.push({
          id: `gen-qa-${String(++id).padStart(5, "0")}`,
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

function generateDomainExamples(entries: GeneratedExample[], qas: GeneratedExample[]): GeneratedExample[] {
  const out: GeneratedExample[] = [];
  let id = 0;

  for (const ex of [...entries, ...qas]) {
    const route = classifyDomain(ex.narration);
    out.push({
      id: `gen-dom-${String(++id).padStart(5, "0")}`,
      type: "domain",
      narration: ex.narration,
      domain: route.domain,
      output: JSON.stringify({ domain: route.domain, blockWebSearch: route.blockWebSearch }),
    });
  }

  const external = [
    "what is the weather today",
    "who is the prime minister of Nepal",
    "population of Kathmandu",
    "latest news Nepal",
  ];
  for (const q of external) {
    const route = classifyDomain(q);
    out.push({
      id: `gen-dom-${String(++id).padStart(5, "0")}`,
      type: "domain",
      narration: q,
      domain: route.domain,
      output: JSON.stringify({ domain: route.domain, blockWebSearch: route.blockWebSearch }),
    });
  }

  return out;
}

function loadUserFeedbackExamples(): GeneratedExample[] {
  const path = join(OUT_DIR, "user-feedback.jsonl");
  if (!existsSync(path)) return [];

  const out: GeneratedExample[] = [];
  let id = 0;

  for (const line of readFileSync(path, "utf-8").trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as {
        label?: string;
        narration?: string;
        correctedNarration?: string;
        intent?: KhataIntent;
        amount?: number;
        party?: string | null;
        journalLines?: Array<{ account: string; debit: number; credit: number }>;
      };
      if (row.label !== "confirmed" || !row.intent || !row.amount) continue;

      const narration = (row.correctedNarration ?? row.narration ?? "").trim();
      if (!narration) continue;

      out.push({
        id: `fb-${String(++id).padStart(5, "0")}`,
        type: "entry",
        narration,
        intent: row.intent,
        amount: row.amount,
        party: row.party ?? null,
        output: JSON.stringify({
          intent: row.intent,
          amount: row.amount,
          party: row.party ?? null,
          journalLines: row.journalLines,
          source: "user_confirmed",
        }),
      });
    } catch {
      // skip malformed lines
    }
  }

  return out;
}

function toLoraInstruction(ex: GeneratedExample): Record<string, string> {
  if (ex.type === "entry") {
    return {
      instruction:
        "You are e-Khata CA parser. Parse the Nepal accounting transaction to structured JSON with intent, amount, party, journalLines. Never invent amounts.",
      input: ex.narration,
      output: ex.output,
    };
  }
  if (ex.type === "qa") {
    return {
      instruction:
        "You are e-Khata CA assistant. Answer accounting questions for Nepal (NAS/IFRS, VAT 13%, SSF, TDS). Reply in user's language.",
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
const seedPath = join(OUT_DIR, "ca-training-examples.json");
const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as { examples: Array<{ id: string; narration: string; intent: KhataIntent; amount: number; party?: string }> };

const seedGenerated: GeneratedExample[] = seed.examples.map((ex) => ({
  id: ex.id,
  type: "entry" as const,
  narration: ex.narration,
  intent: ex.intent,
  amount: ex.amount,
  party: ex.party ?? null,
  output: buildEntryOutput(ex.intent, ex.amount, ex.party ?? null, ex.narration),
}));

const feedbackEntries = loadUserFeedbackExamples();
const entries = [...seedGenerated, ...generateEntryExamples(), ...feedbackEntries];
const qas = generateQaExamples();
const domains = generateDomainExamples(entries, qas);
const all = [...entries, ...qas, ...domains];

mkdirSync(OUT_DIR, { recursive: true });

writeFileSync(
  join(OUT_DIR, "ca-training-corpus-generated.jsonl"),
  all.map((e) => JSON.stringify(e)).join("\n"),
);

writeFileSync(
  join(OUT_DIR, "lora-instruction-dataset.jsonl"),
  all.map((e) => JSON.stringify(toLoraInstruction(e))).join("\n"),
);

writeFileSync(
  join(OUT_DIR, "domain-classifier-dataset.jsonl"),
  domains.map((e) => JSON.stringify(toLoraInstruction(e))).join("\n"),
);

console.log(`Generated ${all.length} training examples:`);
console.log(`  Entry:   ${entries.length} (incl. ${feedbackEntries.length} user feedback)`);
console.log(`  Q&A:     ${qas.length}`);
console.log(`  Domain:  ${domains.length}`);
console.log(`Written to ${OUT_DIR}/`);
