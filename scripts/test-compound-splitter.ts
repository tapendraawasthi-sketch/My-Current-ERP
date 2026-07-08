/**
 * Compound splitter + batch builder smoke tests.
 * Run: npx tsx scripts/test-compound-splitter.ts
 */
import { isCompoundMessage, splitCompoundTransactions } from "../src/lib/ekhata/compound";
import { buildCompoundBatch } from "../src/lib/ekhata/compoundBatch";
import { processEKhataMessage } from "../src/lib/ekhata/processMessage";

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

const daily = splitCompoundTransactions("aaja bikri 8500, rent 8000 tiryo");
check("split daily summary", daily.length === 2 && daily[0].includes("8500") && daily[1].includes("8000"));

const noSplit = splitCompoundTransactions("Ram lai saman becheko Rs 1,500 cash ma");
check("no split amount comma", noSplit.length === 1);

const raSplit = splitCompoundTransactions("Ram lai 5000 becheko ra electricity kharcha 2000");
check(
  "split ra conjunct",
  raSplit.length === 2 && raSplit[0].includes("5000") && raSplit[1].includes("2000"),
);

check(
  "is compound message",
  isCompoundMessage("aaja bikri 8500, rent 8000 tiryo") &&
    !isCompoundMessage("Ram lai 500 cash ma becheko"),
);

const batchPhrase = "aaja 8500 ko nagad bikri vayo, electricity kharcha 8000";
const built = buildCompoundBatch(batchPhrase);
check(
  "build compound batch",
  built.ok &&
    built.batch.compoundCount === 2 &&
    built.batch.parts[0].card.intent === "khata_cash_sale" &&
    built.batch.parts[1].card.intent === "khata_expense",
  built.ok ? undefined : built.reply,
);

const routed = processEKhataMessage(batchPhrase);
check(
  "process routes compound",
  routed.kind === "compound" && routed.batch.compoundCount === 2,
  routed.kind,
);

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
