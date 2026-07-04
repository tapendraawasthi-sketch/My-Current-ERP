/**
 * TS vs Python parser parity on stratified corpus samples.
 * Run: npm run test:ekhata-python-parity
 */
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { classifyKhataIntent, parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import type { KhataIntent } from "../src/lib/ekhata/types";

const corpusPath = join(process.cwd(), "data/ekhata/lora-instruction-dataset.jsonl");

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

const rows = readFileSync(corpusPath, "utf-8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as LoraRow)
  .filter((r) => r.instruction.includes("parser"));

const byIntent = new Map<string, LoraRow[]>();
for (const row of rows) {
  const expected = JSON.parse(row.output) as { intent: KhataIntent };
  const bucket = byIntent.get(expected.intent) ?? [];
  bucket.push(row);
  byIntent.set(expected.intent, bucket);
}

const samples = [...byIntent.values()].flatMap((bucket) => bucket.slice(0, 2)).slice(0, 120);

const payload = {
  samples: samples.map((row) => {
    const expected = JSON.parse(row.output) as { intent: KhataIntent; amount: number };
    return { input: row.input, expected };
  }),
};

const py = spawnSync("python3", ["scripts/test-ekhata-python-parity.py"], {
  cwd: process.cwd(),
  input: JSON.stringify(payload),
  encoding: "utf-8",
});

if (py.status !== 0 || py.error) {
  console.error(py.stderr || py.error);
  process.exit(1);
}

const pyData = JSON.parse(py.stdout) as {
  results: Array<{
    input: string;
    expected_intent: KhataIntent;
    expected_amount: number;
    py_intent: string | null;
    py_amount: number | null;
  }>;
};

let tsIntentOk = 0;
let pyIntentOk = 0;
let crossOk = 0;
const mismatches: string[] = [];

for (const row of pyData.results) {
  const tsIntent = classifyKhataIntent(row.input);
  const pyIntent = row.py_intent ?? null;

  if (tsIntent === row.expected_intent) tsIntentOk += 1;
  if (pyIntent === row.expected_intent) pyIntentOk += 1;
  if (tsIntent === pyIntent) crossOk += 1;
  else if (mismatches.length < 5) {
    mismatches.push(`${row.input.slice(0, 40)} TS=${tsIntent} PY=${pyIntent}`);
  }
}

const n = pyData.results.length;
check(`TS intent match ${tsIntentOk}/${n}`, tsIntentOk / n >= 0.88);
check(`Python intent match ${pyIntentOk}/${n}`, pyIntentOk / n >= 0.88);
check(`TS/Python cross-match ${crossOk}/${n}`, crossOk / n >= 0.92, mismatches.join("; "));

console.log(`\n=== Parser parity: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
