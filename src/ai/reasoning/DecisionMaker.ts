/** SUTRA AI — final decision logic */

import type {
  AIResponse,
  AnalysisDimension,
  ExtractedEntities,
  IntentClassification,
  IntentType,
  LanguageCode,
  SuggestionResult,
} from "../types";
import { intentClarifier } from "../error-correction/IntentClarifier";
import { translationEngine } from "../language/TranslationEngine";
import { outputFormatter } from "../language/OutputFormatter";
import { actionExecutor } from "../actions/ActionExecutor";
import type { ChainOfThoughtResult } from "../types";

export class DecisionMaker {
  decide(
    input: string,
    reasoning: ChainOfThoughtResult,
    suggestions: SuggestionResult | null,
    outputLanguage: LanguageCode,
    intent?: IntentClassification,
    entities?: ExtractedEntities,
    sourceLanguage?: LanguageCode,
    dimensions?: AnalysisDimension[],
  ): AIResponse {
    const topSuggestion = suggestions?.suggestions[0];
    let confidence = topSuggestion?.confidence ?? reasoning.confidence ?? intent?.confidence ?? 0;

    const dimensionFlags = this.analyzeDimensions(dimensions);
    if (dimensionFlags.reduceConfidence) {
      confidence = Math.min(confidence, 0.82);
    }

    let needsClarification =
      suggestions?.requiresConfirmation === true &&
      !suggestions?.autoCorrect &&
      confidence < 0.95;

    if (dimensionFlags.forceClarify) {
      needsClarification = true;
      confidence = Math.min(confidence, 0.75);
    }

    const understoodInput = topSuggestion?.correctedText ?? input;
    const detectedSource = sourceLanguage ?? translationEngine.detectSource(understoodInput);
    const translations = translationEngine.translateAll(understoodInput, detectedSource);

    const response: AIResponse = {
      understood_input: understoodInput,
      confidence,
      needs_clarification: needsClarification,
      suggestions: (suggestions?.suggestions ?? []).map((s) => ({
        text: s.correctedText,
        confidence: s.confidence,
        explanation: s.explanation,
      })),
      response: translations,
      sourceLanguage: detectedSource,
    };

    const effectiveIntent = intent?.intent;
    const ent = entities ?? (intent?.entities as ExtractedEntities | undefined);

    if (
      effectiveIntent === "SALES_ENTRY" ||
      effectiveIntent === "PURCHASE_ENTRY" ||
      ent?.transactionType
    ) {
      response.transaction = {
        type:
          ent?.transactionType ??
          (effectiveIntent === "SALES_ENTRY" ? "sales" : "purchase"),
        product: ent?.productEnglish ?? ent?.product ?? topSuggestion?.metadata?.product,
        productNepali: ent?.productNepali,
        amount: ent?.amount ?? topSuggestion?.metadata?.amount,
        quantity: ent?.quantity,
        unit: ent?.unit,
        party: ent?.party,
      };
    }

    if (effectiveIntent === "RETURN_ENTRY") {
      response.transaction = {
        type: "return",
        product: ent?.product,
        productNepali: ent?.productNepali,
        amount: ent?.amount,
        quantity: ent?.quantity,
        unit: ent?.unit,
        party: ent?.party,
      };
    }

    if (outputLanguage !== "english") {
      const primary =
        outputLanguage === "nepali" ? translations.nepali : translations.roman;
      response.response = { ...translations, [outputLanguage]: primary };
    }

    response.followUp = this.buildFollowUp(effectiveIntent, ent, dimensionFlags);

    const actions = [
      ...actionExecutor.resolve(
        effectiveIntent,
        ent,
        understoodInput,
        needsClarification,
      ),
      ...(actionExecutor.resolveReport(effectiveIntent) ? [actionExecutor.resolveReport(effectiveIntent)!] : []),
    ];
    if (actions.length > 0) response.actions = actions;

    return response;
  }

  private analyzeDimensions(dimensions?: AnalysisDimension[]): {
    forceClarify: boolean;
    reduceConfidence: boolean;
    isConfused: boolean;
    unreasonableAmount: boolean;
  } {
    if (!dimensions?.length) {
      return { forceClarify: false, reduceConfidence: false, isConfused: false, unreasonableAmount: false };
    }

    const numerical = dimensions.find((d) => d.name === "NUMERICAL ANALYSIS");
    const temporal = dimensions.find((d) => d.name === "TEMPORAL ANALYSIS");
    const probabilistic = dimensions.find((d) => d.name === "PROBABILISTIC ANALYSIS");
    const domain = dimensions.find((d) => d.name === "DOMAIN ANALYSIS");

    const unreasonableAmount = numerical != null && numerical.score < 0.5;
    const futureDateIssue = temporal != null && temporal.score < 0.5;
    const lowIntent = probabilistic != null && probabilistic.score < 0.55;
    const weakDomain = domain != null && domain.score < 0.45;

    return {
      forceClarify: unreasonableAmount || futureDateIssue,
      reduceConfidence: lowIntent || weakDomain,
      isConfused: probabilistic != null && probabilistic.score < 0.6,
      unreasonableAmount,
    };
  }

  private buildFollowUp(
    intent?: IntentType,
    entities?: ExtractedEntities,
    flags?: { isConfused: boolean; unreasonableAmount: boolean },
  ): string | undefined {
    if (flags?.unreasonableAmount) {
      return "रकम धेरै ठूलो देखिन्छ — के यो सही हो?";
    }
    if (flags?.isConfused) {
      return "के तपाईं बिक्री, खरिद, वा रिपोर्टको बारेमा सोध्नुहुन्छ?";
    }
    if (
      (intent === "SALES_ENTRY" || intent === "PURCHASE_ENTRY") &&
      entities?.partyAmbiguous?.length
    ) {
      return `कुन पार्टी? ${entities.partyAmbiguous.join(" वा ")} — पूरा नाम लेख्नुहोस्।`;
    }
    if (
      (intent === "SALES_ENTRY" || intent === "PURCHASE_ENTRY") &&
      entities?.product &&
      entities?.amount &&
      !entities?.party
    ) {
      return "कसलाई बेच्नुभयो — नगद कि उधार? (जस्तै: `ram lai udhaar`)";
    }
    if (
      (intent === "SALES_ENTRY" || intent === "PURCHASE_ENTRY") &&
      entities?.product &&
      !entities?.amount &&
      !entities?.quantity
    ) {
      return "कति / कति रुपैयाँ? (जस्तै: `500 ko` वा `2 kg`)";
    }
    return undefined;
  }

  formatUserMessage(
    response: AIResponse,
    outputLanguage: LanguageCode,
    resolvedExplanation?: string,
    entities?: ExtractedEntities,
    showTranslation?: boolean,
    conversationalText?: string,
  ): { text: string; parallel?: ReturnType<typeof outputFormatter.format> } {
    if (response.needs_clarification && response.suggestions.length > 0) {
      const top = response.suggestions[0];
      return {
        text: intentClarifier.formatDidYouMean([
          {
            correctedText: top.text,
            confidence: top.confidence,
            correctionType: "spelling",
            explanation: top.explanation,
            displayText: response.response[outputLanguage] || top.text,
          },
        ]),
      };
    }

    const formatted = outputFormatter.format(
      response,
      outputLanguage,
      showTranslation ?? false,
      entities,
      resolvedExplanation,
    );

    let text = conversationalText ?? formatted.primary;

    if (response.followUp && !response.needs_clarification) {
      text = `${text}\n\n💬 ${response.followUp}`;
    }

    return {
      text,
      parallel: showTranslation ? formatted : undefined,
    };
  }
}

export const decisionMaker = new DecisionMaker();
