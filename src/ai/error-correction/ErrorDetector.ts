/** SUTRA AI — unified error detection across spelling, grammar, phonetic */

import type { DomainContext } from "../types";
import { grammarAnalyzer } from "./GrammarAnalyzer";
import { spellingCorrector } from "./SpellingCorrector";
import { phoneticMatcher } from "./PhoneticMatcher";
import { commonMisspellings } from "../knowledge/CommonMisspellings";
import { contextualMemory } from "../knowledge/ContextualMemory";
import { romanNepaliProcessor } from "../language/RomanNepaliProcessor";
import { nepaliVocabulary } from "../knowledge/NepaliVocabulary";

export type ErrorCategory = "spelling" | "grammar" | "phonetic" | "normalization" | "semantic" | "domain";

export interface DetectedError {
  category: ErrorCategory;
  original: string;
  corrected: string;
  token?: string;
  confidence: number;
  explanation: string;
  autoCorrect: boolean;
}

export class ErrorDetector {
  /** Scan original input for all error types */
  detectAll(
    originalInput: string,
    domainContext?: DomainContext,
  ): DetectedError[] {
    const errors: DetectedError[] = [];
    const tokens = this.tokenize(originalInput);

    // 1. Normalization drift (maele→maile, kakor→kakro)
    for (const token of tokens) {
      const drift = this.detectNormalizationDrift(token);
      if (drift) errors.push(drift);
    }

    // 2. Known misspelling patterns + learned corrections
    for (const token of tokens) {
      const known = commonMisspellings.lookup(token);
      if (known && known.wrong.toLowerCase() === token.toLowerCase()) {
        errors.push({
          category: "spelling",
          original: token,
          corrected: known.correct,
          token,
          confidence: known.frequency,
          explanation: `Known misspelling: "${known.wrong}" → "${known.correct}"`,
          autoCorrect: known.autoCorrect,
        });
      }

      const learned = contextualMemory.getLearnedCorrection(token);
      if (learned) {
        errors.push({
          category: "spelling",
          original: token,
          corrected: learned,
          token,
          confidence: 0.96,
          explanation: `Learned from your previous corrections`,
          autoCorrect: true,
        });
      }
    }

    // 3. Phonetic near-misses against vocabulary
    const corpus = nepaliVocabulary.getAllRomanForms();
    for (const token of tokens) {
      if (/^\d+$/.test(token) || token.length <= 2) continue;
      if (errors.some((e) => e.token === token)) continue;

      const phoneticMatches = phoneticMatcher.findMatches(token, corpus, 0.75);
      for (const match of phoneticMatches.slice(0, 2)) {
        const spellingCandidates = spellingCorrector.correctWord(token);
        const alreadyFound = spellingCandidates.some((c) => c.corrected === match.candidate);
        if (!alreadyFound && match.score >= 0.8) {
          errors.push({
            category: "phonetic",
            original: token,
            corrected: match.candidate,
            token,
            confidence: match.score,
            explanation: `Phonetic match (${match.method}): sounds like "${match.candidate}"`,
            autoCorrect: match.score >= 0.95,
          });
        }
      }
    }

    // 4. Grammar issues (full sentence)
    const grammarIssues = grammarAnalyzer.analyze(originalInput);
    for (const issue of grammarIssues) {
      errors.push({
        category: "grammar",
        original: issue.original,
        corrected: issue.suggested,
        confidence: issue.confidence,
        explanation: issue.explanation,
        autoCorrect: false,
      });
    }

    // 5. Domain context boost — vegetable names in grocery context
    if (domainContext?.businessType === "grocery" || domainContext?.recentTopics?.includes("vegetables")) {
      for (const err of errors) {
        if (err.category === "phonetic" || err.category === "normalization") {
          err.confidence = Math.min(1, err.confidence + 0.08);
        }
      }
    }

    return this.deduplicateErrors(errors);
  }

  /** Build fully corrected sentence from detected errors */
  applyCorrections(originalInput: string, errors: DetectedError[]): string {
    let result = originalInput;
    const tokenErrors = errors.filter((e) => e.token);

    for (const err of tokenErrors) {
      const re = new RegExp(`\\b${this.escapeRegex(err.token!)}\\b`, "i");
      result = result.replace(re, err.corrected);
    }

    return romanNepaliProcessor.normalize(result);
  }

  private detectNormalizationDrift(token: string): DetectedError | null {
    const clean = token.replace(/[^a-zA-Z\u0900-\u097F0-9]/g, "");
    if (!clean || /^\d+$/.test(clean)) return null;

    const normalized = romanNepaliProcessor.normalizeToken(clean);
    if (normalized === clean.toLowerCase()) return null;

    const phonetic = phoneticMatcher.similarity(clean, normalized);

    return {
      category: "normalization",
      original: clean,
      corrected: normalized,
      token: clean,
      confidence: Math.max(0.8, phonetic),
      explanation: `Spelling variant: "${clean}" → "${normalized}"`,
      autoCorrect: phonetic >= 0.92,
    };
  }

  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .map((t) => t.replace(/[^a-zA-Z\u0900-\u097F0-9]/g, ""))
      .filter(Boolean);
  }

  private deduplicateErrors(errors: DetectedError[]): DetectedError[] {
    const seen = new Map<string, DetectedError>();
    for (const err of errors) {
      const key = `${err.token ?? err.original}→${err.corrected}`;
      const existing = seen.get(key);
      if (!existing || err.confidence > existing.confidence) {
        seen.set(key, err);
      }
    }
    return [...seen.values()].sort((a, b) => b.confidence - a.confidence);
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

export const errorDetector = new ErrorDetector();
