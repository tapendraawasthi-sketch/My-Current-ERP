/**
 * Accounting Language Brain tests
 * Run: npm run test:ekhata-brain
 */
import { processEKhataMessage } from "../src/lib/ekhata/processMessage";
import {
  detectUserLanguage,
  understandAccountingLanguage,
} from "../src/lib/ekhata/accountingLanguageBrain";

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

check("detect English", detectUserLanguage("What entry for bad debt write off?") === "english");
check("detect Nepali", detectUserLanguage("bad debt ko entry k hunchha?") === "nepali");

const enEffect = understandAccountingLanguage("What entry for bad debt write off?");
check("English entry effect", enEffect.kind === "answer" && enEffect.language === "english");
check("English mentions debit", enEffect.reply.toLowerCase().includes("debit") || enEffect.reply.includes("Dr"));

const neEffect = understandAccountingLanguage("udhaar bikri ko entry k hunchha?");
check("Nepali entry effect", neEffect.kind === "answer" && neEffect.reply.length > 50);

const classify = understandAccountingLanguage("Is debtors an asset or liability?");
check("classification question", classify.kind === "answer" && classify.reply.toLowerCase().includes("asset"));

const compare = processEKhataMessage("difference between accrual and cash basis");
check("comparison accrual vs cash", compare.kind === "chat" && compare.engine === "accounting-brain");

const enChat = processEKhataMessage("who are you?");
check("identity English", enChat.kind === "chat" && enChat.reply.toLowerCase().includes("e-khata"));

const stillEntry = processEKhataMessage("salary accrual 500000");
check("entry still works", stillEntry.kind === "entry" && stillEntry.card?.intent === "khata_salary_accrual");

const noTxError = processEKhataMessage("khana khayeu?");
check("food not transaction error", noTxError.kind === "chat" && !noTxError.reply.includes("Ke transaction ho"));

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
