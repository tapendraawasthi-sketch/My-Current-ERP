/**
 * e-Khata Nepali language regression tests
 * Run: npm run test:ekhata
 */
import { normalizeNepaliText } from "../src/lib/ekhata/normalizeNepali";
import { processEKhataMessage } from "../src/lib/ekhata/processMessage";
import { parseKhataMessage } from "../src/lib/ekhata/parseKhata";
import { analyzeNepaliMessage, generateNepaliReply } from "../src/lib/ekhata/nepaliBrain";
import { analyzeQuestion, generateConversationalReply } from "../src/lib/ekhata/conversationalBrain";
import { detectEmotionalContext, isEmotionalMessage } from "../src/lib/ekhata/emotionalBrain";

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

check(
  "nagad bikri vayo spelling",
  normalizeNepaliText("aajha 200 ko nagad bikri gyo").includes("nagad bikri"),
);
check("udharo → udhaar", normalizeNepaliText("Ram lai udharo diye").includes("udhaar"));
check("nakad → nagad", normalizeNepaliText("nakad bikri").includes("nagad"));

const dev = parseKhataMessage("राम लाई ५०० उधार दिए");
check("Devanagari credit sale", dev.card?.intent === "khata_credit_sale" && dev.card.amount === 500);

const cash = parseKhataMessage("aaja 200 ko nagad bikri vayo");
check("cash sale nagad bikri", cash.card?.intent === "khata_cash_sale" && cash.card.amount === 200);

const food = processEKhataMessage("khana khayeu?");
check(
  "khana khayeu natural reply",
  food.kind === "chat" &&
    food.engine === "brain" &&
    !food.reply.includes("Ke transaction ho"),
);

const status = processEKhataMessage("k xa");
check("k xa status reply", status.kind === "chat" && status.engine === "brain");

const greet = processEKhataMessage("namaste");
check("namaste greeting", greet.kind === "chat" && greet.engine === "brain");

const help = processEKhataMessage("madat");
check("madat help", help.kind === "chat" && help.reply.includes("udhaar"));

const thanks = processEKhataMessage("dhanyabad");
check("thanks chat", thanks.kind === "chat" && thanks.engine === "brain");

const foodAnalysis = analyzeNepaliMessage("khana khayeu?");
check("detect food topic", foodAnalysis.topics.includes("food"));

const accounting = generateNepaliReply("what is VAT in Nepal?");
check(
  "accounting topic",
  accounting.toLowerCase().includes("vat") ||
    accounting.toLowerCase().includes("debit") ||
    accounting.includes("13%"),
);

const identity = generateNepaliReply("timi ko ho?");
check("identity reply", identity.includes("e-Khata"));

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

const mixed = processEKhataMessage("namaste Ram lai 500 udhaar diye");
check("mixed entry", mixed.kind === "entry" && mixed.card?.amount === 500);

const nepal = processEKhataMessage("Nepal ko culture ramro chha");
check("nepal topic", nepal.kind === "chat" && nepal.engine === "brain");

const genderQ = generateConversationalReply("timi kta ho");
check(
  "gender question not affirmation",
  genderQ.includes("AI") || genderQ.includes("manav hoina") || genderQ.includes("digital"),
  genderQ.slice(0, 80),
);

const movieQ = generateConversationalReply("favourite movie?");
check(
  "favourite movie opinion reply",
  movieQ.toLowerCase().includes("film") || movieQ.toLowerCase().includes("movie") || movieQ.includes("Kabaddi"),
  movieQ.slice(0, 80),
);

const whatDoYouDo = generateConversationalReply("what do you do");
check(
  "what do you do capability",
  whatDoYouDo.includes("Khata") || whatDoYouDo.includes("brain") || whatDoYouDo.includes("sakchhu"),
);

const genderAnalysis = analyzeQuestion("timi kta ho");
check("gender question kind", genderAnalysis.kind === "about_bot_gender");

const sadReply = generateConversationalReply("aaja ekdam dukhi feel bhairaheko chhu");
check(
  "sad emotion empathetic reply",
  sadReply.includes("bujhe") || sadReply.includes("dukhi") || sadReply.includes("eklo") ||
    sadReply.includes("sun") || sadReply.includes("yaha chhu") || sadReply.includes("naramro"),
  sadReply.slice(0, 100),
);

const angryCtx = detectEmotionalContext("yo system le kaam gardaina, ris aaayo");
check("detect angry emotion", angryCtx.primaryEmotion === "angry" || angryCtx.primaryEmotion === "frustrated");

const politeReply = generateConversationalReply("hajur namaste");
check("polite greeting", politeReply.toLowerCase().includes("namaste") || politeReply.includes("Hajur"));

check("isEmotionalMessage sad", isEmotionalMessage("dukhi chhu aaja"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
