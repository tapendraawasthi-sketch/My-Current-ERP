/** SUTRA AI — multi-step reasoning processor */

import type { ChainOfThoughtResult, ExtractedEntities, IntentClassification, ProcessInputOptions, SuggestionResult } from "../types";
import { chainOfThought } from "../reasoning/ChainOfThought";
import { multiAngleAnalyzer } from "../reasoning/MultiAngleAnalyzer";
import { languageDetector } from "../language/LanguageDetector";
import { userProfileManager } from "../knowledge/UserProfileManager";
import type { ContextManager } from "./ContextManager";

export class ReasoningEngine {
  constructor(private contextManager: ContextManager) {}

  reason(
    input: string,
    options?: ProcessInputOptions,
    entities?: ExtractedEntities,
    intent?: IntentClassification,
    suggestions?: SuggestionResult,
  ): ChainOfThoughtResult {
    const hints = this.contextManager.getContextHints();
    const profile = userProfileManager.getProfile();
    const detection = languageDetector.detect(input);
    const previousTurns = this.contextManager
      .getRecentTurns(5)
      .filter((t) => t.role === "user")
      .map((t) => t.content);

    const cotResult = chainOfThought.process(input, {
      businessType: options?.domainContext?.businessType ?? hints.businessType,
      recentTopics: options?.domainContext?.recentTopics ?? hints.recentTopics,
      userMisspellings: { ...hints.userMisspellings, ...profile.commonMisspellings },
      profile,
      entities,
      intent,
      suggestions,
    });

    if (entities) {
      cotResult.entities = { ...cotResult.entities, ...entities };
    }

    const dimensions = multiAngleAnalyzer.analyze(
      input,
      detection,
      previousTurns,
      profile,
      intent,
    );

    let stepNum = cotResult.steps.length + 1;
    cotResult.steps.push({
      step: stepNum++,
      name: "MULTI-ANGLE ANALYSIS",
      detail: dimensions.map((d) => `${d.name}: ${(d.score * 100).toFixed(0)}%`).join("; "),
      data: { dimensions },
    });

    cotResult.dimensions = dimensions;

    if (intent) {
      cotResult.steps.push({
        step: stepNum++,
        name: "INTENT CLASSIFICATION",
        detail: `${intent.intent} (${(intent.confidence * 100).toFixed(0)}%)`,
        data: { intent: intent.intent, entities: intent.entities },
      });
    }

    if (hints.session.turnCount > 0) {
      cotResult.steps.push({
        step: stepNum++,
        name: "CONVERSATION CONTEXT",
        detail: [
          hints.session.lastProduct ? `last product: ${hints.session.lastProduct}` : null,
          hints.session.lastAmount ? `last amount: ${hints.session.lastAmount}` : null,
          hints.session.lastParty ? `last party: ${hints.session.lastParty}` : null,
          hints.session.awaiting ? `awaiting: ${hints.session.awaiting}` : null,
        ]
          .filter(Boolean)
          .join("; ") || "No prior context",
        data: { session: hints.session },
      });
    }

    return cotResult;
  }
}
