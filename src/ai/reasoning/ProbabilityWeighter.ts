/** SUTRA AI — option probability calculation */

import type { Suggestion } from "../types";
import { confidenceScorer } from "../error-correction/ConfidenceScorer";

export class ProbabilityWeighter {
  /** Normalize suggestion confidences to probability distribution */
  toDistribution(suggestions: Suggestion[]): Array<Suggestion & { probability: number }> {
    if (suggestions.length === 0) return [];

    const total = suggestions.reduce((sum, s) => sum + s.confidence, 0);
    if (total === 0) {
      const equal = 1 / suggestions.length;
      return suggestions.map((s) => ({ ...s, probability: equal }));
    }

    return suggestions.map((s) => ({
      ...s,
      probability: s.confidence / total,
    }));
  }

  /** Combine multiple factor scores into weighted probability */
  combineScores(scores: Record<string, number>, weights: Record<string, number>): number {
    let totalWeight = 0;
    let weighted = 0;
    for (const [key, score] of Object.entries(scores)) {
      const w = weights[key] ?? 1;
      weighted += score * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? weighted / totalWeight : 0;
  }

  /** Bayesian-style update: prior * likelihood */
  updateProbability(prior: number, likelihood: number): number {
    const posterior = prior * likelihood;
    const normalization = posterior + (1 - prior) * (1 - likelihood);
    return normalization > 0 ? posterior / normalization : prior;
  }
}

export const probabilityWeighter = new ProbabilityWeighter();
