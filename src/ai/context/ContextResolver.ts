/** SUTRA AI — multi-turn reference resolution (pronouns, demonstratives, continuations) */

import type { ExtractedEntities, ResolvedInput, SessionState } from "../types";
import {
  matchContextTriggerExact,
  matchContextResolutionHeuristic,
  resolveContextUtterance,
  type ContextDiscourseState,
} from "@/lib/nepal-ai/contextResolution";
import { romanNepaliProcessor } from "../language/RomanNepaliProcessor";

const DEMONSTRATIVE_RESOLVERS: Array<{
  re: RegExp;
  resolve: (session: SessionState) => string | undefined;
  type: ResolvedInput["resolutionType"];
  replace: (text: string, value: string) => string;
}> = [
  {
    re: /\btyo\s+saman\b/i,
    resolve: (s) => s.lastProduct,
    type: "demonstrative",
    replace: (t, v) => t.replace(/\btyo\s+saman\b/gi, v),
  },
  {
    re: /\bferi\s+tyahi\b/i,
    resolve: (s) => s.lastUserText,
    type: "repeat",
    replace: (_t, v) => v,
  },
  {
    re: /\btyo\s+lai\b/i,
    resolve: (s) => s.lastParty,
    type: "pronoun",
    replace: (t, v) => t.replace(/\btyo\s+lai\b/gi, `${v} lai`),
  },
  {
    re: /\btyo\s+le\b/i,
    resolve: (s) => s.lastParty,
    type: "pronoun",
    replace: (t, v) => t.replace(/\btyo\s+le\b/gi, `${v} le`),
  },
];

export class ContextResolver {
  resolve(input: string, session: SessionState): ResolvedInput {
    const normalized = romanNepaliProcessor.normalize(input);
    let resolved = normalized;
    let wasResolved = false;
    let resolutionType: ResolvedInput["resolutionType"];
    let explanation: string | undefined;

    const discourseState = this.toDiscourseState(session);
    const pattern =
      matchContextTriggerExact(normalized) ??
      matchContextResolutionHeuristic(normalized, discourseState);

    if (pattern) {
      const result = resolveContextUtterance(normalized, discourseState, pattern);
      if (result?.resolvedText && result.resolvedText !== normalized) {
        resolved = result.resolvedText;
        wasResolved = true;
        resolutionType = this.mapFamily(result.family);
        explanation = `Context: ${result.pattern.patternName ?? result.family}`;
      }
    }

    if (!wasResolved) {
      for (const rule of DEMONSTRATIVE_RESOLVERS) {
        if (!rule.re.test(normalized)) continue;
        const value = rule.resolve(session);
        if (!value) continue;
        resolved = rule.replace(normalized, value);
        wasResolved = true;
        resolutionType = rule.type;
        explanation = `Resolved to "${value}"`;
        break;
      }
    }

    if (!wasResolved && /^\d+$/.test(normalized.trim())) {
      const amount = normalized.trim();
      const product = session.lastProduct;
      const hasSalesContext =
        session.awaiting === "amount" ||
        session.lastIntent === "SALES_ENTRY" ||
        session.lastIntent === "PURCHASE_ENTRY";

      if (product && hasSalesContext) {
        const verb = session.lastTransactionType === "purchase" ? "kinyo" : "bechye";
        resolved = `maile ${amount} ko ${product} ${verb}`;
        wasResolved = true;
        resolutionType = "continuation";
        explanation = `Amount continuation: Rs. ${amount}`;
      }
    }

    if (!wasResolved && session.lastProduct) {
      const m = normalized.match(/^(\d+)\s*ko\s+(bechye|becheko|kinyo|kineko)$/i);
      if (m) {
        resolved = `maile ${m[1]} ko ${session.lastProduct} ${m[2]}`;
        wasResolved = true;
        resolutionType = "continuation";
        explanation = `Used last product: ${session.lastProduct}`;
      }
    }

    const correction = normalized.match(/^hoina,?\s+(\d+)\s*ko?\b/i);
    if (correction && session.lastUserText) {
      resolved = session.lastUserText.replace(/\d+\s*ko/i, `${correction[1]} ko`);
      wasResolved = true;
      resolutionType = "correction";
      explanation = `Corrected amount to Rs. ${correction[1]}`;
    }

    return { original: input, resolved, wasResolved, resolutionType, explanation };
  }

  fillEntitiesFromSession(
    entities: ExtractedEntities,
    session: SessionState,
  ): ExtractedEntities {
    return {
      ...entities,
      product: entities.product ?? session.lastProduct,
      productNepali: entities.productNepali ?? session.lastProductNepali,
      amount: entities.amount ?? session.lastAmount,
      quantity: entities.quantity ?? session.lastQuantity,
      unit: entities.unit ?? session.lastUnit,
      party: entities.party ?? session.lastParty,
    };
  }

  private toDiscourseState(session: SessionState): ContextDiscourseState {
    return {
      lastParty: session.lastParty ?? null,
      lastAmount: session.lastAmount ?? null,
      lastIntent: session.lastIntent ?? null,
      lastUserText: session.lastUserText ?? null,
      awaiting: session.awaiting ?? null,
    };
  }

  private mapFamily(family: string): ResolvedInput["resolutionType"] {
    if (family === "pronoun" || family === "demonstrative") return "pronoun";
    if (family === "correction") return "correction";
    if (family === "confirm" || family === "affirm") return "continuation";
    return "continuation";
  }
}

export const contextResolver = new ContextResolver();
