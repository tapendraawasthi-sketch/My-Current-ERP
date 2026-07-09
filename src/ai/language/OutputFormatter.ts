/** SUTRA AI — output formatting for selected language + parallel display */

import type {
  AIResponse,
  ExtractedEntities,
  LanguageCode,
  ParallelTranslation,
  TransactionEntity,
} from "../types";
import { translationEngine } from "./TranslationEngine";

export interface FormattedOutput {
  primary: string;
  parallel: ParallelTranslation;
  showParallel: boolean;
}

export class OutputFormatter {
  format(
    response: AIResponse,
    outputLanguage: LanguageCode,
    showTranslation: boolean,
    entities?: ExtractedEntities,
    resolvedExplanation?: string,
  ): FormattedOutput {
    if (response.needs_clarification) {
      const parallel = response.response;
      return {
        primary: parallel[outputLanguage] || parallel.nepali,
        parallel: {
          ...parallel,
          sourceLanguage: parallel.english ? "roman" : "nepali",
          targetLanguage: outputLanguage,
        },
        showParallel: showTranslation,
      };
    }

    if (response.transaction?.type) {
      const parallel = translationEngine.formatTransaction(
        response.transaction,
        outputLanguage,
      );
      const lines = [
        resolvedExplanation ? `↪ ${resolvedExplanation}` : null,
        parallel[outputLanguage],
      ].filter(Boolean);

      return {
        primary: lines.join("\n"),
        parallel: {
          english: parallel.english,
          nepali: parallel.nepali,
          roman: parallel.roman,
          sourceLanguage: "roman",
          targetLanguage: outputLanguage,
        },
        showParallel: showTranslation,
      };
    }

    if (entities && (entities.product || entities.amount)) {
      const parallel = translationEngine.formatFromEntities(entities, outputLanguage);
      return {
        primary: parallel.primary,
        parallel: {
          english: parallel.english,
          nepali: parallel.nepali,
          roman: parallel.roman,
          sourceLanguage: parallel.sourceLanguage,
          targetLanguage: outputLanguage,
        },
        showParallel: showTranslation,
      };
    }

    const parallel = {
      ...response.response,
      sourceLanguage: "roman" as LanguageCode,
      targetLanguage: outputLanguage,
    };

    return {
      primary: response.response[outputLanguage] || response.response.nepali,
      parallel,
      showParallel: showTranslation,
    };
  }

  /** Labels for parallel translation UI */
  getParallelLabels(): Record<LanguageCode, string> {
    return {
      english: "EN",
      nepali: "नेप",
      roman: "Roman",
    };
  }

  /** Which languages to show alongside primary in parallel mode */
  getSecondaryLanguages(
    outputLanguage: LanguageCode,
  ): Array<keyof Pick<ParallelTranslation, "english" | "nepali" | "roman">> {
    const all: Array<keyof Pick<ParallelTranslation, "english" | "nepali" | "roman">> = [
      "english",
      "nepali",
      "roman",
    ];
    return all.filter((l) => l !== outputLanguage);
  }
}

export const outputFormatter = new OutputFormatter();
