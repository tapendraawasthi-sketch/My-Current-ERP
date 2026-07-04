/**
 * Validate generated training corpus size and sample parse accuracy.
 * Run: npm run validate:ekhata-corpus
 */
import { readFileSync } from "fs";
import { join } from "path";
import { parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import type { KhataIntent } from "../src/lib/ekhata/types";

const corpusPath = join(process.cwd(), "data/ekhata/lora-instruction-dataset.jsonl");
const lines = readFileSync(corpusPath, "utf-8").trim().split("\n").filter(Boolean);

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean) {
  if (ok) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}`);
  }
}

check("corpus has 5000+ examples", lines.length >= 5000);

// Sample 50 entry examples and verify parser matches
const entrySamples = lines
  .map((l) => JSON.parse(l) as { instruction: string; input: string; output: string })
  .filter((r) => r.instruction.includes("parser"))
  .slice(0, 50);

let parseOk = 0;
for (const sample of entrySamples) {
  const expected = JSON.parse(sample.output) as { intent: KhataIntent; amount: number };
  const result = parseKhataMessage(sample.input);
  if (result.card?.intent === expected.intent && result.card.amount === expected.amount) {
    parseOk++;
  }
}

check(`parser matches ${parseOk}/${entrySamples.length} sampled entries`, parseOk >= entrySamples.length * 0.85);

console.log(`\nCorpus: ${lines.length} examples`);
console.log(`=== Validation: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
