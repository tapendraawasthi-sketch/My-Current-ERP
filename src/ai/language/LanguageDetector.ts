/** SUTRA AI — tri-language detection with confidence scoring */

import type { LanguageCode, LanguageDetection, LanguageSegment } from "../types";

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const ENGLISH_WORD_RE = /\b[a-zA-Z]{2,}\b/g;

const ROMAN_NEPALI_SIGNALS = [
  "maile", "maele", "bechye", "becheko", "kinyo", "kineko", "udhaar", "kharcha",
  "bikri", "kharid", "tarkari", "kakro", "kakor", "aalu", "pyaj", "nagad",
  "tapai", "hajur", "kasari", "k ho", "hunchha", "garnu", "bhannu", "sodh",
  "ko", "le", "lai", "ma", "cha", "chaina", "bhayo", "gayo", "khayo",
  "rupiya", "paisa", "hisaab", "kitab", "nafa", "noksan", "sampatti",
];

const ENGLISH_SIGNALS = [
  "the", "is", "are", "was", "what", "how", "when", "which", "should",
  "debit", "credit", "account", "journal", "ledger", "sales", "purchase",
  "profit", "loss", "asset", "liability", "expense", "income", "entry",
];

function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const sig of signals) {
    const re = new RegExp(`\\b${sig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) count += 1;
  }
  return count;
}

function hasDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

function devanagariRatio(text: string): number {
  const chars = [...text.replace(/\s/g, "")];
  if (chars.length === 0) return 0;
  const deva = chars.filter((c) => DEVANAGARI_RE.test(c)).length;
  return deva / chars.length;
}

function segmentByLanguage(text: string): LanguageSegment[] {
  const segments: LanguageSegment[] = [];
  const words = text.split(/(\s+)/);
  let index = 0;

  for (const word of words) {
    if (!word.trim()) {
      index += word.length;
      continue;
    }

    let lang: LanguageCode;
    if (DEVANAGARI_RE.test(word)) {
      lang = "nepali";
    } else if (/^[a-zA-Z]+$/.test(word)) {
      const isRomanNepali = ROMAN_NEPALI_SIGNALS.some((s) =>
        word.toLowerCase().includes(s.toLowerCase()),
      );
      lang = isRomanNepali ? "roman" : "english";
    } else if (/^\d+$/.test(word)) {
      lang = "english";
    } else {
      lang = "roman";
    }

    segments.push({
      text: word,
      language: lang,
      startIndex: index,
      endIndex: index + word.length,
    });
    index += word.length;
  }

  return segments;
}

export class LanguageDetector {
  private cache = new Map<string, LanguageDetection>();
  private static MAX_CACHE = 128;

  detect(text: string): LanguageDetection {
    const trimmed = text.trim();
    if (!trimmed) {
      return { detected: "english", confidence: 0.5, mixedLanguage: false, segments: [] };
    }

    const cached = this.cache.get(trimmed);
    if (cached) return cached;

    const result = this.detectUncached(trimmed);
    if (this.cache.size >= LanguageDetector.MAX_CACHE) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(trimmed, result);
    return result;
  }

  private detectUncached(trimmed: string): LanguageDetection {

    const segments = segmentByLanguage(trimmed);
    const devaRatio = devanagariRatio(trimmed);
    const romanScore = countSignals(trimmed, ROMAN_NEPALI_SIGNALS);
    const englishScore = countSignals(trimmed, ENGLISH_SIGNALS);
    const englishWords = (trimmed.match(ENGLISH_WORD_RE) ?? []).length;

    const langCounts = { english: 0, nepali: 0, roman: 0 };
    for (const seg of segments) {
      langCounts[seg.language] += seg.text.length;
    }

    let detected: LanguageCode;
    let confidence: number;

    if (devaRatio > 0.3) {
      detected = "nepali";
      confidence = Math.min(0.99, 0.7 + devaRatio * 0.3);
    } else if (romanScore > englishScore && romanScore > 0) {
      detected = "roman";
      confidence = Math.min(0.95, 0.6 + romanScore * 0.08);
    } else if (englishScore > romanScore || englishWords > 2) {
      detected = "english";
      confidence = Math.min(0.95, 0.65 + englishScore * 0.05 + englishWords * 0.02);
    } else if (romanScore > 0) {
      detected = "roman";
      confidence = 0.75;
    } else {
      detected = "english";
      confidence = 0.6;
    }

    const uniqueLangs = new Set(segments.map((s) => s.language));
    const mixedLanguage = uniqueLangs.size > 1;

    if (mixedLanguage) {
      confidence *= 0.9;
    }

    return { detected, confidence, mixedLanguage, segments };
  }
}

export const languageDetector = new LanguageDetector();

export function detectLanguage(text: string): LanguageDetection {
  return languageDetector.detect(text);
}
