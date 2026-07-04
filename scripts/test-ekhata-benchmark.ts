/**
 * e-Khata benchmark — key failures from audit doc (505 questions subset).
 * Run: npm run test:ekhata-benchmark
 */
import { shouldBlockWebSearch } from "../src/lib/ekhata/domainRouter";
import { processEKhataMessage } from "../src/lib/ekhata/processMessage";
import { understandAccountingLanguage } from "../src/lib/ekhata/accountingLanguageBrain";
import { parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import { detectNegation } from "../src/lib/ekhata/negationDetector";

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

// Domain gate — sampatti must not trigger web search
check("block web for sampati", shouldBlockWebSearch("what is sampati"));
check("block web for sampatti k ho", shouldBlockWebSearch("sampatti k ho?"));
check("allow web for weather", !shouldBlockWebSearch("what is the weather today"));

// Accounting Q&A — sampati definition
const sampati = processEKhataMessage("what is sampati");
check(
  "sampati routes to accounting not web",
  sampati.kind === "chat" &&
    (sampati.engine === "accounting-brain" || sampati.engine === "framework-brain") &&
    !sampati.reply.toLowerCase().includes("jatayu"),
  `engine=${sampati.engine}`,
);

const sampatiNe = understandAccountingLanguage("sampati k ho");
check(
  "sampati k ho accounting answer",
  sampatiNe.kind === "answer" && /sampatti|asset|para|resource/i.test(sampatiNe.reply),
);

// Negation blocks entry
const neg = detectNegation("Ram le tiryena 500");
check("negation blocks entry", neg.blockEntry === true);

// Payment vs credit sale fix
const payIn = parseKhataMessage("Ram le 1500 diyo");
check(
  "Ram le diyo = payment in not credit sale",
  payIn.card?.intent === "khata_payment_in",
  `got ${payIn.card?.intent}`,
);

const creditSale = parseKhataMessage("Gita lai 700 ko saman diye udhaar ma");
check(
  "Gita lai udhaar = credit sale",
  creditSale.card?.intent === "khata_credit_sale",
  `got ${creditSale.card?.intent}`,
);

// New intents
const salesReturn = parseKhataMessage("sales return 1500");
check("sales return intent", salesReturn.card?.intent === "khata_sales_return");

const commission = parseKhataMessage("commission aayo 8500");
check("commission income", commission.card?.intent === "khata_commission_income");

const rent = parseKhataMessage("bhaada tiryo 9000");
check("rent expense", rent.card?.intent === "khata_rent_expense");

// Framework in sync path
const fw = processEKhataMessage("faithful representation k ho");
check(
  "framework brain offline",
  fw.kind === "chat" && (fw.engine === "framework-brain" || fw.engine === "accounting-brain"),
  `engine=${fw.engine}`,
);

// English credit sale paraphrase
const extended = parseKhataMessage("sold goods worth 800 to Deepak on credit");
check(
  "English credit sale",
  extended.card?.intent === "khata_credit_sale",
  `got ${extended.card?.intent}`,
);

console.log(`\n=== Benchmark: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
