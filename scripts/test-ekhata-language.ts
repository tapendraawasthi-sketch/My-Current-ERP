/**
 * e-Khata Nepali language regression tests
 * Run: npx tsx scripts/test-ekhata-language.ts
 */
import { normalizeNepaliText, transliterateDevanagari } from "../src/lib/ekhata/normalizeNepali";
import { processEKhataMessage } from "../src/lib/ekhata/processMessage";
import { parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import { analyzeNepaliMessage, generateNepaliReply } from "../src/lib/ekhata/nepaliBrain";

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

// Spelling normalization
check(
  "nagad bikri vayo spelling",
  normalizeNepaliText("aajha 200 ko nagad bikri gyo").includes("nagad bikri"),
);
check("udharo → udhaar", normalizeNepaliText("Ram lai udharo diye").includes("udhaar"));
check("nakad → nagad", normalizeNepaliText("nakad bikri").includes("nagad"));

// Devanagari inline script
const dev = parseKhataMessage("राम लाई ५०० उधार दिए");
check("Devanagari credit sale", dev.card?.intent === "khata_credit_sale" && dev.card.amount === 500);

// Entry parsing
const cash = parseKhataMessage("aaja 200 ko nagad bikri vayo");
check("cash sale nagad bikri", cash.card?.intent === "khata_cash_sale" && cash.card.amount === 200);

// Built-in Nepali brain — conversational (not transaction errors)
const food = processEKhataMessage("khana khayeu?");
check(
  "khana khayeu natural reply",
  food.kind === "chat" &&
    food.engine === "brain" &&
    (food.reply.toLowerCase().includes("khaye") || food.reply.toLowerCase().includes("khana")) &&
    !food.reply.includes("Ke transaction ho"),
);

const status = processEKhataMessage("k xa");
check("k xa status reply", status.kind === "chat" && status.engine === "brain" && !status.reply.includes("transaction ho"));

const greet = processEKhataMessage("namaste");
check("namaste greeting", greet.kind === "chat" && greet.engine === "brain");

const help = processEKhataMessage("madat");
check("madat help", help.kind === "chat" && help.reply.includes("udaharan"));

const thanks = processEKhataMessage("dhanyabad");
check("thanks chat", thanks.kind === "chat" && thanks.engine === "brain");

// Brain topic detection
const foodAnalysis = analyzeNepaliMessage("khana khayeu?");
check("detect food topic", foodAnalysis.topics.includes("food"));

// Credit sale without party asks for name
const noParty = processEKhataMessage("500 ko udaro becheko");
check(
  "credit sale no party clarify",
  noParty.kind === "clarify" && noParty.reply.includes("Kaslaai"),
);

const withParty = parseKhataMessage("Ram lai 500 udharo becheko");
check(
  "credit sale with party",
  withParty.card?.intent === "khata_credit_sale" && withParty.card.party === "Ram",
);

// Entry beats chat when transaction cues present
const mixed = processEKhataMessage("namaste Ram lai 500 udhaar diye");
check("mixed entry", mixed.kind === "entry" && mixed.card?.amount === 500);

// Identity question
const identity = generateNepaliReply("timi ko ho?");
check("identity reply", identity.includes("e-Khata"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
