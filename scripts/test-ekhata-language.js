"use strict";
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * e-Khata Nepali language regression tests
 * Run: npm run test:ekhata
 */
var normalizeNepali_1 = require("../src/lib/ekhata/normalizeNepali");
var processMessage_1 = require("../src/lib/ekhata/processMessage");
var parseKhata_1 = require("../src/lib/ekhata/parseKhata");
var nepaliBrain_1 = require("../src/lib/ekhata/nepaliBrain");
var conversationalBrain_1 = require("../src/lib/ekhata/conversationalBrain");
var emotionalBrain_1 = require("../src/lib/ekhata/emotionalBrain");
var autonomousBrain_1 = require("../src/lib/ekhata/autonomousBrain");
var passed = 0;
var failed = 0;
function check(name, ok, detail) {
    if (ok) {
        passed += 1;
        console.log("PASS ".concat(name));
    }
    else {
        failed += 1;
        console.log("FAIL ".concat(name).concat(detail ? ": ".concat(detail) : ""));
    }
}
check("nagad bikri vayo spelling", (0, normalizeNepali_1.normalizeNepaliText)("aajha 200 ko nagad bikri gyo").includes("nagad bikri"));
check("udharo → udhaar", (0, normalizeNepali_1.normalizeNepaliText)("Ram lai udharo diye").includes("udhaar"));
check("nakad → nagad", (0, normalizeNepali_1.normalizeNepaliText)("nakad bikri").includes("nagad"));
var dev = (0, parseKhata_1.parseKhataMessage)("राम लाई ५०० उधार दिए");
check("Devanagari credit sale", ((_a = dev.card) === null || _a === void 0 ? void 0 : _a.intent) === "khata_credit_sale" && dev.card.amount === 500);
var cash = (0, parseKhata_1.parseKhataMessage)("aaja 200 ko nagad bikri vayo");
check("cash sale nagad bikri", ((_b = cash.card) === null || _b === void 0 ? void 0 : _b.intent) === "khata_cash_sale" && cash.card.amount === 200);
var food = (0, processMessage_1.processEKhataMessage)("khana khayeu?");
check("khana khayeu natural reply", food.kind === "chat" && food.engine === "brain" && !food.reply.includes("Ke transaction ho"));
var status = (0, processMessage_1.processEKhataMessage)("k xa");
check("k xa status reply", status.kind === "chat" && status.engine === "brain");
var greet = (0, processMessage_1.processEKhataMessage)("namaste");
check("namaste greeting", greet.kind === "chat" && greet.engine === "brain");
var help = (0, processMessage_1.processEKhataMessage)("madat");
check("madat help", help.kind === "chat" && help.reply.includes("udhaar"));
var thanks = (0, processMessage_1.processEKhataMessage)("dhanyabad");
check("thanks chat", thanks.kind === "chat" && thanks.engine === "brain");
var foodAnalysis = (0, nepaliBrain_1.analyzeNepaliMessage)("khana khayeu?");
check("detect food topic", foodAnalysis.topics.includes("food"));
var accounting = (0, nepaliBrain_1.generateNepaliReply)("what is VAT in Nepal?");
check("accounting topic", accounting.toLowerCase().includes("vat") ||
    accounting.toLowerCase().includes("debit") ||
    accounting.includes("13%"));
var identity = (0, nepaliBrain_1.generateNepaliReply)("timi ko ho?");
check("identity reply", identity.includes("e-Khata"));
var noParty = (0, processMessage_1.processEKhataMessage)("500 ko udaro becheko");
check("credit sale no party clarify", noParty.kind === "clarify" && noParty.reply.includes("Kaslaai"));
var withParty = (0, parseKhata_1.parseKhataMessage)("Ram lai 500 udharo becheko");
check("credit sale with party", ((_c = withParty.card) === null || _c === void 0 ? void 0 : _c.intent) === "khata_credit_sale" && withParty.card.party === "Ram");
var mixed = (0, processMessage_1.processEKhataMessage)("namaste Ram lai 500 udhaar diye");
check("mixed entry", mixed.kind === "entry" && ((_d = mixed.card) === null || _d === void 0 ? void 0 : _d.amount) === 500);
var nepal = (0, processMessage_1.processEKhataMessage)("Nepal ko culture ramro chha");
check("nepal topic", nepal.kind === "chat" && nepal.engine === "brain");
var genderQ = (0, conversationalBrain_1.generateConversationalReply)("timi kta ho");
check("gender question not affirmation", genderQ.includes("AI") || genderQ.includes("manav hoina") || genderQ.includes("digital"), genderQ.slice(0, 80));
var movieQ = (0, conversationalBrain_1.generateConversationalReply)("favourite movie?");
check("favourite movie opinion reply", movieQ.toLowerCase().includes("film") ||
    movieQ.toLowerCase().includes("movie") ||
    movieQ.includes("Kabaddi"), movieQ.slice(0, 80));
var whatDoYouDo = (0, conversationalBrain_1.generateConversationalReply)("what do you do");
check("what do you do capability", whatDoYouDo.includes("Khata") || whatDoYouDo.includes("brain") || whatDoYouDo.includes("sakchhu"));
var genderAnalysis = (0, conversationalBrain_1.analyzeQuestion)("timi kta ho");
check("gender question kind", genderAnalysis.kind === "about_bot_gender");
var sadReply = (0, conversationalBrain_1.generateConversationalReply)("aaja ekdam dukhi feel bhairaheko chhu");
check("sad emotion empathetic reply", sadReply.includes("bujhe") ||
    sadReply.includes("dukhi") ||
    sadReply.includes("eklo") ||
    sadReply.includes("sun") ||
    sadReply.includes("yaha chhu") ||
    sadReply.includes("naramro") ||
    sadReply.includes("saathi") ||
    sadReply.includes("kura garau"), sadReply.slice(0, 100));
var angryCtx = (0, emotionalBrain_1.detectEmotionalContext)("yo system le kaam gardaina, ris aaayo");
check("detect angry emotion", angryCtx.primaryEmotion === "angry" || angryCtx.primaryEmotion === "frustrated");
var politeReply = (0, conversationalBrain_1.generateConversationalReply)("hajur namaste");
check("polite greeting", politeReply.toLowerCase().includes("namaste") || politeReply.includes("Hajur"));
check("isEmotionalMessage sad", (0, emotionalBrain_1.isEmotionalMessage)("dukhi chhu aaja"));
var cupsSale = (0, processMessage_1.processEKhataMessage)("i sold 200 cups today for Rs. 50 each");
check("english qty x rate sale", cupsSale.kind === "entry" &&
    ((_e = cupsSale.card) === null || _e === void 0 ? void 0 : _e.intent) === "khata_cash_sale" &&
    cupsSale.card.amount === 10000);
var paymentIn = (0, processMessage_1.processEKhataMessage)("received payment 3000 from Ram");
check("english payment received", paymentIn.kind === "entry" &&
    ((_f = paymentIn.card) === null || _f === void 0 ? void 0 : _f.intent) === "khata_payment_in" &&
    paymentIn.card.amount === 3000);
var bought = (0, processMessage_1.processEKhataMessage)("bought stationery for 1200");
check("english purchase", bought.kind === "entry" &&
    ((_g = bought.card) === null || _g === void 0 ? void 0 : _g.intent) === "khata_purchase" &&
    bought.card.amount === 1200);
var momoLike = (0, conversationalBrain_1.generateConversationalReply)("do you like momo");
check("do you like momo conversational", momoLike.toLowerCase().includes("momo") || momoLike.toLowerCase().includes("khana"));
var onlineQ = await (0, autonomousBrain_1.askAutonomousBrain)("k ma ahile online du", { llmOnline: false });
check("online status meta question", onlineQ.reply.includes("online") && !onlineQ.reply.includes("Kaha ko barema"), onlineQ.reply.slice(0, 80));
var pmQ = await (0, autonomousBrain_1.askAutonomousBrain)("who is pm of nepal", { llmOnline: false });
check("who is pm of nepal web search", pmQ.searchedWeb && pmQ.engine === "web-search" && (pmQ.reply.includes("Prime Minister") || pmQ.reply.includes("Balendra") || pmQ.reply.includes("serving")), pmQ.reply.slice(0, 120));
console.log("\n".concat(passed, " passed, ").concat(failed, " failed"));
process.exit(failed > 0 ? 1 : 0);
