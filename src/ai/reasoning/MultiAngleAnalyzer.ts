/** SUTRA AI — multiple perspective analysis framework */

import type { AnalysisDimension, IntentClassification, LanguageDetection, UserProfile } from "../types";
import { intentClassifier } from "../context/IntentClassifier";
import { domainKnowledge } from "../knowledge/DomainKnowledge";
import { nepaliVocabulary } from "../knowledge/NepaliVocabulary";
import { learningEngine } from "../learning/LearningEngine";

export type { AnalysisDimension };

export class MultiAngleAnalyzer {
  analyze(
    text: string,
    detection: LanguageDetection,
    previousTurns: string[] = [],
    profile?: UserProfile,
    intent?: IntentClassification,
  ): AnalysisDimension[] {
    const dimensions: AnalysisDimension[] = [];

    // Dimension 1: Linguistic
    const vocabMatches = nepaliVocabulary.search(text);
    dimensions.push({
      name: "LINGUISTIC ANALYSIS",
      findings: [
        `Language: ${detection.detected} (${(detection.confidence * 100).toFixed(0)}%)`,
        `Mixed: ${detection.mixedLanguage}`,
        `Vocabulary matches: ${vocabMatches.length}`,
      ],
      score: detection.confidence,
    });

    // Dimension 2: Domain
    const isAccounting = domainKnowledge.isAccountingContext(text);
    const txPattern = domainKnowledge.matchTransactionPattern(text);
    dimensions.push({
      name: "DOMAIN ANALYSIS",
      findings: [
        `Accounting context: ${isAccounting}`,
        txPattern ? `Transaction type: ${txPattern.type}` : "No transaction pattern",
      ],
      score: isAccounting || txPattern ? 0.9 : 0.3,
    });

    // Dimension 3: User Behavior
    const stats = learningEngine.getStats();
    dimensions.push({
      name: "USER BEHAVIOR ANALYSIS",
      findings: [
        `Previous turns: ${previousTurns.length}`,
        `User interactions: ${profile?.totalInteractions ?? 0}`,
        `Acceptance rate: ${((profile?.correctionAcceptanceRate ?? 0.85) * 100).toFixed(0)}%`,
        `Learned patterns: ${stats.autoCorrectPatterns}`,
        profile?.commonProducts?.length
          ? `Frequent products: ${profile.commonProducts.slice(0, 3).join(", ")}`
          : "No product history",
      ],
      score: profile ? Math.min(1, 0.5 + profile.correctionAcceptanceRate * 0.4) : 0.5,
    });

    // Dimension 4: Probabilistic
    const classified = intent ?? intentClassifier.classify(text, {});
    dimensions.push({
      name: "PROBABILISTIC ANALYSIS",
      findings: [
        `Intent: ${classified.intent} (${(classified.confidence * 100).toFixed(0)}%)`,
        `Entities: ${JSON.stringify(classified.entities)}`,
      ],
      score: classified.confidence,
    });

    // Dimension 5: Temporal
    const hasDate = /\b(aaja|aja|hijo|parsi|today|yesterday)\b/i.test(text);
    const futureDate = /\b(parsi|tomorrow|bholi)\b/i.test(text) && /\b(bech|kin|sold|bought)\b/i.test(text);
    dimensions.push({
      name: "TEMPORAL ANALYSIS",
      findings: [
        hasDate ? "Date reference detected" : "No date reference",
        futureDate ? "Warning: future date with past transaction" : "Timing OK",
      ],
      score: futureDate ? 0.3 : 0.8,
    });

    // Dimension 6: Numerical
    const amounts = text.match(/\d+/g) ?? [];
    const unreasonable = amounts.some((a) => parseInt(a, 10) > 10_000_000);
    dimensions.push({
      name: "NUMERICAL ANALYSIS",
      findings: [
        `Amounts found: ${amounts.join(", ") || "none"}`,
        unreasonable ? "Unusually large amount" : "Amount reasonable",
      ],
      score: unreasonable ? 0.4 : 0.85,
    });

    return dimensions;
  }
}

export const multiAngleAnalyzer = new MultiAngleAnalyzer();
