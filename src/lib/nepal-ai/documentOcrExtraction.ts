/**
 * Document OCR extraction goldens — raw scan → error correction → structured fields.
 * Complements documentUnderstanding (batch 24 schemas) with concrete OCR examples.
 */

import {
  DOCUMENT_OCR_EXTRACTION_ALIASES,
  DOCUMENT_OCR_EXTRACTIONS,
  DOCUMENT_OCR_EXTRACTIONS_BY_TYPE,
  type DocumentOcrExtraction,
} from "./generated/runtimeMaps";

const BY_ID = new Map(DOCUMENT_OCR_EXTRACTIONS.map((e) => [e.id, e]));
const ALIAS_KEYS = Object.keys(DOCUMENT_OCR_EXTRACTION_ALIASES).sort(
  (a, b) => b.length - a.length,
);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDocumentOcrExtractionById(
  id: string,
): DocumentOcrExtraction | null {
  return BY_ID.get(id) ?? null;
}

export function getDocumentOcrExtractionsByTypeKey(
  documentTypeKey: string,
): DocumentOcrExtraction[] {
  const ids = DOCUMENT_OCR_EXTRACTIONS_BY_TYPE[documentTypeKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as DocumentOcrExtraction[];
}

function aliasHit(text: string): DocumentOcrExtraction | null {
  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = DOCUMENT_OCR_EXTRACTION_ALIASES[cand];
    if (hit) return getDocumentOcrExtractionById(hit.id);
  }

  let best: DocumentOcrExtraction | null = null;
  let bestLen = 0;
  for (const alias of ALIAS_KEYS) {
    const a = normalizeKey(alias);
    if (a.length < 6) continue;
    if (!(spaced === a || spaced.includes(a) || a.includes(spaced))) continue;
    if (a.length > bestLen) {
      const entry = getDocumentOcrExtractionById(
        DOCUMENT_OCR_EXTRACTION_ALIASES[alias].id,
      );
      if (entry) {
        best = entry;
        bestLen = a.length;
      }
    }
  }
  return best;
}

function rawTextHit(text: string): DocumentOcrExtraction | null {
  const norm = normalizeKey(text);
  if (norm.length < 12) return null;

  let best: DocumentOcrExtraction | null = null;
  let bestScore = 0;
  for (const entry of DOCUMENT_OCR_EXTRACTIONS) {
    const rawNorm = normalizeKey(entry.rawOcrText.slice(0, 120));
    if (rawNorm.length < 12) continue;
    if (norm.includes(rawNorm) || rawNorm.includes(norm)) {
      const score = rawNorm.length;
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }
  }
  return best;
}

/** Match user text to an OCR extraction golden (type alias or raw OCR snippet). */
export function matchDocumentOcrExtraction(
  text: string,
): DocumentOcrExtraction | null {
  if (!text?.trim()) return null;
  return aliasHit(text) ?? rawTextHit(text);
}

/** OCR correction / extraction cues in user question. */
export function isDocumentOcrExtractionQuery(text: string): boolean {
  const t = normalizeKey(text);
  if (
    /\b(ocr|scan|scanned|typo|typos|correct|correction|extract|extraction|raw\s*text|0\/o|l\/1|misread|handwritten)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (
    /(स्क्यान|गल्ती|सच्याउ|निकाल|हस्तलिखित|ओसीआर|बीजक|रसिद)/.test(text)
  ) {
    return true;
  }
  return matchDocumentOcrExtraction(text) !== null;
}

function formatValidation(
  validation: Record<string, unknown>,
  lang: "nepali" | "english" | "mixed",
): string {
  const entries = Object.entries(validation);
  if (!entries.length) return "";
  const label = lang === "english" ? "Validation" : "जाँच";
  const bits = entries.map(([k, v]) => `${k}: ${String(v)}`);
  return `**${label}:** ${bits.join("; ")}`;
}

function summarizeExtracted(
  data: Record<string, unknown>,
  maxKeys = 8,
): string {
  const keys = Object.keys(data).slice(0, maxKeys);
  return keys
    .map((k) => {
      const v = data[k];
      if (v === null || v === undefined) return `${k}: —`;
      if (typeof v === "object") return `${k}: [${Array.isArray(v) ? `${(v as unknown[]).length} items` : "object"}]`;
      return `${k}: ${String(v)}`;
    })
    .join("; ");
}

export function formatDocumentOcrExtractionAnswer(
  entry: DocumentOcrExtraction,
  lang: "nepali" | "english" | "mixed",
): string {
  const errLabel = lang === "english" ? "Common OCR errors" : "सामान्य OCR गल्ती";
  const extractedLabel =
    lang === "english" ? "Extracted fields" : "निकालिएका फिल्ड";
  const correctedLabel =
    lang === "english" ? "Corrected text (summary)" : "सच्याइएको पाठ (सारांश)";

  const errors = entry.ocrErrors
    .map((e) => `${e.error} (e.g. ${e.examples.slice(0, 2).join(", ")})`)
    .join("; ");

  const correctedPreview = entry.correctedText
    .split("\n")
    .slice(0, 6)
    .join("\n");

  const validation = formatValidation(
    entry.validation as Record<string, unknown>,
    lang,
  );

  if (lang === "english") {
    return (
      `**${entry.documentType}** — OCR extraction golden (${entry.id})\n\n` +
      `**${errLabel}:** ${errors || "—"}\n\n` +
      `**${extractedLabel}:** ${summarizeExtracted(entry.extractedData as Record<string, unknown>)}\n\n` +
      `**${correctedLabel}:**\n${correctedPreview}` +
      (validation ? `\n\n${validation}` : "")
    );
  }

  return (
    `**${entry.documentType}** — OCR नमूना (${entry.id})\n\n` +
    `**${errLabel}:** ${errors || "—"}\n\n` +
    `**${extractedLabel}:** ${summarizeExtracted(entry.extractedData as Record<string, unknown>)}\n\n` +
    `**${correctedLabel}:**\n${correctedPreview}` +
    (validation ? `\n\n${validation}` : "")
  );
}

export type { DocumentOcrExtraction };
