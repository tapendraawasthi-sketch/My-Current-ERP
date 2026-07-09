/** SUTRA AI — smart suggestion engine with "Did you mean?" logic */

import type { DomainContext, ExtractedEntities, SessionState, Suggestion, SuggestionResult } from "../types";
import { errorDetector } from "./ErrorDetector";
import { spellingCorrector } from "./SpellingCorrector";
import { confidenceScorer } from "./ConfidenceScorer";
import { phoneticMatcher } from "./PhoneticMatcher";
import { nepaliProcessor } from "../language/NepaliProcessor";
import { romanNepaliProcessor } from "../language/RomanNepaliProcessor";
import { transliterator } from "../language/Transliterator";
import { translationEngine } from "../language/TranslationEngine";
import { domainKnowledge } from "../knowledge/DomainKnowledge";
import { productCatalog } from "../knowledge/ProductCatalog";
import productAliases from "@/data/erp/product-aliases.json";
import { learningEngine } from "../learning/LearningEngine";
import { userProfileManager } from "../knowledge/UserProfileManager";
import { feedbackCalibrator } from "../learning/FeedbackCalibrator";

export class SuggestionEngine {
  analyze(
    input: string,
    domainContext?: DomainContext,
    userMisspellings?: Record<string, string>,
    entities?: ExtractedEntities,
    session?: SessionState,
  ): SuggestionResult {
    const normalized = romanNepaliProcessor.normalize(input);
    const detectedErrors = errorDetector.detectAll(input, domainContext);
    const suggestions: Suggestion[] = [];

    // Build primary suggestion from all detected errors
    if (detectedErrors.length > 0) {
      const correctedText = errorDetector.applyCorrections(input, detectedErrors);
      const primarySuggestion = this.buildFullSuggestion(
        input,
        correctedText,
        detectedErrors,
        domainContext,
        userMisspellings,
        entities,
        session,
      );
      suggestions.push(primarySuggestion);

      // Alternative: keep original word as new product
      const tokenErrors = detectedErrors.filter((e) => e.token);
      if (tokenErrors.length > 0) {
        const err = tokenErrors[0];
        suggestions.push({
          correctedText: input,
          confidence: 0.12,
          correctionType: "new_product",
          explanation: `Add "${err.original}" as a new product in your inventory`,
          displayText: `📦 Add "${err.original}" as new product`,
          metadata: { product: err.original },
        });
      }
    }

    // Fallback: unknown words not caught by error detector
    const tokens = input.toLowerCase().split(/\s+/).map((t) => t.replace(/[^a-z\u0900-\u097F0-9]/g, "")).filter(Boolean);
    const unknownWords = nepaliProcessor.findUnknownWords(
      normalized.toLowerCase().split(/\s+/).filter(Boolean),
    );

    // Also flag original tokens that differ from normalized
    const driftWords = detectedErrors
      .filter((e) => e.category === "normalization" || e.category === "spelling" || e.category === "phonetic")
      .map((e) => e.original);

    const allUnknown = [...new Set([...unknownWords, ...driftWords])];

    if (suggestions.length === 0) {
      for (const word of allUnknown) {
        suggestions.push(...this.buildWordSuggestions(word, input, normalized, domainContext, userMisspellings));
      }
    }

    if (suggestions.length === 0) {
      const { corrected, changes } = spellingCorrector.correctSentence(input);
      for (const change of changes) {
        suggestions.push(this.buildChangeSuggestion(input, corrected, change, domainContext, userMisspellings));
      }
    }

    const ranked = confidenceScorer.rankSuggestions(
      learningEngine.getPersonalizedSuggestions(suggestions, userProfileManager.getProfile()),
    );
    const topConfidence = ranked[0]?.confidence ?? 0;
    const calThresholds = feedbackCalibrator.getThresholds();
    const action = confidenceScorer.decideAction(topConfidence, calThresholds);
    const topError = detectedErrors[0];
    const shouldAutoCorrect =
      action === "auto_correct" ||
      (topError?.autoCorrect === true && topConfidence >= 0.92) ||
      (topError != null &&
        learningEngine.shouldAutoCorrect(topError.original, userProfileManager.getProfile()));

    return {
      originalInput: input,
      suggestions: action === "multiple_suggestions" || action === "clarify"
        ? ranked.slice(0, 3)
        : ranked.slice(0, 2),
      autoCorrect: shouldAutoCorrect,
      requiresConfirmation: !shouldAutoCorrect && ranked.length > 0 && topConfidence >= 0.5,
      unknownWords: allUnknown.length > 0 ? allUnknown : undefined,
    };
  }

  private buildFullSuggestion(
    originalInput: string,
    correctedText: string,
    errors: ReturnType<typeof errorDetector.detectAll>,
    domainContext?: DomainContext,
    userMisspellings?: Record<string, string>,
    entities?: ExtractedEntities,
    session?: SessionState,
  ): Suggestion {
    const normalized = romanNepaliProcessor.normalize(correctedText);
    const nepaliScript = transliterator.romanToDevanagari(normalized);
    const english = translationEngine.translate(normalized, "roman", "english");
    const txPattern = domainKnowledge.matchTransactionPattern(normalized);

    const avgConfidence =
      errors.reduce((sum, e) => sum + e.confidence, 0) / errors.length;

    const productToken = errors.find((e) => e.token && e.category !== "grammar")?.corrected;
    const productInfo = productToken ? productCatalog.findProduct(productToken) : null;
    const amountMatch = normalized.match(/(\d+)\s*ko/i);

    const contextProductMatch =
      session?.lastProduct &&
      (productToken === session.lastProduct ||
        correctedText.includes(session.lastProduct));

    const factors = {
      editDistance: avgConfidence,
      phoneticSimilarity: errors.some((e) => e.category === "phonetic")
        ? 0.95
        : phoneticMatcher.similarity(originalInput, correctedText),
      contextRelevance: contextProductMatch
        ? 0.96
        : domainContext?.recentTopics?.includes("vegetables")
          ? 0.92
          : 0.7,
      frequencyInCorpus: 0.75,
      userHistoryMatch: errors.some((e) => userMisspellings?.[e.original]) ? 1 : 0,
      domainRelevance: txPattern || productInfo ? 0.95 : 0.6,
    };

    const confidence = confidenceScorer.calculate(factors);

    const errorSummary = errors
      .filter((e) => e.token)
      .map((e) => `"${e.original}" → "${e.corrected}"`)
      .join(", ");

    return {
      correctedText: normalized,
      confidence,
      correctionType: errors[0]?.category ?? "spelling",
      explanation: errorSummary || errors[0]?.explanation || "Suggested correction",
      displayText: `${nepaliScript}\n"${english}"`,
      metadata: {
        product: productInfo?.entry.english ?? entities?.product ?? productToken,
        amount: entities?.amount ?? (amountMatch ? parseInt(amountMatch[1], 10) : undefined),
        transactionType:
          entities?.transactionType ??
          (txPattern?.type === "sales" ? "sales" : txPattern?.type === "purchase" ? "purchase" : undefined),
      },
    };
  }

  private buildWordSuggestions(
    word: string,
    originalInput: string,
    normalizedInput: string,
    domainContext?: DomainContext,
    userMisspellings?: Record<string, string>,
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const candidates = spellingCorrector.correctWord(word);

    for (const candidate of candidates.slice(0, 2)) {
      const correctedInput = normalizedInput.replace(
        new RegExp(`\\b${word}\\b`, "i"),
        candidate.corrected,
      );
      suggestions.push(
        this.buildChangeSuggestion(originalInput, correctedInput, candidate, domainContext, userMisspellings, word),
      );
    }

    if (candidates.length === 0) {
      suggestions.push({
        correctedText: originalInput,
        confidence: 0.15,
        correctionType: "new_product",
        explanation: `Add "${word}" as a new product in your inventory`,
        displayText: `📦 Add "${word}" as new product`,
      });
    }

    return suggestions;
  }

  private buildChangeSuggestion(
    originalInput: string,
    correctedText: string,
    change: { original: string; corrected: string; distance: number; phoneticScore: number; source: string },
    domainContext?: DomainContext,
    userMisspellings?: Record<string, string>,
    word?: string,
  ): Suggestion {
    const nepaliScript = transliterator.romanToDevanagari(correctedText);
    const english = translationEngine.translate(correctedText, "roman", "english");
    const productInfo = this.getProductInfo(change.corrected);
    const amountMatch = correctedText.match(/(\d+)\s*ko/i);

    const confidence = confidenceScorer.calculate({
      editDistance: confidenceScorer.editDistanceScore(
        change.distance,
        Math.max(change.original.length, change.corrected.length),
      ),
      phoneticSimilarity: change.phoneticScore ?? phoneticMatcher.similarity(change.original, change.corrected),
      contextRelevance: domainContext?.recentTopics?.includes("vegetables") ? 0.92 : 0.6,
      frequencyInCorpus: productInfo?.frequency ?? 0.5,
      userHistoryMatch: userMisspellings?.[word ?? change.original] === change.corrected ? 1 : 0,
      domainRelevance: productInfo ? 0.95 : 0.3,
    });

    return {
      correctedText,
      confidence,
      correctionType: change.source,
      explanation: `"${word ?? change.original}" → "${change.corrected}" (${productInfo?.english ?? "correction"})`,
      displayText: `${nepaliScript}\n"${english}"`,
      metadata: {
        product: change.corrected,
        amount: amountMatch ? parseInt(amountMatch[1], 10) : undefined,
        transactionType: /bech|bikri|sold/i.test(originalInput) ? "sales" : undefined,
      },
    };
  }

  private getProductInfo(word: string): { english: string; frequency: number } | null {
    const vegetables = productAliases.vegetables as Record<string, {
      english: string;
      frequency: number;
      romanVariants: string[];
    }>;

    for (const entry of Object.values(vegetables)) {
      if (entry.romanVariants.some((v) => v.toLowerCase() === word.toLowerCase())) {
        return { english: entry.english, frequency: entry.frequency };
      }
    }
    return null;
  }
}

export const suggestionEngine = new SuggestionEngine();
