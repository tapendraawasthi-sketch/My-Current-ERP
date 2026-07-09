/** SUTRA AI — Nepali-specific NLP processing */

import dictionary from "@/data/nepali/dictionary.json";
import contextRules from "@/data/nepali/context-rules.json";
import { transliterator } from "./Transliterator";
import { romanNepaliProcessor } from "./RomanNepaliProcessor";

type DictEntry = {
  romanVariants: string[];
  english: string;
  category: string;
  unit: string[];
  commonMisspellings: string[];
  frequency: number;
};

const VOCABULARY = dictionary.vocabulary as Record<string, DictEntry>;

export class NepaliProcessor {
  /** Look up a word in vocabulary (roman or Devanagari) */
  lookup(word: string): { nepali: string; entry: DictEntry } | null {
    const lower = word.toLowerCase();

    for (const [nepali, entry] of Object.entries(VOCABULARY)) {
      if (nepali === word) return { nepali, entry };
      if (entry.romanVariants.some((v) => v.toLowerCase() === lower)) return { nepali, entry };
      if (entry.commonMisspellings.some((m) => m.toLowerCase() === lower)) {
        return { nepali, entry };
      }
    }
    return null;
  }

  /** Find unknown words in token list */
  findUnknownWords(tokens: string[]): string[] {
    return tokens.filter((t) => {
      if (/^\d+$/.test(t)) return false;
      if (t.length <= 1) return false;
      return !this.lookup(t);
    });
  }

  /** Apply context rules to interpret patterns */
  applyContextRules(text: string): Array<{ rule: string; interpretation: string; confidence: number }> {
    const results: Array<{ rule: string; interpretation: string; confidence: number }> = [];
    const rules = (contextRules as { disambiguationRules?: Array<{
      word: string;
      precededBy?: string;
      context?: string;
      preferredSense: string;
      confidence: number;
    }> }).disambiguationRules ?? [];

    for (const rule of rules) {
      if (rule.precededBy === "number" && new RegExp(`\\d+\\s*${rule.word}`, "i").test(text)) {
        results.push({
          rule: rule.word,
          interpretation: rule.preferredSense,
          confidence: rule.confidence,
        });
      }
      if (rule.context && new RegExp(rule.word, "i").test(text)) {
        const contextMatch = new RegExp(rule.context, "i").test(text);
        if (contextMatch) {
          results.push({
            rule: rule.word,
            interpretation: rule.preferredSense,
            confidence: rule.confidence,
          });
        }
      }
    }

    return results;
  }

  /** Basic POS tagging for roman/Devanagari tokens */
  tagPartOfSpeech(token: string): string {
    const lookup = this.lookup(token);
    if (lookup) return lookup.entry.category;

    const lower = token.toLowerCase();
    if (/^\d+$/.test(token)) return "number";
    if (["ko", "le", "lai", "ma", "bata", "samma"].includes(lower)) return "postposition";
    if (["maile", "usle", "unle", "timile", "tapai", "hajur"].includes(lower)) return "pronoun";
    if (["bechye", "becheko", "kinyo", "kineko", "tiryo", "diye"].includes(lower)) return "verb";
    return "noun";
  }

  /** Convert processed text to standard Nepali script */
  toNepaliScript(text: string): string {
    if (/[\u0900-\u097F]/.test(text)) return text;
    const normalized = romanNepaliProcessor.normalize(text);
    return transliterator.romanToDevanagari(normalized);
  }

  /** Get English gloss for a word */
  toEnglish(word: string): string | null {
    const found = this.lookup(word);
    return found?.entry.english ?? null;
  }
}

export const nepaliProcessor = new NepaliProcessor();
