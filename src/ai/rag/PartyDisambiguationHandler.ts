/** SUTRA AI — party name disambiguation with quick-reply options */

import type {
  AIResponse,
  ExtractedEntities,
  IntentClassification,
  IntentType,
  LanguageCode,
  QuickReply,
} from "../types";

const TX_INTENTS: IntentType[] = ["SALES_ENTRY", "PURCHASE_ENTRY", "RETURN_ENTRY", "QUERY"];

export class PartyDisambiguationHandler {
  needsDisambiguation(entities: ExtractedEntities, intent?: IntentClassification): boolean {
    if (!entities.partyAmbiguous?.length) return false;
    if (entities.partyResolvedName) return false;
    if (intent && TX_INTENTS.includes(intent.intent)) return true;
    return Boolean(entities.party && entities.amount);
  }

  buildQuickReplies(parties: string[]): QuickReply[] {
    return parties.slice(0, 4).map((name, i) => ({
      id: `party-${i}-${name.slice(0, 8)}`,
      label: name,
      value: name,
      kind: "party",
    }));
  }

  tryBuildResponse(
    entities: ExtractedEntities,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.needsDisambiguation(entities, intent)) return null;

    const options = entities.partyAmbiguous!;
    const list = options.join(" वा ");

    const nepali = `कुन पार्टी हो? ${list} — तलबाट छान्नुहोस् वा पूरा नाम लेख्नुहोस्।`;
    const english = `Which party? ${options.join(" or ")} — pick below or type the full name.`;
    const roman = `Kun party? ${options.join(" or ")} — tala bata channus.`;

    return {
      understood_input: understoodInput,
      confidence: 0.75,
      needs_clarification: true,
      suggestions: [],
      response: {
        nepali,
        english,
        roman,
      },
      followUp: nepali,
      quickReplies: this.buildQuickReplies(options),
      actions: undefined,
    };
  }
}

export const partyDisambiguationHandler = new PartyDisambiguationHandler();
