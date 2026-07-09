/** SUTRA AI — learning & adaptation engine (blueprint §9) */

import type { ExtractedEntities, IntentType, LearningStats, Suggestion, UserProfile } from "../types";
import { contextualMemory, type LearnedCorrection } from "../knowledge/ContextualMemory";
import { userProfileManager } from "../knowledge/UserProfileManager";
import { probabilityWeighter } from "../reasoning/ProbabilityWeighter";
import { feedbackCalibrator } from "./FeedbackCalibrator";

export class LearningEngine {
  /** Record correction acceptance/rejection */
  recordCorrection(
    original: string,
    corrected: string,
    accepted: boolean,
    context?: string,
  ): void {
    contextualMemory.recordCorrection(original, corrected, accepted, context);
    userProfileManager.syncMisspellingsFromMemory();
    userProfileManager.recordInteraction({ accepted, hadError: !accepted });
  }

  /** Update profile after each completed interaction */
  updateAfterInteraction(opts: {
    input: string;
    entities?: ExtractedEntities;
    intent?: IntentType;
    hadSuggestion?: boolean;
    acceptedSuggestion?: boolean;
    responseTimeMs?: number;
  }): UserProfile {
    userProfileManager.trackWordFrequency(opts.input);

    if (opts.entities?.product) {
      userProfileManager.trackProduct(opts.entities.product);
    }
    if (opts.entities?.party) {
      userProfileManager.trackParty(opts.entities.party);
    }
    if (opts.entities?.transactionType || opts.intent) {
      const type =
        opts.entities?.transactionType ??
        (opts.intent === "SALES_ENTRY"
          ? "sales"
          : opts.intent === "PURCHASE_ENTRY"
            ? "purchase"
            : undefined);
      if (type) userProfileManager.trackTransactionType(type);
    }

    userProfileManager.recordInteraction({
      hadError: opts.hadSuggestion && !opts.acceptedSuggestion,
      accepted: opts.acceptedSuggestion,
      responseTimeMs: opts.responseTimeMs,
    });

    return userProfileManager.getProfile();
  }

  /** Personalized suggestions boosted by user history */
  getPersonalizedSuggestions(
    suggestions: Suggestion[],
    profile?: UserProfile,
  ): Suggestion[] {
    const p = profile ?? userProfileManager.getProfile();
    const misspellings = { ...p.commonMisspellings, ...contextualMemory.getUserMisspellings() };

    return suggestions
      .map((s) => {
        let confidence = s.confidence;
        for (const [wrong, right] of Object.entries(misspellings)) {
          if (s.correctedText.includes(right) || s.explanation.includes(wrong)) {
            confidence = this.adjustConfidenceForUser(p, confidence, true);
          }
        }
        if (s.metadata?.product && p.commonProducts.includes(s.metadata.product)) {
          confidence = Math.min(1, confidence + 0.06);
        }
        confidence = feedbackCalibrator.applyBoost(confidence);
        return { ...s, confidence };
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  /** Adaptive confidence adjustment per blueprint §9.1 */
  adjustConfidenceForUser(
    profile: UserProfile,
    baseConfidence: number,
    isKnownPattern: boolean,
  ): number {
    let adjusted = baseConfidence;

    if (isKnownPattern) {
      adjusted = probabilityWeighter.updateProbability(adjusted, 0.95);
    }

    if (profile.correctionAcceptanceRate >= 0.9) {
      adjusted = Math.min(1, adjusted + 0.03);
    } else if (profile.correctionAcceptanceRate < 0.6) {
      adjusted = Math.max(0, adjusted - 0.05);
    }

    if (profile.errorRate > 0.3) {
      adjusted = Math.max(0, adjusted - 0.04);
    }

    return Math.min(1, Math.max(0, adjusted));
  }

  getStats(): LearningStats {
    const all = contextualMemory.getAll();
    const total = all.length;
    const avgRate =
      total > 0 ? all.reduce((s, c) => s + c.acceptanceRate, 0) / total : 0;
    const autoCount = all.filter((c) => c.autoCorrectThreshold).length;

    return {
      totalCorrections: all.reduce((s, c) => s + c.occurrences, 0),
      globalAcceptanceRate: avgRate,
      autoCorrectPatterns: autoCount,
      topMisspellings: all
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 5)
        .map((c) => ({
          original: c.original,
          corrected: c.corrected,
          rate: c.acceptanceRate,
        })),
    };
  }

  getGlobalPatterns(): LearnedCorrection[] {
    return contextualMemory.getAll().filter((c) => c.occurrences >= 3);
  }

  shouldAutoCorrect(word: string, profile?: UserProfile): boolean {
    if (!word) return false;
    const learned = contextualMemory.getLearnedCorrection(word);
    if (learned) return true;

    const p = profile ?? userProfileManager.getProfile();
    const personal = p.commonMisspellings[word.toLowerCase()];
    return Boolean(personal && p.correctionAcceptanceRate >= 0.85);
  }
}

export const learningEngine = new LearningEngine();
