/** SUTRA AI — Roman Nepali normalization processor */

import romanMappings from "@/data/nepali/roman-mappings.json";

const NORMALIZATION_MAP: Record<string, string> = romanMappings.normalization ?? {};

export class RomanNepaliProcessor {
  private normalizationMap: Record<string, string>;

  constructor(customMap?: Record<string, string>) {
    this.normalizationMap = { ...NORMALIZATION_MAP, ...customMap };
  }

  /** Normalize a single roman token */
  normalizeToken(token: string): string {
    const lower = token.toLowerCase().replace(/[^a-z0-9]/g, "");
    return this.normalizationMap[lower] ?? lower;
  }

  /** Normalize full roman Nepali text token by token */
  normalize(text: string): string {
    return text
      .split(/\s+/)
      .map((token) => {
        const cleaned = token.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, "");
        if (!cleaned) return token;
        const normalized = this.normalizeToken(cleaned);
        return normalized !== cleaned.toLowerCase() ? normalized : token;
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Tokenize and return normalized tokens */
  tokenize(text: string): string[] {
    return this.normalize(text)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  /** Check if text appears to be roman Nepali */
  isRomanNepali(text: string): boolean {
    const tokens = text.toLowerCase().split(/\s+/);
    let matchCount = 0;
    for (const token of tokens) {
      if (NORMALIZATION_MAP[token]) matchCount++;
    }
    return matchCount >= 1 || matchCount / Math.max(tokens.length, 1) > 0.2;
  }

  addMapping(variant: string, normalized: string): void {
    this.normalizationMap[variant.toLowerCase()] = normalized.toLowerCase();
  }
}

export const romanNepaliProcessor = new RomanNepaliProcessor();
