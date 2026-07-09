/** SUTRA AI — confidence scoring for suggestions */

import type { ConfidenceFactors, Suggestion } from "../types";
import { phoneticMatcher } from "./PhoneticMatcher";

const WEIGHTS = {
  editDistance: 0.2,
  phoneticSimilarity: 0.25,
  contextRelevance: 0.25,
  frequencyInCorpus: 0.15,
  userHistoryMatch: 0.1,
  domainRelevance: 0.05,
};

export class ConfidenceScorer {
  calculate(factors: ConfidenceFactors): number {
    const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    const score =
      factors.editDistance * WEIGHTS.editDistance +
      factors.phoneticSimilarity * WEIGHTS.phoneticSimilarity +
      factors.contextRelevance * WEIGHTS.contextRelevance +
      factors.frequencyInCorpus * WEIGHTS.frequencyInCorpus +
      factors.userHistoryMatch * WEIGHTS.userHistoryMatch +
      factors.domainRelevance * WEIGHTS.domainRelevance;
    return Math.min(1, Math.max(0, score / totalWeight));
  }

  editDistanceScore(distance: number, maxLen: number): number {
    if (maxLen === 0) return 0;
    return Math.max(0, 1 - distance / maxLen);
  }

  phoneticScore(original: string, candidate: string): number {
    return phoneticMatcher.similarity(original, candidate);
  }

  /** Apply decision rules from blueprint (thresholds adjustable via feedback) */
  decideAction(
    confidence: number,
    thresholds?: { autoCorrect?: number; singleSuggestion?: number; multipleSuggestions?: number },
  ): "auto_correct" | "single_suggestion" | "multiple_suggestions" | "clarify" {
    const auto = thresholds?.autoCorrect ?? 0.95;
    const single = thresholds?.singleSuggestion ?? 0.85;
    const multi = thresholds?.multipleSuggestions ?? 0.7;
    if (confidence >= auto) return "auto_correct";
    if (confidence >= single) return "single_suggestion";
    if (confidence >= multi) return "multiple_suggestions";
    if (confidence >= 0.5) return "multiple_suggestions";
    return "clarify";
  }

  rankSuggestions(suggestions: Suggestion[]): Suggestion[] {
    return [...suggestions].sort((a, b) => b.confidence - a.confidence);
  }
}

export const confidenceScorer = new ConfidenceScorer();
