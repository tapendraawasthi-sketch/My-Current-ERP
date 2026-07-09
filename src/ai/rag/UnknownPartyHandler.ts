/** SUTRA AI — detect unknown party and suggest clarification */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";

export class UnknownPartyHandler {
  needsHint(
    entities: ExtractedEntities,
    ctx?: ErpRagContext,
    intent?: IntentClassification,
  ): boolean {
    if (!entities.party || entities.partyResolvedName || entities.partyAmbiguous?.length) {
      return false;
    }
    if (!ctx?.parties?.length) return false;
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
    if (!this.needsHint(entities, ctx)) return null;

    const suggestions = (ctx?.parties ?? [])
      .slice(0, 4)
      .map((p) => p.name)
      .filter(Boolean);

    const nepali =
      `"${entities.party}" ERP मा फेला परेन।\n` +
      (suggestions.length
        ? `के यी मध्ये हो? ${suggestions.join(", ")}`
        : "पूरा पार्टी नाम लेख्नुहोस्।");

    const english =
      `Party "${entities.party}" not found in ERP.\n` +
      (suggestions.length ? `Did you mean: ${suggestions.join(", ")}?` : "Type the full party name.");

    const roman =
      `"${entities.party}" ERP ma fela parena. Full name lekhnuhos.`;

    return {
      understood_input: understoodInput,
      confidence: 0.72,
      needs_clarification: true,
      suggestions: [],
      response: { nepali, english, roman },
      followUp: nepali,
      quickReplies: suggestions.slice(0, 3).map((name, i) => ({
        id: `unk-${i}`,
        label: name,
        value: understoodInput.replace(new RegExp(entities.party!, "i"), name),
        kind: "party" as const,
      })),
    };
  }
}

export const unknownPartyHandler = new UnknownPartyHandler();
