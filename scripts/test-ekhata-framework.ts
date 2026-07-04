/**
 * Conceptual Framework Brain tests — IFRS/NAS CA-level knowledge
 * Run: npm run test:ekhata-framework
 */
import { processEKhataMessage } from "../src/lib/ekhata/processMessage";
import corpus from "../data/ekhata/conceptual-framework-knowledge.json";
import {
  understandConceptualFramework,
  isFrameworkQuery,
  classifyFrameworkIntent,
} from "../src/lib/ekhata/conceptualFrameworkBrain";

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

// Framework query detection
check("detects English framework query", isFrameworkQuery("What is the definition of an asset under IFRS?"));
check("detects Nepali framework query", isFrameworkQuery("sampatti ko paribhasha k ho?"));
check("detects mixed query", isFrameworkQuery("faithful representation ko matlab k ho?"));
check("rejects non-framework query", !isFrameworkQuery("Ram lai 500 udhaar diye"));

// Intent classification
check("definition intent", classifyFrameworkIntent("what is asset?") === "definition");
check("comparison intent", classifyFrameworkIntent("difference between asset and liability") === "comparison");
check("recognition intent", classifyFrameworkIntent("recognition criteria k ho?") === "recognition");

// English answers
const assetEn = understandConceptualFramework("What is the definition of an asset?");
check("English asset definition", assetEn.kind === "answer" && assetEn.reply.includes("4.3"));
check("English asset has economic resource", assetEn.reply.toLowerCase().includes("economic resource"));

const liabilityEn = understandConceptualFramework("Define liability under IFRS conceptual framework");
check("English liability definition", liabilityEn.kind === "answer" && liabilityEn.reply.includes("4.26"));

// Nepali answers — local words
const assetNe = understandConceptualFramework("sampatti ko paribhasha k ho?");
check("Nepali asset via sampatti", assetNe.kind === "answer" && assetNe.language === "nepali");
check("Nepali asset has Para 4.3", assetNe.reply.includes("4.3"));

const manyataNe = understandConceptualFramework("manyata ko maapdanda k ho?");
check("Nepali recognition criteria", manyataNe.kind === "answer" && manyataNe.confidence >= 0.55);

const biswasilo = understandConceptualFramework("biswasilo pratinidhitwo k ho?");
check("Nepali faithful representation", biswasilo.kind === "answer" && biswasilo.reply.includes("2."));

// Comparisons
const cmpAssetLiab = understandConceptualFramework("asset ra dayitwo ko farak k ho?");
check("Nepali asset vs liability comparison", cmpAssetLiab.kind === "answer" && cmpAssetLiab.intent === "comparison");
check("Comparison mentions both", cmpAssetLiab.reply.includes("Sampatti") && cmpAssetLiab.reply.includes("Dayitwo"));

const cmpFairHist = understandConceptualFramework("fair value vs historical cost difference");
check("Fair value vs historical cost", cmpFairHist.kind === "answer" && cmpFairHist.reply.includes("6."));

// Chapter overview
const ch4 = understandConceptualFramework("chapter 4 overview");
check("Chapter 4 overview", ch4.kind === "answer" && ch4.reply.includes("Chapter 4"));

// Paragraph lookup
const para43 = understandConceptualFramework("paragraph 4.3 ma k cha?");
check("Paragraph 4.3 lookup", para43.kind === "answer" && para43.reply.includes("4.3"));

// Integration via processMessage
const routed = processEKhataMessage("going concern assumption k ho?");
check("processMessage routes framework", routed.kind === "chat" && routed.engine === "framework-brain");

// Entry still works (not hijacked by framework brain)
const entry = processEKhataMessage("salary accrual 500000");
check("entry not blocked", entry.kind === "entry" && entry.card?.intent === "khata_salary_accrual");

// Qualitative characteristics
const qual = understandConceptualFramework("qualitative characteristics of useful financial information");
check("qualitative characteristics", qual.kind === "answer" && qual.confidence >= 0.55);

// Measurement
const measure = understandConceptualFramework("fair value measurement k ho?");
check("fair value measurement", measure.kind === "answer" && measure.reply.includes("6."));

// Coverage completeness
const meta = corpus.metadata;
check("100% paragraph coverage", meta.coverage?.coveragePercent === 100);
check("has SP sections", meta.total_sp_paragraphs === 5);
check("has tables", meta.total_tables === 2);
check("has glossary", (meta.total_glossary_terms ?? 0) >= 30);
check("has all 8 chapter full texts", meta.total_chapter_full_texts === 8);

// SP section
const sp = understandConceptualFramework("Is the conceptual framework a standard?");
check("SP section query", sp.kind === "answer" && (sp.reply.includes("SP1") || sp.reply.includes("not a Standard")));

// Glossary
const prudence = understandConceptualFramework("what is prudence in IFRS framework?");
check("glossary prudence", prudence.kind === "answer" && prudence.reply.toLowerCase().includes("prudence"));

// Table lookup
const table41 = understandConceptualFramework("Table 4.1 elements of financial statements");
check("Table 4.1", table41.kind === "answer" && table41.reply.includes("Table 4.1"));

console.log(`\n=== Framework Brain Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
