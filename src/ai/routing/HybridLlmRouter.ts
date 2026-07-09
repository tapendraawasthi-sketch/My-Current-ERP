/** SUTRA AI — route to LLM only when rules are insufficient */

import type { IntentType } from "../types";

export interface LlmRouteDecision {
  useLlm: boolean;
  reason: string;
}

const RULE_SUFFICIENT_INTENTS: IntentType[] = [
  "SALES_ENTRY",
  "PURCHASE_ENTRY",
  "RETURN_ENTRY",
  "CONFIRMATION",
  "REJECTION",
  "CORRECTION",
];

export class HybridLlmRouter {
  decide(opts: {
    confidence: number;
    intent?: IntentType;
    needsClarification: boolean;
    validationFailed: boolean;
    llmOnline: boolean;
    useLlmRequested?: boolean;
    hasAmbiguousParty?: boolean;
    hasSuggestionPending?: boolean;
    hasBalanceAnswer?: boolean;
    hasErpQueryAnswer?: boolean;
  }): LlmRouteDecision {
    if (opts.useLlmRequested === false) {
      return { useLlm: false, reason: "LLM disabled by caller" };
    }
    if (!opts.llmOnline) {
      return { useLlm: false, reason: "LLM offline" };
    }
    if (opts.hasSuggestionPending) {
      return { useLlm: false, reason: "Awaiting user suggestion acceptance" };
    }
    if (opts.hasBalanceAnswer && opts.confidence >= 0.9) {
      return { useLlm: false, reason: "Balance resolved from ERP ledger RAG" };
    }
    if (opts.hasErpQueryAnswer && opts.confidence >= 0.9) {
      return { useLlm: false, reason: "ERP RAG query answered (stock/khata)" };
    }
    if (opts.validationFailed) {
      return { useLlm: true, reason: "Validation failed — LLM assist" };
    }
    if (opts.hasAmbiguousParty) {
      return { useLlm: true, reason: "Ambiguous party — LLM disambiguation" };
    }
    if (opts.needsClarification && opts.confidence < 0.7) {
      return { useLlm: true, reason: "Low confidence clarification" };
    }

    const intent = opts.intent ?? "OTHER";

    if (
      RULE_SUFFICIENT_INTENTS.includes(intent) &&
      opts.confidence >= 0.85 &&
      !opts.needsClarification
    ) {
      return { useLlm: false, reason: `Rules sufficient (${intent}, ${(opts.confidence * 100).toFixed(0)}%)` };
    }

    if (intent === "QUERY" || intent === "REPORT_REQUEST" || intent === "OTHER") {
      return { useLlm: true, reason: `Open-ended intent: ${intent}` };
    }

    if (opts.confidence < 0.85) {
      return { useLlm: true, reason: `Confidence ${(opts.confidence * 100).toFixed(0)}% < 85%` };
    }

    return { useLlm: false, reason: "Rule-based pipeline sufficient" };
  }
}

export const hybridLlmRouter = new HybridLlmRouter();
