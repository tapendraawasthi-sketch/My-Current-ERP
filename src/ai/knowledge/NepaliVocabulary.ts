/** SUTRA AI — Nepali word database access layer */

import dictionary from "@/data/nepali/dictionary.json";
import synonyms from "@/data/nepali/synonyms.json";

type VocabEntry = {
  romanVariants: string[];
  english: string;
  category: string;
  unit: string[];
  commonMisspellings: string[];
  frequency: number;
};

const VOCABULARY = dictionary.vocabulary as Record<string, VocabEntry>;
const SYNONYMS = synonyms as Record<string, string[]>;

export class NepaliVocabulary {
  search(query: string): Array<{ nepali: string; entry: VocabEntry }> {
    const lower = query.toLowerCase();
    const results: Array<{ nepali: string; entry: VocabEntry }> = [];

    for (const [nepali, entry] of Object.entries(VOCABULARY)) {
      if (
        nepali.includes(query) ||
        entry.english.toLowerCase().includes(lower) ||
        entry.romanVariants.some((v) => v.toLowerCase().includes(lower)) ||
        entry.commonMisspellings.some((m) => m.toLowerCase() === lower)
      ) {
        results.push({ nepali, entry });
      }
    }

    return results.sort((a, b) => b.entry.frequency - a.entry.frequency);
  }

  getSynonyms(nepaliWord: string): string[] {
    return SYNONYMS[nepaliWord] ?? [];
  }

  getAllRomanForms(): string[] {
    const forms: string[] = [];
    for (const entry of Object.values(VOCABULARY)) {
      forms.push(...entry.romanVariants, ...entry.commonMisspellings);
    }
    return forms;
  }

  getFrequency(word: string): number {
    for (const [nepali, entry] of Object.entries(VOCABULARY)) {
      if (
        nepali === word ||
        entry.romanVariants.some((v) => v.toLowerCase() === word.toLowerCase())
      ) {
        return entry.frequency;
      }
    }
    return 0.1;
  }
}

export const nepaliVocabulary = new NepaliVocabulary();
