/**
 * Nepal accounting knowledge brain tests.
 * Run: npm run test:ekhata-nepal-knowledge
 */
import { processEKhataMessage } from "../src/lib/ekhata/processMessage";
import { understandNepalAccountingKnowledge } from "../src/lib/ekhata/nepalAccountingKnowledgeBrain";

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

const vatReg = understandNepalAccountingKnowledge("VAT registration threshold Nepal ma kati ho");
check(
  "VAT registration threshold",
  vatReg.kind === "answer" && /50\s*lakh|5\s*million|50 lakh/i.test(vatReg.reply),
);

const provision = understandNepalAccountingKnowledge("provision ra accrual ma ke farak xa");
check(
  "provision vs accrual",
  provision.kind === "answer" && /provision|accrual|andaaja/i.test(provision.reply),
);

const nas37 = understandNepalAccountingKnowledge("NAS 37 k ho");
check("NAS 37", nas37.kind === "answer" && /NAS 37|provision|contingent/i.test(nas37.reply));

const tds = understandNepalAccountingKnowledge("TDS on rent urban area");
check("TDS rent", tds.kind === "answer" && /10%|rent|tds/i.test(tds.reply));

const corporate = understandNepalAccountingKnowledge("corporate tax rate Nepal");
check("corporate tax", corporate.kind === "answer" && /25%|corporate/i.test(corporate.reply));

const routed = processEKhataMessage("VAT exempt ra zero rated ma ke farak");
check(
  "processMessage routes Nepal KB",
  routed.kind === "chat" && routed.engine === "accounting-brain" && /exempt|zero/i.test(routed.reply),
  `engine=${routed.engine}`,
);

console.log(`\n=== Nepal knowledge: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
