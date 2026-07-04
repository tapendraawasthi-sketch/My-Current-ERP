/**
 * e-Khata evaluation — TypeScript parser baseline on held-out test set.
 * Run: npm run test:ekhata-eval
 */
import { readFileSync } from "fs";
import { join } from "path";
import { classifyDomain } from "../src/lib/ekhata/domainRouter";
import { detectNegation } from "../src/lib/ekhata/negationDetector";
import { parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import type { KhataIntent } from "../src/lib/ekhata/types";

type ExpectedType = "entry" | "question" | "clarify" | "chat";

interface EvalCase {
  id: string;
  category: string;
  input: string;
  expected: {
    type: ExpectedType;
    intent?: KhataIntent;
    amount?: number;
    party?: string | null;
  };
}

interface EvalSet {
  cases: EvalCase[];
}

const QUESTION =
  /\b(k\s*ho|k\s*hun|ke\s*ho|kina|kasari|kati|kun|explain|define|bataau|bhannus|matlab|arth|what\s+is|how\s+to|which\s+is|record\s+garne|k\s+hunchha)\b|\?/i;

function isAccountingQuestion(text: string): boolean {
  return QUESTION.test(text);
}

function predictType(text: string): ExpectedType {
  if (isAccountingQuestion(text)) return "question";

  const negation = detectNegation(text);
  if (negation.blockEntry) return "clarify";

  const domain = classifyDomain(text);
  if (domain.domain === "journal_entry") {
    const parsed = parseKhataMessage(text);
    if (parsed.clarifying_question) return "clarify";
    if (parsed.card) return "entry";
  }

  if (/\b(hello|thanks|dhanyabad|namaste)\b/i.test(text)) return "chat";
  return "chat";
}

function partyMatch(expected: string | null | undefined, predicted: string | null | undefined): boolean {
  if (expected == null) return true;
  if (!predicted) return false;
  const e = expected.toLowerCase();
  const p = predicted.toLowerCase();
  return e.includes(p) || p.includes(e);
}

const evalPath = join(process.cwd(), "data/ekhata/eval-test-set.json");
const evalSet = JSON.parse(readFileSync(evalPath, "utf-8")) as EvalSet;

let passed = 0;
let failed = 0;
let intentTotal = 0;
let intentOk = 0;
let amountTotal = 0;
let amountOk = 0;
let partyTotal = 0;
let partyOk = 0;
let questionTotal = 0;
let questionOk = 0;
let falsePositiveTotal = 0;
let falsePositiveHits = 0;
const failures: string[] = [];

for (const c of evalSet.cases) {
  const predictedType = predictType(c.input);
  const expectedType = c.expected.type;
  let ok = false;

  if (expectedType === "entry") {
    intentTotal += 1;
    const parsed = parseKhataMessage(c.input);
    if (parsed.card) {
      const intentMatch = parsed.card.intent === c.expected.intent;
      if (intentMatch) intentOk += 1;

      let amountMatch = true;
      if (c.expected.amount != null) {
        amountTotal += 1;
        amountMatch = parsed.card.amount === c.expected.amount;
        if (amountMatch) amountOk += 1;
      }

      let partyM = true;
      if ("party" in c.expected) {
        partyTotal += 1;
        partyM = partyMatch(c.expected.party, parsed.card.party);
        if (partyM) partyOk += 1;
      }

      ok = intentMatch && amountMatch && partyM;
    }
  } else if (expectedType === "question") {
    questionTotal += 1;
    ok = predictedType === "question";
    if (ok) questionOk += 1;
  } else if (expectedType === "clarify") {
    ok = predictedType === "clarify" || predictedType === "chat";
  } else if (expectedType === "chat") {
    falsePositiveTotal += 1;
    const parsed = parseKhataMessage(c.input);
    ok = !parsed.card;
    if (parsed.card) falsePositiveHits += 1;
  } else {
    ok = predictedType === expectedType;
  }

  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${c.id}: expected=${expectedType} got=${predictedType} | ${c.input.slice(0, 50)}`);
  }
}

const intentAcc = intentTotal ? intentOk / intentTotal : 1;
const amountAcc = amountTotal ? amountOk / amountTotal : 1;
const partyAcc = partyTotal ? partyOk / partyTotal : 1;
const questionAcc = questionTotal ? questionOk / questionTotal : 1;
const fpRate = falsePositiveTotal ? falsePositiveHits / falsePositiveTotal : 0;

console.log("e-Khata Eval — typescript");
console.log(`Cases: ${evalSet.cases.length} | Passed: ${passed} | Failed: ${failed}`);
console.log();
console.log(`Intent accuracy:        ${(intentAcc * 100).toFixed(1)}%`);
console.log(`Amount accuracy:        ${(amountAcc * 100).toFixed(1)}%`);
console.log(`Party accuracy:         ${(partyAcc * 100).toFixed(1)}%`);
console.log(`Question gate accuracy: ${(questionAcc * 100).toFixed(1)}%`);
console.log(`False positive rate:    ${(fpRate * 100).toFixed(1)}%`);

if (failures.length > 0) {
  console.log("\nFailures (first 15):");
  for (const f of failures.slice(0, 15)) {
    console.log(`  - ${f}`);
  }
}

console.log(`\n=== Eval: ${passed} passed, ${failed} failed ===`);
process.exit(0);
