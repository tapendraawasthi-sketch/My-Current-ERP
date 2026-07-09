/** SUTRA AI — multi-language spelling correction with phonetic ranking */

import productAliases from "@/data/erp/product-aliases.json";
import errorPatterns from "@/data/corrections/error-patterns.json";
import { nepaliProcessor } from "../language/NepaliProcessor";
import { romanNepaliProcessor } from "../language/RomanNepaliProcessor";
import { phoneticMatcher } from "./PhoneticMatcher";
import { nepaliVocabulary } from "../knowledge/NepaliVocabulary";
import { commonMisspellings } from "../knowledge/CommonMisspellings";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export interface SpellingCandidate {
  original: string;
  corrected: string;
  distance: number;
  phoneticScore: number;
  combinedScore: number;
  source: "product" | "pattern" | "vocabulary" | "normalization" | "phonetic" | "learned";
}

export class SpellingCorrector {
  /** Find spelling correction candidates for a single word */
  correctWord(word: string): SpellingCandidate[] {
    const candidates: SpellingCandidate[] = [];
    const lower = word.toLowerCase();

    const push = (
      corrected: string,
      distance: number,
      source: SpellingCandidate["source"],
    ) => {
      const phoneticScore = phoneticMatcher.similarity(lower, corrected);
      const editScore = 1 - distance / Math.max(lower.length, corrected.length, 1);
      const combinedScore = editScore * 0.4 + phoneticScore * 0.6;
      candidates.push({
        original: word,
        corrected,
        distance,
        phoneticScore,
        combinedScore,
        source,
      });
    };

    // Normalization map
    const normalized = romanNepaliProcessor.normalizeToken(lower);
    if (normalized !== lower) {
      push(normalized, levenshtein(lower, normalized), "normalization");
    }

    // Known patterns
    const known = commonMisspellings.lookup(lower);
    if (known) {
      push(known.correct, levenshtein(lower, known.correct), "learned");
    }

    const errorPatternsList = [
      ...(errorPatterns.spelling?.phonetic ?? []),
      ...(errorPatterns.spelling?.keyboard ?? []),
    ] as Array<{ wrong: string; correct: string }>;

    for (const pat of errorPatternsList) {
      if (pat.wrong.toLowerCase() === lower) {
        push(pat.correct, levenshtein(lower, pat.correct), "pattern");
      }
    }

    // Product catalog fuzzy match
    const vegetables = productAliases.vegetables as Record<string, {
      romanVariants: string[];
      commonMisspellings: string[];
    }>;

    for (const [, entry] of Object.entries(vegetables)) {
      const bestVariant = entry.romanVariants[0];
      const allForms = [...entry.romanVariants, ...entry.commonMisspellings];
      for (const form of allForms) {
        const dist = levenshtein(lower, form.toLowerCase());
        const phonetic = phoneticMatcher.similarity(lower, form);
        if ((dist <= 2 && dist > 0) || phonetic >= 0.8) {
          push(bestVariant, Math.min(dist, 2), "product");
          break;
        }
      }
    }

    // Vocabulary + phonetic corpus search
    if (!nepaliProcessor.lookup(word)) {
      const corpus = nepaliVocabulary.getAllRomanForms();
      const phoneticMatches = phoneticMatcher.findMatches(lower, corpus, 0.72);
      for (const match of phoneticMatches.slice(0, 3)) {
        push(match.candidate, levenshtein(lower, match.candidate), "phonetic");
      }

      for (const form of corpus) {
        const dist = levenshtein(lower, form);
        if (dist === 1) {
          push(form, dist, "vocabulary");
        }
      }
    }

    const seen = new Set<string>();
    return candidates
      .filter((c) => {
        if (seen.has(c.corrected)) return false;
        seen.add(c.corrected);
        return c.corrected !== lower;
      })
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /** Correct all misspelled words in a sentence */
  correctSentence(text: string): { corrected: string; changes: SpellingCandidate[] } {
    const tokens = text.split(/\s+/);
    const changes: SpellingCandidate[] = [];
    const corrected = tokens.map((token) => {
      const clean = token.replace(/[^a-zA-Z\u0900-\u097F0-9]/g, "");
      if (!clean || /^\d+$/.test(clean)) return token;

      const candidates = this.correctWord(clean);
      if (candidates.length > 0 && candidates[0].combinedScore >= 0.75) {
        changes.push(candidates[0]);
        return token.replace(clean, candidates[0].corrected);
      }
      return token;
    });

    return { corrected: corrected.join(" "), changes };
  }
}

export const spellingCorrector = new SpellingCorrector();
