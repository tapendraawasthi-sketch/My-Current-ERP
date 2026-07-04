/**
 * Parse IFRS Conceptual Framework for Financial Reporting (2018) — COMPLETE corpus.
 * Extracts every paragraph, SP section, table, glossary term, and chapter full text.
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
  { id: "status_purpose", en: ["status and purpose", "conceptual framework purpose", "not a standard"], ne: ["udeshya ra prakriti", "framework ko udeshya"], chapter: 0, paragraphs: ["SP1.1", "SP1.2", "SP1.3", "SP1.4", "SP1.5"] },
  { id: "objective_financial_reporting", en: ["objective", "general purpose financial reporting", "financial reporting objective", "purpose of financial statements"], ne: ["udeshya", "financial reporting ko udeshya", "lekha ko lakshya", "hisab patra ko udeshya"], chapter: 1, paragraphs: ["1.1", "1.2", "1.3", "1.4", "1.5"] },
  { id: "economic_resources", en: ["economic resource", "economic resources", "resources", "claims"], ne: ["arthik sampatti", "sampatti", "arthik adhikar", "dayitwo"], chapter: 1, paragraphs: ["1.12", "1.13", "1.14"] },
  { id: "accrual_accounting", en: ["accrual accounting", "accrual basis", "accrual", "matching principle"], ne: ["prapti aadhar", "accrual", "accrual hisab", "prapti hisab"], chapter: 1, paragraphs: ["1.17", "1.18", "1.19"] },
  { id: "cash_flows", en: ["cash flows", "past cash flows", "cash basis", "cash receipts and payments"], ne: ["nagad prabah", "cash flow", "nagad aadhar", "nagad hisab"], chapter: 1, paragraphs: ["1.20"] },
  { id: "stewardship", en: ["stewardship", "management responsibility", "governing board", "use of resources"], ne: ["byabasthapan jimma", "sampatti ko upayog", "prabandh jimma"], chapter: 1, paragraphs: ["1.22", "1.23"] },
  { id: "relevance", en: ["relevance", "relevant information", "predictive value", "confirmatory value"], ne: ["sambandhitata", "sambandhit", "predictive value", "confirmatory"], chapter: 2, paragraphs: ["2.6", "2.7", "2.8", "2.9", "2.10"] },
  { id: "faithful_representation", en: ["faithful representation", "faithfully represented", "complete", "neutral", "free from error"], ne: ["biswasilo pratinidhitwo", "satya pratinidhitwo", "purna", "netral", "truti rahit"], chapter: 2, paragraphs: ["2.11", "2.12", "2.13", "2.14", "2.15", "2.16"] },
  { id: "comparability", en: ["comparability", "comparable", "consistency", "verifiability", "timeliness", "understandability"], ne: ["tulaniyogya", "tulan", "samanta", "pramanik", "samayama", "bujhna sajilo"], chapter: 2, paragraphs: ["2.23", "2.24", "2.25", "2.26", "2.27", "2.28", "2.29", "2.30", "2.31", "2.32", "2.33", "2.34", "2.35", "2.36", "2.37", "2.38"] },
  { id: "materiality", en: ["materiality", "material", "immaterial", "material information"], ne: ["mahatwo", "mahatwpoorna", "sulabh", "material"], chapter: 2, paragraphs: ["2.29", "2.30", "2.31"] },
  { id: "cost_constraint", en: ["cost constraint", "cost benefit", "cost of providing information"], ne: ["lagat seema", "lagat faida", "jankari ko lagat"], chapter: 2, paragraphs: ["2.39", "2.40", "2.41", "2.42", "2.43", "2.44", "2.45", "2.46"] },
  { id: "going_concern", en: ["going concern", "continuing entity", "liquidation", "cease trading"], ne: ["chalirakhne aadhar", "going concern", "band hune", "byapar band"], chapter: 3, paragraphs: ["3.9", "3.10"] },
  { id: "reporting_entity", en: ["reporting entity", "consolidated", "unconsolidated", "parent", "subsidiary"], ne: ["reporting entity", "sanghik", "asanghik", "putra company", "santati company"], chapter: 3, paragraphs: ["3.10", "3.11", "3.12", "3.13", "3.14", "3.15"] },
  { id: "financial_statements", en: ["financial statements", "financial position", "financial performance", "reporting period"], ne: ["arthik patra", "financial statement", "arthik sthiti", "prativedhan avadhi"], chapter: 3, paragraphs: ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"] },
  { id: "asset", en: ["asset", "assets", "definition of asset", "economic resource controlled"], ne: ["sampatti", "asset", "asset ko paribhasha", "sampatti k ho"], chapter: 4, paragraphs: ["4.3", "4.4", "4.5"] },
  { id: "asset_right", en: ["right", "contractual right", "legal right", "property right"], ne: ["adhikar", "samjhauta adhikar", "kanuni adhikar"], chapter: 4, paragraphs: ["4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12", "4.13"] },
  { id: "asset_control", en: ["control", "controlled by entity", "control of asset"], ne: ["niyantran", "niyantran ma", "sampatti ko niyantran"], chapter: 4, paragraphs: ["4.19", "4.20", "4.21", "4.22", "4.23", "4.24", "4.25"] },
  { id: "asset_economic_benefits", en: ["potential to produce economic benefits", "economic benefits", "future economic benefits"], ne: ["arthik faida", "bhavishya faida", "faida ko samarthan"], chapter: 4, paragraphs: ["4.14", "4.15", "4.16", "4.17", "4.18"] },
  { id: "liability", en: ["liability", "liabilities", "definition of liability", "present obligation"], ne: ["dayitwo", "rin", "liability", "liability ko paribhasha", "bartaman dayitwo"], chapter: 4, paragraphs: ["4.26", "4.27"] },
  { id: "liability_obligation", en: ["obligation", "present obligation", "legal obligation", "constructive obligation"], ne: ["dayitwo", "bartaman dayitwo", "kanuni dayitwo", "nirmit dayitwo"], chapter: 4, paragraphs: ["4.28", "4.29", "4.30", "4.31", "4.32", "4.33", "4.34", "4.35"] },
  { id: "liability_transfer", en: ["transfer of economic resource", "transfer resource", "settle obligation"], ne: ["sampatti transfer", "sampatti handover", "dayitwo muktila"], chapter: 4, paragraphs: ["4.36", "4.37", "4.38", "4.39", "4.40", "4.41"] },
  { id: "liability_past_event", en: ["past events", "result of past events", "past event obligation"], ne: ["biyetka ghatna", "agad ko ghatna", "purano ghatna"], chapter: 4, paragraphs: ["4.42", "4.43", "4.44", "4.45", "4.46", "4.47"] },
  { id: "unit_of_account", en: ["unit of account", "grouping rights", "separate asset", "single asset"], ne: ["lekh ko ekai", "adhikar samuha", "ek sampatti"], chapter: 4, paragraphs: ["4.48", "4.49", "4.50", "4.51", "4.52", "4.53", "4.54", "4.55"] },
  { id: "executory_contract", en: ["executory contract", "mutual unperformed obligations", "unperformed contract"], ne: ["executory samjhauta", "baki dayitwo", "anpurna samjhauta"], chapter: 4, paragraphs: ["4.56", "4.57", "4.58"] },
  { id: "substance_over_form", en: ["substance", "contractual rights", "contractual obligations", "substance over form"], ne: ["tatwo", "samjhauta adhikar", "samjhauta dayitwo", "rup bhanda tatwo"], chapter: 4, paragraphs: ["4.59", "4.60", "4.61", "4.62"] },
  { id: "equity", en: ["equity", "residual interest", "definition of equity", "equity claims"], ne: ["puni", "equity", "baki hissa", "equity ko paribhasha"], chapter: 4, paragraphs: ["4.63", "4.64", "4.65", "4.66", "4.67"] },
  { id: "income", en: ["income", "revenue", "definition of income", "increases in assets"], ne: ["aamdani", "income", "aamdani ko paribhasha", "sampatti badhne"], chapter: 4, paragraphs: ["4.68", "4.69", "4.70", "4.71", "4.72"] },
  { id: "expense", en: ["expense", "expenses", "definition of expense", "decreases in assets"], ne: ["kharcha", "expense", "kharcha ko paribhasha", "sampatti ghataune"], chapter: 4, paragraphs: ["4.73", "4.74", "4.75", "4.76", "4.77"] },
  { id: "recognition", en: ["recognition", "recognise", "recognize", "recognition criteria", "recognition process"], ne: ["manyata", "swikar", "recognition", "manyata ko maapdanda"], chapter: 5, paragraphs: ["5.1", "5.2", "5.3", "5.4", "5.5"] },
  { id: "recognition_relevance", en: ["recognition relevance", "relevant information recognition"], ne: ["manyata sambandhitata", "sambandhit jankari manyata"], chapter: 5, paragraphs: ["5.6", "5.7", "5.8", "5.9", "5.10", "5.11"] },
  { id: "recognition_faithful", en: ["recognition faithful representation", "faithful representation recognition"], ne: ["manyata biswasilo pratinidhitwo"], chapter: 5, paragraphs: ["5.12", "5.13", "5.14", "5.15", "5.16", "5.17"] },
  { id: "derecognition", en: ["derecognition", "derecognise", "derecognize", "remove from balance sheet"], ne: ["manyata radda", "derecognition", "patra bata hataune"], chapter: 5, paragraphs: ["5.26", "5.27", "5.28", "5.29", "5.30"] },
  { id: "measurement", en: ["measurement", "measure", "measurement basis", "measurement techniques"], ne: ["mulyankan", "measurement", "mulya nirdharan", "mulyankan aadhar"], chapter: 6, paragraphs: ["6.1", "6.2", "6.3"] },
  { id: "historical_cost", en: ["historical cost", "cost", "original cost", "historical cost basis"], ne: ["purano mulya", "aitihasik mulya", "historical cost", "lagat aadhar"], chapter: 6, paragraphs: ["6.4", "6.5", "6.6", "6.7", "6.8", "6.9"] },
  { id: "fair_value", en: ["fair value", "current market value", "fair value measurement"], ne: ["nyaya mulya", "fair value", "bajar mulya", "hali ko mulya"], chapter: 6, paragraphs: ["6.10", "6.11", "6.12", "6.13", "6.14", "6.15", "6.16", "6.17", "6.18", "6.19", "6.20", "6.21", "6.22"] },
  { id: "current_value", en: ["current value", "value in use", "fulfilment value", "current cost"], ne: ["hali ko mulya", "upayog mulya", "purnata mulya", "hali ko lagat"], chapter: 6, paragraphs: ["6.23", "6.24", "6.25", "6.26", "6.27", "6.28", "6.29", "6.30", "6.31"] },
  { id: "measurement_uncertainty", en: ["measurement uncertainty", "uncertainty", "estimates", "judgements"], ne: ["mulyankan apurna", "anishchitata", "andaaja", "nirnaya"], chapter: 6, paragraphs: ["6.32", "6.33", "6.34", "6.35", "6.36", "6.37", "6.38", "6.39", "6.40", "6.41", "6.42"] },
  { id: "measurement_cost_benefit", en: ["measurement cost benefit", "cost of measurement", "benefits of measurement"], ne: ["mulyankan lagat faida", "mulyankan ko lagat"], chapter: 6, paragraphs: ["6.43", "6.44", "6.45", "6.46", "6.47", "6.48"] },
  { id: "presentation", en: ["presentation", "present", "financial statement presentation", "classification in statements"], ne: ["prastut", "prastuti", "patra ma dekhau", "vargikaran"], chapter: 7, paragraphs: ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8"] },
  { id: "disclosure", en: ["disclosure", "disclose", "notes to financial statements", "information in notes"], ne: ["prakashan", "disclosure", "notes", "patra ko notes"], chapter: 7, paragraphs: ["7.9", "7.10", "7.11", "7.12", "7.13", "7.14", "7.15", "7.16", "7.17", "7.18", "7.19", "7.20"] },
  { id: "capital_maintenance", en: ["capital maintenance", "financial capital", "physical capital", "capital concept"], ne: ["puni sanrakshan", "arthik puni", "bhautik puni", "puni ko avadharana"], chapter: 8, paragraphs: ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10"] },
];

/** Known paragraph start phrases for splitting stacked para IDs (PDF extraction artifact) */
const KNOWN_PARA_STARTS = {
  "4.10": "An entity cannot have a right to obtain economic benefits from itself",
  "4.11": "In principle, each of an entity's rights is a separate asset",
  "5.26": "Derecognition is the removal of all or part of a recognised asset or liability",
  "5.27": "Accounting requirements for derecognition aim to faithfully represent both",
  "5.28": "The aims described in paragraph 5.27 are normally achieved by",
  "5.29": "In some cases, an entity might appear to transfer an asset or liability",
  "6.7": "The historical cost of an asset is updated over time to depict, if applicable",
  "6.8": "The historical cost of a liability is updated over time to depict, if applicable",
  "6.9": "One way to apply a historical cost measurement basis to financial assets",
};

const SKIP_LINES = /^(© IFRS Foundation|Conceptual Framework|CONTENTS|from paragraph|continued\.\.\.|BASIS FOR CONCLUSIONS|A\d+$|\f)$/i;

function cleanText(text) {
  return text
    .replace(/\f/g, "\n")
    .replace(/© IFRS Foundation/g, "")
    .replace(/\bA\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLines(raw) {
  return raw
    .replace(/\f/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !SKIP_LINES.test(l));
}

function isParaId(line) {
  return /^\d+\.\d+$/.test(line);
}

function isSpId(line) {
  return /^SP\d+\.\d+$/.test(line);
}

function isSectionHeader(line) {
  return (
    line.length > 5 &&
    line.length < 120 &&
    !/^Table/i.test(line) &&
    !/^CHAPTER/i.test(line) &&
    !isParaId(line) &&
    !isSpId(line) &&
    !/^\([a-zivx]+\)$/i.test(line) &&
    !/^\d+$/.test(line) &&
    /^[A-Za-z]/.test(line)
  );
}

function normalizeApostrophes(s) {
  return s.replace(/[\u2018\u2019\u201B]/g, "'");
}

/** Split a text block among stacked paragraph IDs using known starts + sentence boundaries */
function splitStackedContent(ids, fullText) {
  if (ids.length === 1) return [{ id: ids[0], text: fullText }];

  const normText = normalizeApostrophes(fullText);
  const starts = [];
  for (const id of ids) {
    const known = KNOWN_PARA_STARTS[id];
    if (known) {
      const idx = normText.indexOf(normalizeApostrophes(known));
      if (idx >= 0) starts.push({ id, idx });
    }
  }

  if (starts.length === 0) {
    return ids.map((id, i) => ({
      id,
      text: i === 0 ? fullText : `[See ${ids[0]} for combined text in source extraction]`,
    }));
  }

  // Also assign text BEFORE first known start to the first stacked ID
  starts.sort((a, b) => a.idx - b.idx);
  const result = [];
  if (starts[0].idx > 0 && ids[0] !== starts[0].id) {
    const firstId = ids.find((id) => !starts.some((s) => s.id === id)) ?? ids[0];
    result.push({ id: firstId, text: fullText.slice(0, starts[0].idx).trim() });
  }

  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].idx : fullText.length;
    result.push({ id: starts[i].id, text: fullText.slice(starts[i].idx, end).trim() });
  }

  for (const id of ids) {
    if (!result.find((r) => r.id === id)) {
      result.push({ id, text: "" });
    }
  }
  return result.sort((a, b) => {
    const [ac, ap] = a.id.split(".").map(Number);
    const [bc, bp] = b.id.split(".").map(Number);
    return ac - bc || ap - bp;
  });
}

function parseNumberedParagraphs(lines) {
  const paragraphs = new Map();
  let currentSection = "";
  let currentChapter = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const chapterMatch = line.match(/^CHAPTER\s+(\d+)/i);
    if (chapterMatch) {
      currentChapter = parseInt(chapterMatch[1], 10);
      i += 1;
      continue;
    }

    if (isParaId(line)) {
      const stackedIds = [line];
      i += 1;
      while (i < lines.length && isParaId(lines[i])) {
        stackedIds.push(lines[i]);
        i += 1;
      }

      const contentLines = [];
      while (i < lines.length) {
        const next = lines[i];
        if (isParaId(next) || /^CHAPTER\s+\d+/i.test(next) || /^SP\d+\.\d+$/.test(next)) break;
        if (/^Table \d+\.\d+—/.test(next)) break;
        if (/^Appendix$/i.test(next)) break;
        if (next && !/^Item discussed in$/i.test(next) && !/^Definition or description$/i.test(next) && !/^Element$/i.test(next)) {
          contentLines.push(next);
        }
        i += 1;
      }

      const fullText = cleanText(contentLines.join(" "));
      const splits = splitStackedContent(stackedIds, fullText);

      for (const { id, text } of splits) {
        const chapterFromId = parseInt(id.split(".")[0], 10);
        if (chapterFromId >= 1 && chapterFromId <= 8) currentChapter = chapterFromId;
        if (!text || text.length < 5) continue;

        const existing = paragraphs.get(id);
        if (!existing || text.length > existing.text.length) {
          paragraphs.set(id, {
            id,
            type: "paragraph",
            chapter: currentChapter || chapterFromId,
            section: currentSection,
            text,
            topics: [],
          });
        }
      }
      continue;
    }

    if (isSectionHeader(line) && !/^Introduction$/i.test(line)) {
      currentSection = line.replace(/\s+/g, " ");
    }
    i += 1;
  }

  return paragraphs;
}

function parseSpParagraphs(raw) {
  const spParagraphs = new Map();
  // Use body section only (after BASIS FOR CONCLUSIONS marker in document body)
  const bodyMarker = raw.indexOf("BASIS FOR CONCLUSIONS");
  const searchText = bodyMarker >= 0 ? raw.slice(bodyMarker) : raw;
  const lines = searchText.split("\n").map((l) => l.trim()).filter(Boolean);

  let i = 0;
  let inSpSection = false;

  while (i < lines.length) {
    const line = lines[i];

    if (/^STATUS AND PURPOSE OF THE CONCEPTUAL FRAMEWORK$/i.test(line)) {
      inSpSection = true;
      i += 1;
      continue;
    }

    if (inSpSection && /^CHAPTER\s+1/i.test(line)) {
      break;
    }

    if (isSpId(line)) {
      const id = line;
      i += 1;
      const contentLines = [];
      while (i < lines.length) {
        const next = lines[i];
        if (isSpId(next) || /^CHAPTER\s+\d+/i.test(next)) break;
        if (next && !/^© IFRS Foundation/.test(next) && !/^A\d+$/.test(next)) {
          contentLines.push(next);
        }
        i += 1;
      }
      const text = cleanText(contentLines.join(" "));
      if (text.length > 20) {
        spParagraphs.set(id, {
          id,
          type: "sp_paragraph",
          chapter: 0,
          section: "Status and Purpose of the Conceptual Framework",
          text,
          topics: ["status_purpose"],
        });
      }
      continue;
    }
    i += 1;
  }

  return spParagraphs;
}

function extractTable(lines, tableId, startPattern) {
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startPattern.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return null;

  const contentLines = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (i > startIdx && (isParaId(line) || /^Definition of /i.test(line) || /^CHAPTER\s+\d+/i.test(line))) {
      if (/^Definition of an asset$/i.test(line)) break;
      if (isParaId(line) && parseInt(line.split(".")[0]) >= 4) break;
    }
    if (i > startIdx + 3 && /^Current value$/i.test(line)) break;
    if (i > startIdx + 3 && /^CHAPTER\s+7/i.test(line)) break;
    contentLines.push(line);
  }

  const text = cleanText(contentLines.join(" "));
  const chapter = tableId.startsWith("4") ? 4 : 6;
  return {
    id: `Table ${tableId}`,
    type: "table",
    chapter,
    section: `Table ${tableId}`,
    text,
    topics: tableId === "4.1" ? ["asset", "liability", "equity", "income", "expense"] : ["measurement", "historical_cost", "fair_value", "current_value"],
  };
}

function parseGlossary(lines) {
  const glossary = [];
  let inAppendix = false;
  let i = 0;

  while (i < lines.length) {
    if (/^Appendix$/i.test(lines[i])) {
      inAppendix = true;
      i += 1;
      continue;
    }
    if (!inAppendix) {
      i += 1;
      continue;
    }

    // Stop at board members / end markers
    if (/^(Takatsugu Ochi|Mary Tokar|IFRS Foundation)/i.test(lines[i])) break;

    const line = lines[i];
    // Term lines: lowercase words, possibly with line breaks in PDF
    if (/^[a-z][a-z\s\-]+$/.test(line) && line.length < 60 && !line.startsWith("cf")) {
      const termParts = [line];
      i += 1;
      const defParts = [];
      const refs = [];

      while (i < lines.length) {
        const next = lines[i];
        if (/^[a-z][a-z\s\-]+$/.test(next) && next.length < 60 && defParts.length > 3) break;
        if (/^(Takatsugu|Mary Tokar|©)/i.test(next)) break;
        if (/^CF\.\d/i.test(next) || /^continued/i.test(next)) {
          refs.push(next.replace(/^CF\./, "").replace(/,.*/, ""));
          i += 1;
          continue;
        }
        if (/^[A-Z]/.test(next) && defParts.length === 0 && termParts.length === 1) {
          // continuation of multi-line term
          termParts.push(next.toLowerCase());
          i += 1;
          continue;
        }
        defParts.push(next);
        i += 1;
        if (defParts.join(" ").includes("CF.") || /CF\.\d/.test(lines[i - 1] + lines[i])) {
          if (/CF\.\d/.test(lines[i] ?? "")) {
            refs.push(...(lines[i].match(/CF\.\d+\.\d+/g) ?? []));
            i += 1;
          }
          break;
        }
      }

      const term = termParts.join(" ").replace(/\s+/g, " ").trim();
      let definition = cleanText(defParts.join(" "));
      definition = definition.replace(/CF\.\d+\.\d+.*$/, "").trim();

      if (term.length >= 3 && definition.length >= 10) {
        glossary.push({
          id: `glossary-${term.replace(/\s+/g, "_")}`,
          type: "glossary",
          term,
          chapter: 0,
          section: "Appendix — Defined terms",
          text: `${term}: ${definition}`,
          definition,
          cfReferences: refs.map((r) => r.replace("CF.", "")),
          topics: [term.replace(/\s+/g, "_")],
        });
      }
      continue;
    }
    i += 1;
  }

  return glossary;
}

function extractAppendixFull(raw) {
  const start = raw.indexOf("Appendix\nDefined terms");
  if (start < 0) return null;
  const endMarkers = ["Takatsugu Ochi", "IFRS Foundation\n\nA97"];
  let end = raw.length;
  for (const m of endMarkers) {
    const idx = raw.indexOf(m, start);
    if (idx > start) end = Math.min(end, idx);
  }
  const text = cleanText(raw.slice(start, end));
  return {
    id: "appendix-defined-terms-full",
    type: "appendix_full",
    chapter: 0,
    section: "Appendix — Defined terms (complete)",
    text,
    topics: ["glossary"],
  };
}

function extractChapterTexts(raw) {
  const chapterTexts = [];
  // Body starts after first real CHAPTER 1 header in document (not TOC)
  const bodyStart = raw.indexOf("CHAPTER 1—THE OBJECTIVE OF GENERAL PURPOSE\nFINANCIAL REPORTING\nINTRODUCTION");
  const altStart = raw.indexOf("Introduction\n1.1");
  const start = bodyStart >= 0 ? bodyStart : altStart;
  if (start < 0) return chapterTexts;

  const body = raw.slice(start);
  const appendixIdx = body.indexOf("Appendix\nDefined terms");
  const bodyEnd = appendixIdx > 0 ? appendixIdx : body.length;
  const mainBody = body.slice(0, bodyEnd);

  for (let ch = 1; ch <= 8; ch++) {
    const headerPattern = new RegExp(`CHAPTER\\s+${ch}[—–-]`, "i");
    const nextPattern = ch < 8 ? new RegExp(`CHAPTER\\s+${ch + 1}[—–-]`, "i") : null;

    const match = mainBody.match(headerPattern);
    if (!match || match.index === undefined) continue;

    const chStart = match.index;
    let chEnd = mainBody.length;
    if (nextPattern) {
      const nextMatch = mainBody.slice(chStart + 10).match(nextPattern);
      if (nextMatch && nextMatch.index !== undefined) {
        chEnd = chStart + 10 + nextMatch.index;
      }
    }

    const text = cleanText(mainBody.slice(chStart, chEnd));
    if (text.length > 100) {
      chapterTexts.push({
        id: `chapter-${ch}-full`,
        type: "chapter_full",
        chapter: ch,
        section: CHAPTER_TITLES[ch] ?? `Chapter ${ch}`,
        text,
        topics: [],
      });
    }
  }

  return chapterTexts;
}

function extractStatusPurposeFull(raw) {
  const start = raw.indexOf("STATUS AND PURPOSE OF THE CONCEPTUAL FRAMEWORK");
  const end = raw.indexOf("CHAPTER 1—THE OBJECTIVE");
  if (start < 0 || end < 0) return null;
  const text = cleanText(raw.slice(start, end));
  return {
    id: "section-status-purpose-full",
    type: "section_full",
    chapter: 0,
    section: "Status and Purpose of the Conceptual Framework",
    text,
    topics: ["status_purpose"],
  };
}

function buildTopicIndex(allItems) {
  for (const concept of CONCEPTS) {
    for (const pid of concept.paragraphs) {
      const item = allItems.find((p) => p.id === pid);
      if (item && !item.topics.includes(concept.id)) {
        item.topics.push(concept.id);
      }
    }
  }
}

function buildSummaries(items) {
  for (const item of items) {
    if (item.type === "glossary") {
      item.summary = item.definition?.slice(0, 280) ?? item.text.slice(0, 280);
      continue;
    }
    const sentences = item.text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30);
    item.summary = sentences[0]?.slice(0, 280) ?? item.text.slice(0, 280);
  }
}

function coverageReport(sourceIds, extractedIds, fullTextLen, extractedLen) {
  const missing = [...sourceIds].filter((id) => !extractedIds.has(id)).sort();
  return {
    sourceParagraphIds: sourceIds.size,
    extractedParagraphIds: extractedIds.size,
    missingParagraphIds: missing,
    coveragePercent: Math.round((extractedIds.size / sourceIds.size) * 1000) / 10,
    sourceChars: fullTextLen,
    extractedChars: extractedLen,
  };
}

function main() {
  const raw = readFileSync(SOURCE, "utf8");
  const lines = cleanLines(raw);
  const fullDocumentText = cleanText(raw);

  const numberedParas = parseNumberedParagraphs(lines);
  const spParas = parseSpParagraphs(raw);
  const table41 = extractTable(lines, "4.1", /^Table 4\.1—/);
  const table61 = extractTable(lines, "6.1", /^Table 6\.1—/);
  const glossary = parseGlossary(lines);
  const appendixFull = extractAppendixFull(raw);
  const chapterTexts = extractChapterTexts(raw);
  const statusPurposeFull = extractStatusPurposeFull(raw);

  // Merge SP into paragraphs map for unified access
  const allParagraphs = new Map([...numberedParas, ...spParas]);

  const paragraphList = [...allParagraphs.values()].sort((a, b) => {
    const sortKey = (id) => {
      if (id.startsWith("SP")) return [0, parseFloat(id.replace("SP", ""))];
      const [c, p] = id.split(".").map(Number);
      return [c, p];
    };
    const [ac, ap] = sortKey(a.id);
    const [bc, bp] = sortKey(b.id);
    return ac - bc || ap - bp;
  });

  const tables = [table41, table61].filter(Boolean);
  const sections = [statusPurposeFull, appendixFull].filter(Boolean);

  const allSearchable = [...paragraphList, ...tables, ...glossary, ...chapterTexts, ...sections];
  buildTopicIndex(allSearchable);
  buildSummaries(allSearchable);

  // Source ID inventory for coverage
  const sourceIds = new Set();
  for (const line of raw.split("\n")) {
    const m = line.trim().match(/^(\d+\.\d+)$/);
    if (m) sourceIds.add(m[1]);
  }
  const extractedIds = new Set([...numberedParas.keys()]);
  const spIds = new Set([...spParas.keys()]);

  const extractedTextLen =
    paragraphList.reduce((s, p) => s + p.text.length, 0) +
    tables.reduce((s, t) => s + t.text.length, 0) +
    glossary.reduce((s, g) => s + g.text.length, 0) +
    chapterTexts.reduce((s, c) => s + c.text.length, 0) +
    sections.reduce((s, x) => s + x.text.length, 0);

  const corpus = {
    version: "2.0.0",
    source: "IFRS Conceptual Framework for Financial Reporting (March 2018)",
    description:
      "Complete CA-level knowledge corpus — every paragraph, SP section, table, glossary term, and chapter full text from the uploaded document.",
    metadata: {
      framework: "IFRS Conceptual Framework 2018",
      aligned_with: "NAS (Nepal Accounting Standards)",
      complete: true,
      total_paragraphs: paragraphList.length,
      total_sp_paragraphs: spIds.size,
      total_tables: tables.length,
      total_glossary_terms: glossary.length,
      total_chapter_full_texts: chapterTexts.length,
      total_searchable_items: allSearchable.length,
      total_concepts: CONCEPTS.length,
      full_document_chars: fullDocumentText.length,
      coverage: coverageReport(sourceIds, extractedIds, raw.length, extractedTextLen),
      chapters: Object.entries(CHAPTER_TITLES).map(([num, title]) => ({
        number: parseInt(num, 10),
        title,
      })),
    },
    concepts: CONCEPTS,
    paragraphs: paragraphList,
    tables,
    glossary,
    chapterTexts,
    sections,
    fullDocumentText,
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(corpus, null, 2), "utf8");

  console.log("Built COMPLETE CA knowledge corpus:");
  console.log(`  Numbered paragraphs: ${numberedParas.size}`);
  console.log(`  SP paragraphs: ${spIds.size}`);
  console.log(`  Tables: ${tables.length}`);
  console.log(`  Glossary terms: ${glossary.length}`);
  console.log(`  Chapter full texts: ${chapterTexts.length}`);
  console.log(`  Full document chars: ${fullDocumentText.length}`);
  console.log(`  Coverage: ${corpus.metadata.coverage.coveragePercent}% (${extractedIds.size}/${sourceIds.size} para IDs)`);
  if (corpus.metadata.coverage.missingParagraphIds.length) {
    console.log(`  Missing IDs: ${corpus.metadata.coverage.missingParagraphIds.join(", ")}`);
  }
  console.log(`  Output: ${OUTPUT}`);
}

main();
