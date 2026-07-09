/**
 * Nepal business document OCR schemas — sections, fields, layouts, validation.
 * Used for document-type detection, extraction hints, and Q&A about scanned docs.
 */

import {
  DOCUMENT_UNDERSTANDING_BY_TYPE,
  DOCUMENT_UNDERSTANDING_PATTERNS,
  DOCUMENT_UNDERSTANDING_TYPE_ALIASES,
  type DocumentUnderstandingPattern,
} from "./generated/runtimeMaps";

const BY_ID = new Map(DOCUMENT_UNDERSTANDING_PATTERNS.map((e) => [e.id, e]));

const ALIAS_KEYS = Object.keys(DOCUMENT_UNDERSTANDING_TYPE_ALIASES).sort(
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

export function getDocumentPatternById(id: string): DocumentUnderstandingPattern | null {
  return BY_ID.get(id) ?? null;
}

export function getDocumentPatternsByTypeKey(
  documentTypeKey: string,
): DocumentUnderstandingPattern[] {
  const ids = DOCUMENT_UNDERSTANDING_BY_TYPE[documentTypeKey] ?? [];
  return ids.map((id) => BY_ID.get(id)).filter(Boolean) as DocumentUnderstandingPattern[];
}

/** Match user text to a document type (returns first variant as representative). */
export function matchDocumentUnderstandingType(
  text: string,
): DocumentUnderstandingPattern | null {
  if (!text?.trim()) return null;
  const spaced = normalizeKey(text);

  for (const alias of ALIAS_KEYS) {
    const a = normalizeKey(alias);
    if (spaced === a || spaced.includes(a) || a.includes(spaced)) {
      const hit = DOCUMENT_UNDERSTANDING_TYPE_ALIASES[alias];
      if (hit) return getDocumentPatternById(hit.id);
    }
  }

  return null;
}

/** Document/OCR cue in user question. */
export function isDocumentUnderstandingQuery(text: string): boolean {
  const t = normalizeKey(text);
  if (
    /\b(ocr|scan|upload|extract|field|layout|validation|challan|cheque|check|passbook|thermal|invoice|receipt|purchase order|po number|pan certificate|bank statement)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return (
    /(स्क्यान|अपलोड|निकाल|खैर|फिल्ड|चेक|चलान|बिल|इनभ्वाइस|रसिद|पासबुक|बैंक\s*स्टेटमेन्ट)/.test(
      text,
    ) || matchDocumentUnderstandingType(text) !== null
  );
}

export function formatDocumentUnderstandingAnswer(
  entry: DocumentUnderstandingPattern,
  lang: "nepali" | "english" | "mixed",
  includeVariants = true,
): string {
  const variants = includeVariants
    ? getDocumentPatternsByTypeKey(entry.documentTypeKey)
    : [entry];

  const sections = [...new Set(variants.flatMap((v) => v.typicalSections))];
  const fields = [...new Set(variants.flatMap((v) => v.keyFieldsToExtract))];
  const layouts = [...new Set(variants.flatMap((v) => v.commonLayouts))];
  const challenges = [...new Set(variants.flatMap((v) => v.ocrChallenges))];
  const rules = [...new Set(variants.flatMap((v) => v.validationRules))];

  if (lang === "english") {
    return (
      `**${entry.documentType}** (${variants.length} layout variant${variants.length === 1 ? "" : "s"})\n\n` +
      `**Sections:** ${sections.join("; ")}\n\n` +
      `**Fields to extract:** ${fields.join(", ")}\n\n` +
      `**Common layouts:** ${layouts.join("; ")}\n\n` +
      `**OCR challenges:** ${challenges.join("; ")}\n\n` +
      `**Validation:** ${rules.join("; ")}`
    );
  }

  return (
    `**${entry.documentType}** (${variants.length} layout variant)\n\n` +
    `**भागहरू:** ${sections.join("; ")}\n\n` +
    `**निकाल्नुपर्ने फिल्ड:** ${fields.join(", ")}\n\n` +
    `**सामान्य layout:** ${layouts.join("; ")}\n\n` +
    `**OCR चुनौती:** ${challenges.join("; ")}\n\n` +
    `**जाँच नियम:** ${rules.join("; ")}`
  );
}

export type { DocumentUnderstandingPattern };
