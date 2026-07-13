"use strict";
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Conceptual Framework Brain tests — IFRS/NAS CA-level knowledge
 * Run: npm run test:ekhata-framework
 */
var processMessage_1 = require("../src/lib/ekhata/processMessage");
var conceptual_framework_knowledge_json_1 = require("../data/ekhata/conceptual-framework-knowledge.json");
var conceptualFrameworkBrain_1 = require("../src/lib/ekhata/conceptualFrameworkBrain");
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
// Framework query detection
check("detects English framework query", (0, conceptualFrameworkBrain_1.isFrameworkQuery)("What is the definition of an asset under IFRS?"));
check("detects Nepali framework query", (0, conceptualFrameworkBrain_1.isFrameworkQuery)("sampatti ko paribhasha k ho?"));
check("detects mixed query", (0, conceptualFrameworkBrain_1.isFrameworkQuery)("faithful representation ko matlab k ho?"));
check("rejects non-framework query", !(0, conceptualFrameworkBrain_1.isFrameworkQuery)("Ram lai 500 udhaar diye"));
// Intent classification
check("definition intent", (0, conceptualFrameworkBrain_1.classifyFrameworkIntent)("what is asset?") === "definition");
check("comparison intent", (0, conceptualFrameworkBrain_1.classifyFrameworkIntent)("difference between asset and liability") === "comparison");
check("recognition intent", (0, conceptualFrameworkBrain_1.classifyFrameworkIntent)("recognition criteria k ho?") === "recognition");
// English answers
var assetEn = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("What is the definition of an asset?");
check("English asset definition", assetEn.kind === "answer" && assetEn.reply.includes("4.3"));
check("English asset has economic resource", assetEn.reply.toLowerCase().includes("economic resource"));
var liabilityEn = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("Define liability under IFRS conceptual framework");
check("English liability definition", liabilityEn.kind === "answer" && liabilityEn.reply.includes("4.26"));
// Nepali answers — local words
var assetNe = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("sampatti ko paribhasha k ho?");
check("Nepali asset via sampatti", assetNe.kind === "answer" && assetNe.language === "nepali");
check("Nepali asset has Para 4.3", assetNe.reply.includes("4.3"));
var manyataNe = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("manyata ko maapdanda k ho?");
check("Nepali recognition criteria", manyataNe.kind === "answer" && manyataNe.confidence >= 0.55);
var biswasilo = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("biswasilo pratinidhitwo k ho?");
check("Nepali faithful representation", biswasilo.kind === "answer" && biswasilo.reply.includes("2."));
// Comparisons
var cmpAssetLiab = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("asset ra dayitwo ko farak k ho?");
check("Nepali asset vs liability comparison", cmpAssetLiab.kind === "answer" && cmpAssetLiab.intent === "comparison");
check("Comparison mentions both", cmpAssetLiab.reply.includes("Sampatti") && cmpAssetLiab.reply.includes("Dayitwo"));
var cmpFairHist = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("fair value vs historical cost difference");
check("Fair value vs historical cost", cmpFairHist.kind === "answer" && cmpFairHist.reply.includes("6."));
// Chapter overview
var ch4 = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("chapter 4 overview");
check("Chapter 4 overview", ch4.kind === "answer" && ch4.reply.includes("Chapter 4"));
// Paragraph lookup
var para43 = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("paragraph 4.3 ma k cha?");
check("Paragraph 4.3 lookup", para43.kind === "answer" && para43.reply.includes("4.3"));
// Integration via processMessage
var routed = (0, processMessage_1.processEKhataMessage)("going concern assumption k ho?");
check("processMessage routes framework", routed.kind === "chat" && routed.engine === "framework-brain");
// Entry still works (not hijacked by framework brain)
var entry = (0, processMessage_1.processEKhataMessage)("salary accrual 500000");
check("entry not blocked", entry.kind === "entry" && ((_a = entry.card) === null || _a === void 0 ? void 0 : _a.intent) === "khata_salary_accrual");
// Qualitative characteristics
var qual = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("qualitative characteristics of useful financial information");
check("qualitative characteristics", qual.kind === "answer" && qual.confidence >= 0.55);
// Measurement
var measure = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("fair value measurement k ho?");
check("fair value measurement", measure.kind === "answer" && measure.reply.includes("6."));
// Coverage completeness
var meta = conceptual_framework_knowledge_json_1.default.metadata;
check("100% paragraph coverage", ((_b = meta.coverage) === null || _b === void 0 ? void 0 : _b.coveragePercent) === 100);
check("has SP sections", meta.total_sp_paragraphs === 5);
check("has tables", meta.total_tables === 2);
check("has glossary", ((_c = meta.total_glossary_terms) !== null && _c !== void 0 ? _c : 0) >= 30);
check("has all 8 chapter full texts", meta.total_chapter_full_texts === 8);
// SP section
var sp = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("Is the conceptual framework a standard?");
check("SP section query", sp.kind === "answer" && (sp.reply.includes("SP1") || sp.reply.includes("not a Standard")));
// Glossary
var prudence = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("what is prudence in IFRS framework?");
check("glossary prudence", prudence.kind === "answer" && prudence.reply.toLowerCase().includes("prudence"));
// Table lookup
var table41 = (0, conceptualFrameworkBrain_1.understandConceptualFramework)("Table 4.1 elements of financial statements");
check("Table 4.1", table41.kind === "answer" && table41.reply.includes("Table 4.1"));
console.log("\n=== Framework Brain Results: ".concat(passed, " passed, ").concat(failed, " failed ==="));
process.exit(failed > 0 ? 1 : 0);
