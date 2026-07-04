/**
 * Parse IFRS Conceptual Framework for Financial Reporting (2018) into structured
 * CA knowledge corpus for e-Khata semantic brain.
 *
 * Run: node scripts/build-conceptual-framework-knowledge.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE = join(ROOT, "data/ekhata/source/conceptual-framework-for-financial-reporting.txt");
const OUTPUT = join(ROOT, "data/ekhata/conceptual-framework-knowledge.json");

const CHAPTER_TITLES = {
  1: "The Objective of General Purpose Financial Reporting",
  2: "Qualitative Characteristics of Useful Financial Information",
  3: "Financial Statements and the Reporting Entity",
  4: "The Elements of Financial Statements",
  5: "Recognition and Derecognition",
  6: "Measurement",
  7: "Presentation and Disclosure",
  8: "Concepts of Capital and Capital Maintenance",
};

/** Core IFRS concepts with bilingual aliases for semantic matching */
const CONCEPTS = [
  {
    id: "objective_financial_reporting",
    en: ["objective", "general purpose financial reporting", "financial reporting objective", "purpose of financial statements"],
    ne: ["udeshya", "financial reporting ko udeshya", "lekha ko lakshya", "hisab patra ko udeshya"],
    chapter: 1,
    paragraphs: ["1.1", "1.2", "1.3", "1.4", "1.5"],
  },
  {
    id: "economic_resources",
    en: ["economic resource", "economic resources", "resources", "claims"],
    ne: ["arthik sampatti", "sampatti", "arthik adhikar", "dayitwo"],
    chapter: 1,
    paragraphs: ["1.12", "1.13", "1.14"],
  },
  {
    id: "accrual_accounting",
    en: ["accrual accounting", "accrual basis", "accrual", "matching principle"],
    ne: ["prapti aadhar", "accrual", "accrual hisab", "prapti hisab"],
    chapter: 1,
    paragraphs: ["1.17", "1.18", "1.19"],
  },
  {
    id: "cash_flows",
    en: ["cash flows", "past cash flows", "cash basis", "cash receipts and payments"],
    ne: ["nagad prabah", "cash flow", "nagad aadhar", "nagad hisab"],
    chapter: 1,
    paragraphs: ["1.20"],
  },
  {
    id: "stewardship",
    en: ["stewardship", "management responsibility", "governing board", "use of resources"],
    ne: ["byabasthapan jimma", "sampatti ko upayog", "prabandh jimma"],
    chapter: 1,
    paragraphs: ["1.22", "1.23"],
  },
  {
    id: "relevance",
    en: ["relevance", "relevant information", "predictive value", "confirmatory value"],
    ne: ["sambandhitata", "sambandhit", "predictive value", "confirmatory"],
    chapter: 2,
    paragraphs: ["2.6", "2.7", "2.8", "2.9", "2.10"],
  },
  {
    id: "faithful_representation",
    en: ["faithful representation", "faithfully represented", "complete", "neutral", "free from error"],
    ne: ["biswasilo pratinidhitwo", "satya pratinidhitwo", "purna", "netral", "truti rahit"],
    chapter: 2,
    paragraphs: ["2.11", "2.12", "2.13", "2.14", "2.15", "2.16"],
  },
  {
    id: "comparability",
    en: ["comparability", "comparable", "consistency", "verifiability", "timeliness", "understandability"],
    ne: ["tulaniyogya", "tulan", "samanta", "pramanik", "samayama", "bujhna sajilo"],
    chapter: 2,
    paragraphs: ["2.23", "2.24", "2.25", "2.26", "2.27", "2.28", "2.29", "2.30", "2.31", "2.32", "2.33", "2.34", "2.35", "2.36", "2.37", "2.38"],
  },
  {
    id: "materiality",
    en: ["materiality", "material", "immaterial", "material information"],
    ne: ["mahatwo", "mahatwpoorna", "sulabh", "material"],
    chapter: 2,
    paragraphs: ["2.29", "2.30", "2.31"],
  },
  {
    id: "cost_constraint",
    en: ["cost constraint", "cost benefit", "cost of providing information"],
    ne: ["lagat seema", "lagat faida", "jankari ko lagat"],
    chapter: 2,
    paragraphs: ["2.39", "2.40", "2.41", "2.42", "2.43", "2.44", "2.45", "2.46"],
  },
  {
    id: "going_concern",
    en: ["going concern", "continuing entity", "liquidation", "cease trading"],
    ne: ["chalirakhne aadhar", "going concern", "band hune", "byapar band"],
    chapter: 3,
    paragraphs: ["3.9", "3.10"],
  },
  {
    id: "reporting_entity",
    en: ["reporting entity", "consolidated", "unconsolidated", "parent", "subsidiary"],
    ne: ["reporting entity", "sanghik", "asanghik", "putra company", "santati company"],
    chapter: 3,
    paragraphs: ["3.10", "3.11", "3.12", "3.13", "3.14", "3.15"],
  },
  {
    id: "financial_statements",
    en: ["financial statements", "financial position", "financial performance", "reporting period"],
    ne: ["arthik patra", "financial statement", "arthik sthiti", "prativedhan avadhi"],
    chapter: 3,
    paragraphs: ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"],
  },
  {
    id: "asset",
    en: ["asset", "assets", "definition of asset", "economic resource controlled"],
    ne: ["sampatti", "asset", "asset ko paribhasha", "sampatti k ho"],
    chapter: 4,
    paragraphs: ["4.3", "4.4", "4.5"],
  },
  {
    id: "asset_right",
    en: ["right", "contractual right", "legal right", "property right"],
    ne: ["adhikar", "samjhauta adhikar", "kanuni adhikar"],
    chapter: 4,
    paragraphs: ["4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12", "4.13"],
  },
  {
    id: "asset_control",
    en: ["control", "controlled by entity", "control of asset"],
    ne: ["niyantran", "niyantran ma", "sampatti ko niyantran"],
    chapter: 4,
    paragraphs: ["4.19", "4.20", "4.21", "4.22", "4.23", "4.24", "4.25"],
  },
  {
    id: "asset_economic_benefits",
    en: ["potential to produce economic benefits", "economic benefits", "future economic benefits"],
    ne: ["arthik faida", "bhavishya faida", "faida ko samarthan"],
    chapter: 4,
    paragraphs: ["4.14", "4.15", "4.16", "4.17", "4.18"],
  },
  {
    id: "liability",
    en: ["liability", "liabilities", "definition of liability", "present obligation"],
    ne: ["dayitwo", "rin", "liability", "liability ko paribhasha", "bartaman dayitwo"],
    chapter: 4,
    paragraphs: ["4.26", "4.27"],
  },
  {
    id: "liability_obligation",
    en: ["obligation", "present obligation", "legal obligation", "constructive obligation"],
    ne: ["dayitwo", "bartaman dayitwo", "kanuni dayitwo", "nirmit dayitwo"],
    chapter: 4,
    paragraphs: ["4.28", "4.29", "4.30", "4.31", "4.32", "4.33", "4.34", "4.35"],
  },
  {
    id: "liability_transfer",
    en: ["transfer of economic resource", "transfer resource", "settle obligation"],
    ne: ["sampatti transfer", "sampatti handover", "dayitwo muktila"],
    chapter: 4,
    paragraphs: ["4.36", "4.37", "4.38", "4.39", "4.40", "4.41"],
  },
  {
    id: "liability_past_event",
    en: ["past events", "result of past events", "past event obligation"],
    ne: ["biyetka ghatna", "agad ko ghatna", "purano ghatna"],
    chapter: 4,
    paragraphs: ["4.42", "4.43", "4.44", "4.45", "4.46", "4.47"],
  },
  {
    id: "unit_of_account",
    en: ["unit of account", "grouping rights", "separate asset", "single asset"],
    ne: ["lekh ko ekai", "adhikar samuha", "ek sampatti"],
    chapter: 4,
    paragraphs: ["4.48", "4.49", "4.50", "4.51", "4.52", "4.53", "4.54", "4.55"],
  },
  {
    id: "executory_contract",
    en: ["executory contract", "mutual unperformed obligations", "unperformed contract"],
    ne: ["executory samjhauta", "baki dayitwo", "anpurna samjhauta"],
    chapter: 4,
    paragraphs: ["4.56", "4.57", "4.58"],
  },
  {
    id: "substance_over_form",
    en: ["substance", "contractual rights", "contractual obligations", "substance over form"],
    ne: ["tatwo", "samjhauta adhikar", "samjhauta dayitwo", "rup bhanda tatwo"],
    chapter: 4,
    paragraphs: ["4.59", "4.60", "4.61", "4.62"],
  },
  {
    id: "equity",
    en: ["equity", "residual interest", "definition of equity", "equity claims"],
    ne: ["puni", "equity", "baki hissa", "equity ko paribhasha"],
    chapter: 4,
    paragraphs: ["4.63", "4.64", "4.65", "4.66", "4.67"],
  },
  {
    id: "income",
    en: ["income", "revenue", "definition of income", "increases in assets"],
    ne: ["aamdani", "income", "aamdani ko paribhasha", "sampatti badhne"],
    chapter: 4,
    paragraphs: ["4.68", "4.69", "4.70", "4.71", "4.72"],
  },
  {
    id: "expense",
    en: ["expense", "expenses", "definition of expense", "decreases in assets"],
    ne: ["kharcha", "expense", "kharcha ko paribhasha", "sampatti ghataune"],
    chapter: 4,
    paragraphs: ["4.73", "4.74", "4.75", "4.76", "4.77"],
  },
  {
    id: "recognition",
    en: ["recognition", "recognise", "recognize", "recognition criteria", "recognition process"],
    ne: ["manyata", "swikar", "recognition", "manyata ko maapdanda"],
    chapter: 5,
    paragraphs: ["5.1", "5.2", "5.3", "5.4", "5.5"],
  },
  {
    id: "recognition_relevance",
    en: ["recognition relevance", "relevant information recognition"],
    ne: ["manyata sambandhitata", "sambandhit jankari manyata"],
    chapter: 5,
    paragraphs: ["5.6", "5.7", "5.8", "5.9", "5.10", "5.11"],
  },
  {
    id: "recognition_faithful",
    en: ["recognition faithful representation", "faithful representation recognition"],
    ne: ["manyata biswasilo pratinidhitwo"],
    chapter: 5,
    paragraphs: ["5.12", "5.13", "5.14", "5.15", "5.16", "5.17"],
  },
  {
    id: "derecognition",
    en: ["derecognition", "derecognise", "derecognize", "remove from balance sheet"],
    ne: ["manyata radda", "derecognition", "patra bata hataune"],
    chapter: 5,
    paragraphs: ["5.18", "5.19", "5.20", "5.21", "5.22", "5.23", "5.24", "5.25"],
  },
  {
    id: "measurement",
    en: ["measurement", "measure", "measurement basis", "measurement techniques"],
    ne: ["mulyankan", "measurement", "mulya nirdharan", "mulyankan aadhar"],
    chapter: 6,
    paragraphs: ["6.1", "6.2", "6.3"],
  },
  {
    id: "historical_cost",
    en: ["historical cost", "cost", "original cost", "historical cost basis"],
    ne: ["purano mulya", "aitihasik mulya", "historical cost", "lagat aadhar"],
    chapter: 6,
    paragraphs: ["6.4", "6.5", "6.6", "6.7", "6.8", "6.9"],
  },
  {
    id: "fair_value",
    en: ["fair value", "current market value", "fair value measurement"],
    ne: ["nyaya mulya", "fair value", "bajar mulya", "hali ko mulya"],
    chapter: 6,
    paragraphs: ["6.10", "6.11", "6.12", "6.13", "6.14", "6.15", "6.16", "6.17", "6.18", "6.19", "6.20", "6.21", "6.22"],
  },
  {
    id: "current_value",
    en: ["current value", "value in use", "fulfilment value", "current cost"],
    ne: ["hali ko mulya", "upayog mulya", "purnata mulya", "hali ko lagat"],
    chapter: 6,
    paragraphs: ["6.23", "6.24", "6.25", "6.26", "6.27", "6.28", "6.29", "6.30", "6.31"],
  },
  {
    id: "measurement_uncertainty",
    en: ["measurement uncertainty", "uncertainty", "estimates", "judgements"],
    ne: ["mulyankan apurna", "anishchitata", "andaaja", "nirnaya"],
    chapter: 6,
    paragraphs: ["6.32", "6.33", "6.34", "6.35", "6.36", "6.37", "6.38", "6.39", "6.40", "6.41", "6.42"],
  },
  {
    id: "measurement_cost_benefit",
    en: ["measurement cost benefit", "cost of measurement", "benefits of measurement"],
    ne: ["mulyankan lagat faida", "mulyankan ko lagat"],
    chapter: 6,
    paragraphs: ["6.43", "6.44", "6.45", "6.46", "6.47", "6.48"],
  },
  {
    id: "presentation",
    en: ["presentation", "present", "financial statement presentation", "classification in statements"],
    ne: ["prastut", "prastuti", "patra ma dekhau", "vargikaran"],
    chapter: 7,
    paragraphs: ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8"],
  },
  {
    id: "disclosure",
    en: ["disclosure", "disclose", "notes to financial statements", "information in notes"],
    ne: ["prakashan", "disclosure", "notes", "patra ko notes"],
    chapter: 7,
    paragraphs: ["7.9", "7.10", "7.11", "7.12", "7.13", "7.14", "7.15", "7.16", "7.17", "7.18", "7.19", "7.20"],
  },
  {
    id: "capital_maintenance",
    en: ["capital maintenance", "financial capital", "physical capital", "capital concept"],
    ne: ["puni sanrakshan", "arthik puni", "bhautik puni", "puni ko avadharana"],
    chapter: 8,
    paragraphs: ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10"],
  },
];

function cleanText(text) {
  return text
    .replace(/\f/g, "\n")
    .replace(/© IFRS Foundation/g, "")
    .replace(/A\d+\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseParagraphs(raw) {
  const lines = raw.split("\n");
  const paragraphs = new Map();
  let currentSection = "";
  let currentChapter = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    const chapterMatch = line.match(/^CHAPTER\s+(\d+)/i);
    if (chapterMatch) {
      currentChapter = parseInt(chapterMatch[1], 10);
      i += 1;
      continue;
    }

    const paraMatch = line.match(/^(\d+\.\d+)$/);
    if (paraMatch) {
      const id = paraMatch[1];
      const chapterFromId = parseInt(id.split(".")[0], 10);
      if (chapterFromId >= 1 && chapterFromId <= 8) {
        currentChapter = chapterFromId;
      }

      i += 1;
      const contentLines = [];
      while (i < lines.length) {
        const next = lines[i].trim();
        if (/^\d+\.\d+$/.test(next)) break;
        if (/^CHAPTER\s+\d+/i.test(next)) break;
        if (/^© IFRS Foundation/.test(next)) {
          i += 1;
          continue;
        }
        if (/^A\d+$/.test(next)) {
          i += 1;
          continue;
        }
        if (next && !/^CONTENTS$/i.test(next) && !/^from paragraph$/i.test(next)) {
          contentLines.push(next);
        }
        i += 1;
      }

      const text = cleanText(contentLines.join(" "));
      if (text.length > 20) {
        const existing = paragraphs.get(id);
        if (!existing || text.length > existing.text.length) {
          paragraphs.set(id, {
            id,
            chapter: currentChapter || chapterFromId,
            section: currentSection,
            text,
            topics: [],
          });
        }
      }
      continue;
    }

    if (
      line.length > 5 &&
      line.length < 120 &&
      !/^continued/i.test(line) &&
      !/^Table/i.test(line) &&
      !/^Item discussed/i.test(line) &&
      !/^Definition or/i.test(line) &&
      !/^Element$/i.test(line) &&
      !/^\([a-z]\)$/i.test(line) &&
      !/^\d+$/.test(line) &&
      !/^Throughout the/i.test(line) &&
      !/^SP\d/i.test(line) &&
      /^[A-Za-z]/.test(line)
    ) {
      if (!/^Conceptual Framework$/i.test(line) && !/^Introduction$/i.test(line)) {
        currentSection = line.replace(/\s+/g, " ");
      }
    }

    i += 1;
  }

  return paragraphs;
}

function buildTopicIndex(paragraphs) {
  for (const concept of CONCEPTS) {
    for (const pid of concept.paragraphs) {
      const para = paragraphs.get(pid);
      if (para && !para.topics.includes(concept.id)) {
        para.topics.push(concept.id);
      }
    }
  }
}

function buildSummaries(paragraphs) {
  for (const [, para] of paragraphs) {
    const sentences = para.text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30);
    para.summary = sentences[0]?.slice(0, 280) ?? para.text.slice(0, 280);
  }
}

function main() {
  const raw = readFileSync(SOURCE, "utf8");
  const paragraphs = parseParagraphs(raw);
  buildTopicIndex(paragraphs);
  buildSummaries(paragraphs);

  const paragraphList = [...paragraphs.values()].sort((a, b) => {
    const [ac, ap] = a.id.split(".").map(Number);
    const [bc, bp] = b.id.split(".").map(Number);
    return ac - bc || ap - bp;
  });

  const corpus = {
    version: "1.0.0",
    source: "IFRS Conceptual Framework for Financial Reporting (March 2018)",
    description: "Structured CA-level knowledge corpus for e-Khata semantic brain. Covers all 8 chapters with bilingual concept aliases for Nepali/English understanding.",
    metadata: {
      framework: "IFRS Conceptual Framework 2018",
      aligned_with: "NAS (Nepal Accounting Standards)",
      total_paragraphs: paragraphList.length,
      total_concepts: CONCEPTS.length,
      chapters: Object.entries(CHAPTER_TITLES).map(([num, title]) => ({
        number: parseInt(num, 10),
        title,
      })),
    },
    concepts: CONCEPTS,
    paragraphs: paragraphList,
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(corpus, null, 2), "utf8");

  console.log(`Built CA knowledge corpus:`);
  console.log(`  Paragraphs: ${paragraphList.length}`);
  console.log(`  Concepts: ${CONCEPTS.length}`);
  console.log(`  Output: ${OUTPUT}`);
}

main();
