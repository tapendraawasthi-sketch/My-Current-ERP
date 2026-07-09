/** SUTRA AI — known error patterns database */

import errorPatterns from "@/data/corrections/error-patterns.json";
import productAliases from "@/data/erp/product-aliases.json";

export interface MisspellingEntry {
  wrong: string;
  correct: string;
  nepali?: string;
  autoCorrect: boolean;
  frequency: number;
}

export class CommonMisspellings {
  private patterns: MisspellingEntry[] = [];

  constructor() {
    this.loadPatterns();
  }

  private loadPatterns(): void {
    const phonetic = (errorPatterns.spelling?.phonetic ?? []) as Array<{
      wrong: string;
      correct: string;
    }>;

    for (const p of phonetic) {
      this.patterns.push({
        wrong: p.wrong,
        correct: p.correct,
        autoCorrect: true,
        frequency: 0.7,
      });
    }

    const errorPatternsData = productAliases.errorPatterns as Record<string, {
      wrong: string;
      correct: string;
      nepali?: string;
      frequency: number;
      autoCorrect: boolean;
    }>;

    for (const entry of Object.values(errorPatternsData)) {
      this.patterns.push({
        wrong: entry.wrong,
        correct: entry.correct,
        nepali: entry.nepali,
        autoCorrect: entry.autoCorrect,
        frequency: entry.frequency,
      });
    }
  }

  lookup(wrong: string): MisspellingEntry | null {
    const lower = wrong.toLowerCase();
    return this.patterns.find((p) => p.wrong.toLowerCase() === lower) ?? null;
  }

  shouldAutoCorrect(wrong: string): boolean {
    const entry = this.lookup(wrong);
    return entry?.autoCorrect === true && (entry.frequency ?? 0) >= 0.7;
  }

  getAll(): MisspellingEntry[] {
    return [...this.patterns];
  }
}

export const commonMisspellings = new CommonMisspellings();
