/** SUTRA AI — step-by-step chain-of-thought reasoning */

import type { ChainOfThoughtResult, ExtractedEntities, IntentClassification, ReasoningStep, SuggestionResult, UserProfile } from "../types";
import { languageDetector } from "../language/LanguageDetector";
import { romanNepaliProcessor } from "../language/RomanNepaliProcessor";
import { nepaliProcessor } from "../language/NepaliProcessor";
import { productCatalog } from "../knowledge/ProductCatalog";
import { domainKnowledge } from "../knowledge/DomainKnowledge";
import { transliterator } from "../language/Transliterator";
import { translationEngine } from "../language/TranslationEngine";
import { learningEngine } from "../learning/LearningEngine";
import { userProfileManager } from "../knowledge/UserProfileManager";

export class ChainOfThought {
  process(
    input: string,
    contextHints?: {
      businessType?: string;
      recentTopics?: string[];
      userMisspellings?: Record<string, string>;
      profile?: UserProfile;
      entities?: ExtractedEntities;
      intent?: IntentClassification;
      suggestions?: SuggestionResult;
    },
  ): ChainOfThoughtResult {
    const steps: ReasoningStep[] = [];

    // Step 1: Tokenization & Normalization
    const detection = languageDetector.detect(input);
    const normalized = romanNepaliProcessor.normalize(input);
    const tokens = normalized.toLowerCase().split(/\s+/).filter(Boolean);

    steps.push({
      step: 1,
      name: "TOKENIZATION & NORMALIZATION",
      detail: `Tokens: ${JSON.stringify(tokens)}; Language: ${detection.detected} (${(detection.confidence * 100).toFixed(0)}%)`,
      data: { tokens, normalized, detection },
    });

    // Step 2: Part-of-Speech Tagging
    const posTags = tokens.map((t) => ({
      token: t,
      pos: nepaliProcessor.tagPartOfSpeech(t),
    }));

    steps.push({
      step: 2,
      name: "PART-OF-SPEECH TAGGING",
      detail: posTags.map((p) => `${p.token} → ${p.pos}`).join(", "),
      data: { posTags },
    });

    // Step 3: Syntactic Analysis
    const pattern = domainKnowledge.matchTransactionPattern(normalized);
    steps.push({
      step: 3,
      name: "SYNTACTIC ANALYSIS",
      detail: pattern
        ? `Pattern matched: ${pattern.patternId} (${pattern.type})`
        : "No transaction pattern matched",
      data: { pattern },
    });

    // Step 4: Semantic Role Labeling
    const entities: Record<string, unknown> = {};
    if (pattern?.fields) {
      Object.assign(entities, pattern.fields);
    }

    const amountMatch = normalized.match(/(\d+)\s*ko/i);
    if (amountMatch) entities.value = parseInt(amountMatch[1], 10);

    steps.push({
      step: 4,
      name: "SEMANTIC ROLE LABELING",
      detail: Object.entries(entities)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") || "No entities extracted",
      data: { entities },
    });

    // Step 5: Unknown Word Resolution
    const unknownWords = nepaliProcessor.findUnknownWords(tokens);
    const resolutions: Array<{ word: string; candidate: string; confidence: number }> = [];

    for (const word of unknownWords) {
      const product = productCatalog.findProduct(word, contextHints?.businessType);
      if (product) {
        resolutions.push({
          word,
          candidate: product.entry.romanVariants[0],
          confidence: product.confidence,
        });
      }
    }

    steps.push({
      step: 5,
      name: "UNKNOWN WORD RESOLUTION",
      detail:
        resolutions.length > 0
          ? resolutions.map((r) => `"${r.word}" → "${r.candidate}" (${(r.confidence * 100).toFixed(0)}%)`).join("; ")
          : unknownWords.length > 0
            ? `Unknown: ${unknownWords.join(", ")}`
            : "All words recognized",
      data: { unknownWords, resolutions },
    });

    // Step 6: Context Integration
    const contextRules = nepaliProcessor.applyContextRules(normalized);
    steps.push({
      step: 6,
      name: "CONTEXT INTEGRATION",
      detail: contextRules.map((r) => r.interpretation).join("; ") || "No context rules applied",
      data: { contextHints, contextRules },
    });

    // Step 7: Confidence Scoring (uses pre-computed suggestions — no duplicate analyze)
    const suggestions = contextHints?.suggestions ?? {
      originalInput: input,
      suggestions: [],
      autoCorrect: false,
      requiresConfirmation: false,
    };

    const profile = contextHints?.profile ?? userProfileManager.getProfile();
    let topConfidence = suggestions.suggestions[0]?.confidence ?? detection.confidence;

    // Sprint 5: learning-adjusted confidence
    if (suggestions.suggestions[0]) {
      const personalized = learningEngine.getPersonalizedSuggestions(
        suggestions.suggestions,
        profile,
      );
      topConfidence = personalized[0]?.confidence ?? topConfidence;
      topConfidence = learningEngine.adjustConfidenceForUser(
        profile,
        topConfidence,
        learningEngine.shouldAutoCorrect(
          suggestions.unknownWords?.[0] ?? "",
          profile,
        ),
      );
    }

    steps.push({
      step: 7,
      name: "CONFIDENCE SCORING",
      detail: `Top confidence: ${(topConfidence * 100).toFixed(0)}% (learning-adjusted)`,
      data: { suggestions: suggestions.suggestions, profile: profile.userId },
    });

    // Step 8: Decision
    const action = topConfidence >= 0.95
      ? "auto-correct"
      : topConfidence >= 0.85
        ? "single suggestion"
        : topConfidence >= 0.7
          ? "multiple suggestions"
          : "clarify";

    steps.push({
      step: 8,
      name: "DECISION",
      detail: `Action: ${action}`,
      data: { action, topConfidence },
    });

    // Step 9: Final Interpretation
    const correctedText = suggestions.suggestions[0]?.correctedText ?? normalized;
    const nepaliScript = transliterator.romanToDevanagari(correctedText);
    const english = translationEngine.translate(correctedText, detection.detected, "english");

    steps.push({
      step: 9,
      name: "RESPONSE FORMATTING",
      detail: `${nepaliScript} — "${english}"`,
      data: { nepaliScript, english },
    });

    const stats = learningEngine.getStats();
    steps.push({
      step: 10,
      name: "LEARNING INTEGRATION",
      detail: [
        `User: ${profile.userId}`,
        `Interactions: ${profile.totalInteractions}`,
        `Learned corrections: ${stats.totalCorrections}`,
        `Auto-correct patterns: ${stats.autoCorrectPatterns}`,
      ].join("; "),
      data: { stats, profile: { acceptanceRate: profile.correctionAcceptanceRate } },
    });

    return {
      steps,
      finalInterpretation: nepaliScript,
      confidence: topConfidence,
      entities,
    };
  }
}

export const chainOfThought = new ChainOfThought();
