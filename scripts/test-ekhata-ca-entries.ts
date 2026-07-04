/**
 * CA-level e-Khata entry classifier evaluation
 * Run: npm run test:ekhata-ca
 */
import { readFileSync } from "fs";
import { join } from "path";
import { parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import { validateJournalBalance } from "../src/lib/ekhata/caEntryTemplates";
import type { KhataIntent } from "../src/lib/ekhata/types";

interface TrainingExample {
  id: string;
  narration: string;
  intent: KhataIntent;
  amount: number;
  party?: string;
  primary_class?: string;
  lines: Array<{ account: string; debit: number; credit: number }>;
}

interface TrainingCorpus {
  examples: TrainingExample[];
}

const corpusPath = join(process.cwd(), "data/ekhata/ca-training-examples.json");
const corpus: TrainingCorpus = JSON.parse(readFileSync(corpusPath, "utf-8"));

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    const msg = `FAIL ${name}${detail ? `: ${detail}` : ""}`;
    console.log(msg);
    failures.push(msg);
  }
}

console.log(`\n=== e-Khata CA Entry Evaluator ===`);
console.log(`Testing ${corpus.examples.length} training examples\n`);

for (const ex of corpus.examples) {
  const result = parseKhataMessage(ex.narration);
  const card = result.card;

  check(
    `${ex.id} intent: ${ex.narration.slice(0, 40)}`,
    card?.intent === ex.intent,
    `expected ${ex.intent}, got ${card?.intent ?? "none"}`,
  );

  if (card) {
    check(
      `${ex.id} amount`,
      card.amount === ex.amount,
      `expected ${ex.amount}, got ${card.amount}`,
    );

    const balance = validateJournalBalance(card.journalLines ?? []);
    check(`${ex.id} balanced`, balance.balanced, `Dr ${balance.totalDebit} Cr ${balance.totalCredit}`);

    if (ex.lines.length > 0 && card.journalLines) {
      const linesMatch = ex.lines.every((expected, i) => {
        const actual = card.journalLines![i];
        if (!actual) return false;
        return (
          actual.accountCode === expected.account &&
          actual.debit === expected.debit &&
          actual.credit === expected.credit
        );
      });
      check(
        `${ex.id} journal lines`,
        linesMatch && card.journalLines.length === ex.lines.length,
        `line count or amounts mismatch`,
      );
    }

    if (ex.party) {
      check(
        `${ex.id} party`,
        card.party?.toLowerCase() === ex.party.toLowerCase(),
        `expected ${ex.party}, got ${card.party}`,
      );
    }
  }
}

// Backward compatibility checks
const legacyCash = parseKhataMessage("aaja 200 ko nagad bikri vayo");
check("legacy cash sale", legacyCash.card?.intent === "khata_cash_sale");

const legacyCredit = parseKhataMessage("Ram lai 500 udharo becheko");
check("legacy credit sale", legacyCredit.card?.intent === "khata_credit_sale");

const ssfEmp = parseKhataMessage("ssf employee 50000 gross salary");
check("SSF employee intent", ssfEmp.card?.intent === "khata_ssf_employee");

const badDebt = parseKhataMessage("Ram ko 3000 bad debt write off");
check("bad debt writeoff", badDebt.card?.intent === "khata_bad_debt_writeoff");

const gratuity = parseKhataMessage("gratuity provision 25000");
check("gratuity provision", gratuity.card?.intent === "khata_gratuity_provision");

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failures.length > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
