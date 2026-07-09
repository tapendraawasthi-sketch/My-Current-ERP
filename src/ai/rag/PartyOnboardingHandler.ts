/** SUTRA AI — suggest creating a new party when not found in ERP */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";

export class PartyOnboardingHandler {
  shouldOffer(
    entities: ExtractedEntities,
    ctx?: ErpRagContext,
    intent?: IntentClassification,
  ): boolean {
    if (!entities.party || entities.partyResolvedName || entities.partyAmbiguous?.length) {
      return false;
    }
    if (!ctx?.parties?.length) return true;

    const hits = erpRagRetriever.findParties(entities.party, ctx.parties, 1);
    if (hits[0] && hits[0].score >= 0.55) return false;

    const isTxn =
      intent?.intent === "SALES_ENTRY" ||
      intent?.intent === "PURCHASE_ENTRY" ||
      entities.transactionType === "sales" ||
      entities.transactionType === "purchase" ||
      entities.transactionType === "receipt" ||
      entities.transactionType === "payment";
    return isTxn;
  }

  tryBuildResponse(
    entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    _outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.shouldOffer(entities, ctx)) return null;

    const name = entities.party!;
    const similar = (ctx?.parties ?? [])
      .slice(0, 3)
      .map((p) => p.name)
      .filter(Boolean);

    const nepali =
      `"${name}" ERP मा छैन।\n` +
      (similar.length ? `के यी मध्ये हो? ${similar.join(", ")}\n` : "") +
      `नयाँ पार्टी थप्न चाहनुहुन्छ?`;

    const english =
      `Party "${name}" is not in ERP.\n` +
      (similar.length ? `Did you mean: ${similar.join(", ")}?\n` : "") +
      `Would you like to create this party?`;

    const roman = `"${name}" ERP ma chaina. Naya party thapne?`;

    const quickReplies = [
      ...similar.slice(0, 2).map((partyName, i) => ({
        id: `sim-${i}`,
        label: partyName,
        value: understoodInput.replace(new RegExp(name, "i"), partyName),
        kind: "party" as const,
      })),
      {
        id: "create-party",
        label: "नयाँ पार्टी",
        value: `/create party ${name}`,
        kind: "query" as const,
      },
    ];

    return {
      understood_input: understoodInput,
      confidence: 0.74,
      needs_clarification: true,
      suggestions: [],
      response: { nepali, english, roman },
      followUp: nepali,
      quickReplies,
      actions: [
        {
          id: `party-new-${Date.now().toString(36)}`,
          type: "navigate",
          page: "parties",
          label: `Create ${name}`,
          labelNepali: `${name} थप्नुहोस्`,
        },
      ],
    };
  }
}

export const partyOnboardingHandler = new PartyOnboardingHandler();
