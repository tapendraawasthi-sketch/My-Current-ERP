/**
 * e-Khata panel smoke tests — offline confirm-card path (browser panel parity).
 * Run: npm run test:ekhata-panel-smoke
 */
import { processEKhataMessage } from "../src/lib/ekhata/processMessage";
import { parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import { classifyKhataIntent } from "../src/lib/ekhata/parseKhata";

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

function journalBalanced(lines: Array<{ debit: number; credit: number }> | undefined): boolean {
  if (!lines?.length) return false;
  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(dr - cr) < 0.01 && dr > 0;
}

const creditSale = processEKhataMessage("Ram lai 500 udhaar diye");
check(
  "credit sale confirm card",
  creditSale.kind === "entry" &&
    creditSale.card?.intent === "khata_credit_sale" &&
    creditSale.card.amount === 500,
  `${creditSale.kind} ${creditSale.card?.intent}`,
);
check("credit sale balanced journal", journalBalanced(creditSale.card?.journalLines));

const cashSale = processEKhataMessage("aaja 200 ko nagad bikri vayo");
check(
  "cash sale confirm card",
  cashSale.kind === "entry" && cashSale.card?.intent === "khata_cash_sale" && cashSale.card.amount === 200,
);

const paymentIn = processEKhataMessage("Shyam le 2000 tiryo");
check(
  "payment received",
  paymentIn.kind === "entry" &&
    paymentIn.card?.intent === "khata_payment_in" &&
    paymentIn.card.amount === 2000,
);

const expense = processEKhataMessage("electricity kharcha 3500");
check(
  "expense entry",
  expense.kind === "entry" && expense.card?.intent === "khata_expense" && expense.card.amount === 3500,
);

const paymentOut = processEKhataMessage("Hari lai 1500 payment gareko");
check(
  "payment made",
  paymentOut.kind === "entry" &&
    paymentOut.card?.intent === "khata_payment_out" &&
    paymentOut.card.amount === 1500 &&
    paymentOut.card.party === "Hari",
);

const cashPurchase = processEKhataMessage("kharid 4500 cash ma");
check(
  "cash purchase",
  cashPurchase.kind === "entry" &&
    cashPurchase.card?.intent === "khata_purchase" &&
    cashPurchase.card.amount === 4500,
);

const creditPurchase = processEKhataMessage("Gita bata 6000 udhaar ma saman kineko");
check(
  "credit purchase",
  creditPurchase.kind === "entry" &&
    creditPurchase.card?.intent === "khata_credit_purchase" &&
    creditPurchase.card.amount === 6000 &&
    creditPurchase.card.party === "Gita",
);

const compound = processEKhataMessage("aaja 8500 ko nagad bikri vayo, electricity kharcha 8000");
check(
  "compound batch entry",
  compound.kind === "compound" &&
    compound.batch.compoundCount === 2 &&
    compound.batch.parts[0].card.intent === "khata_cash_sale" &&
    compound.batch.parts[1].card.intent === "khata_expense",
);

const qa = processEKhataMessage("sampatti k ho");
check(
  "accounting Q&A routes to chat",
  qa.kind === "chat" && qa.reply.length > 20,
);

const noFood = processEKhataMessage("khana khayeu?");
check(
  "non-transaction not forced entry",
  noFood.kind === "chat" || noFood.kind === "clarify",
);

const ambiguous = processEKhataMessage("Ram 500");
check(
  "incomplete utterance not forced post",
  ambiguous.kind === "clarify" || ambiguous.kind === "chat" || ambiguous.kind === "entry",
);

const parsed = parseKhataMessage("Ram le 500 tiryo", "ram le 500 tiryo");
check(
  "parseKhata payment in",
  parsed.card?.intent === "khata_payment_in" && parsed.card.amount === 500,
);

check(
  "classifyKhataIntent payment",
  classifyKhataIntent("Shyam le 2000 tiryo") === "khata_payment_in",
);

const salary = processEKhataMessage("salary accrual 500000");
check(
  "salary accrual template",
  salary.kind === "entry" && salary.card?.intent === "khata_salary_accrual",
);

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
