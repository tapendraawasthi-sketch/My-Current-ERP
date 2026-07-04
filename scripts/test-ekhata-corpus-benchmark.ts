/**
 * Expanded e-Khata corpus benchmark — stratified samples from 5190+ training set.
 * Run: npm run test:ekhata-corpus-benchmark
 */
import { readFileSync } from "fs";
import { join } from "path";
import { classifyDomain, shouldBlockWebSearch } from "../src/lib/ekhata/domainRouter";
import { parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import type { KhataIntent } from "../src/lib/ekhata/types";

const corpusPath = join(process.cwd(), "data/ekhata/lora-instruction-dataset.jsonl");
const domainPath = join(process.cwd(), "data/ekhata/domain-classifier-dataset.jsonl");

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

type LoraRow = { instruction: string; input: string; output: string };

function loadJsonl(path: string): LoraRow[] {
  return readFileSync(path, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LoraRow);
}

function stratifiedSample<T extends { intent?: KhataIntent }>(
  rows: Array<LoraRow & { intent?: KhataIntent }>,
  perIntent: number,
): LoraRow[] {
  const byIntent = new Map<string, LoraRow[]>();
  for (const row of rows) {
    const expected = JSON.parse(row.output) as { intent?: KhataIntent };
    const intent = expected.intent ?? "unknown";
    const bucket = byIntent.get(intent) ?? [];
    bucket.push(row);
    byIntent.set(intent, bucket);
  }

  const out: LoraRow[] = [];
  for (const [, bucket] of byIntent) {
    out.push(...bucket.slice(0, perIntent));
  }
  return out;
}

const corpus = loadJsonl(corpusPath);
const domainRows = loadJsonl(domainPath);

check("corpus has 5000+ examples", corpus.length >= 5000);

const entryRows = corpus.filter((r) => r.instruction.includes("parser"));
const qaRows = corpus.filter((r) => r.instruction.includes("CA assistant"));
const domainOnly = domainRows.length >= 500;

check("entry examples present", entryRows.length >= 1500);
check("Q&A examples present", qaRows.length >= 800);
check("domain classifier dataset present", domainOnly);

const entrySamples = stratifiedSample(
  entryRows.map((r) => {
    const expected = JSON.parse(r.output) as { intent: KhataIntent };
    return { ...r, intent: expected.intent };
  }),
  3,
);

let parseIntentOk = 0;
let parseAmountOk = 0;
const parseFailures: string[] = [];

for (const sample of entrySamples) {
  const expected = JSON.parse(sample.output) as { intent: KhataIntent; amount: number };
  const result = parseKhataMessage(sample.input);
  const intentMatch = result.card?.intent === expected.intent;
  const amountMatch = result.card?.amount === expected.amount;
  if (intentMatch) parseIntentOk += 1;
  if (intentMatch && amountMatch) parseAmountOk += 1;
  if (!intentMatch && parseFailures.length < 5) {
    parseFailures.push(`${sample.input.slice(0, 50)} → ${result.card?.intent ?? "null"} (want ${expected.intent})`);
  }
}

const intentRate = parseIntentOk / entrySamples.length;
const amountRate = parseAmountOk / entrySamples.length;

check(
  `parser intent ${parseIntentOk}/${entrySamples.length} (${(intentRate * 100).toFixed(1)}%)`,
  intentRate >= 0.88,
  parseFailures.join("; "),
);
check(
  `parser intent+amount ${parseAmountOk}/${entrySamples.length} (${(amountRate * 100).toFixed(1)}%)`,
  amountRate >= 0.82,
);

// Domain router on classifier samples
const domainSample = domainRows.slice(0, 120);
let domainOk = 0;
for (const row of domainSample) {
  const expected = JSON.parse(row.output) as { domain: string; blockWebSearch: boolean };
  const route = classifyDomain(row.input);
  if (route.domain === expected.domain && route.blockWebSearch === expected.blockWebSearch) {
    domainOk += 1;
  }
}
check(
  `domain router ${domainOk}/${domainSample.length}`,
  domainOk / domainSample.length >= 0.9,
);

// Accounting terms must block web
const blockCases = [
  "what is sampati",
  "provision k ho",
  "capital maintenance meaning",
  "udhaar k ho",
  "faithful representation k ho",
];
let blockOk = 0;
for (const q of blockCases) {
  if (shouldBlockWebSearch(q)) blockOk += 1;
}
check(`web block for accounting terms ${blockOk}/${blockCases.length}`, blockOk === blockCases.length);

// External facts should not block
check("web allowed for weather", !shouldBlockWebSearch("what is the weather today"));

console.log(`\nCorpus size: ${corpus.length} | Sampled entries: ${entrySamples.length}`);
console.log(`=== Corpus benchmark: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
