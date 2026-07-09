/** SUTRA AI — sales / purchase return entry polish */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import { actionExecutor } from "../actions/ActionExecutor";

const RETURN_PATTERNS = [
  /\b(firta|wapsi|return)\b/i,
  /\b(bikri|sales)\s+return\b/i,
  /\b(kharid|purchase)\s+return\b/i,
  /फिर्ता|वापसी/,
];

function formatAmount(n: number): string {
  return `Rs. ${n.toLocaleString("en-NP")}`;
}

export class ReturnTransactionHandler {
  isReturn(
    text: string,
    entities: ExtractedEntities,
    intent?: IntentClassification,
  ): boolean {
    if (intent?.intent === "RETURN_ENTRY" || entities.transactionType === "return") {
      return true;
    }
    return RETURN_PATTERNS.some((re) => re.test(text));
  }

  isPurchaseReturn(text: string): boolean {
    if (/\b(kharid|purchase)\s+return\b/i.test(text)) return true;
    if (/\b(kharid|kin)\s+firta\b/i.test(text)) return true;
    if (/\b(supplier|vendor)\b.*\b(firta|return|wapsi)\b/i.test(text)) return true;
    return (
      /\b(kharid|purchase|kin|kinyo|supplier)\b/i.test(text) &&
      /\b(firta|return|wapsi)\b/i.test(text)
    );
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    _ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isReturn(text, entities, intent)) return null;

    if (entities.partyAmbiguous?.length) return null;

    const product = entities.product ?? entities.productEnglish;
    const amount = entities.amount;
    const party = entities.partyResolvedName ?? entities.party;
    const purchaseReturn = this.isPurchaseReturn(text);

    if (
      purchaseReturn &&
      _ctx?.parties?.length &&
      entities.party &&
      !entities.partyResolvedName
    ) {
      const supplierPool = _ctx.parties.filter((p) => {
        const t = (p.type ?? "").toLowerCase();
        return t.includes("supplier") || t.includes("both") || !t;
      });
      const hits = erpRagRetriever.findParties(entities.party, supplierPool, 4);
      if (hits.length >= 2 && hits[0].score < 0.92) {
        const names = hits.slice(0, 4).map((h) => h.ref.name);
        return {
          understood_input: understoodInput,
          confidence: 0.74,
          needs_clarification: true,
          suggestions: [],
          response: {
            nepali: `कुन supplier? ${names.join(" वा ")} — तलबाट छान्नुहोस्।`,
            english: `Which supplier? ${names.join(" or ")} — pick below.`,
            roman: `Kun supplier? ${names.join(" or ")} — tala bata channus.`,
          },
          followUp: "कुन supplier?",
          quickReplies: names.map((name, i) => ({
            id: `sup-${i}-${name.slice(0, 8)}`,
            label: name,
            value: `${name} bata ${amount ?? ""} ko ${product ?? "saman"} firta`.replace(/\s+/g, " ").trim(),
            kind: "party" as const,
          })),
        };
      }
    }

    if (!product || amount == null || amount <= 0) {
      return {
        understood_input: understoodInput,
        confidence: 0.72,
        needs_clarification: true,
        suggestions: [],
        response: {
          nepali: "फिर्ताको लागि सामान र रकम/मात्रा भन्नुहोस्। उदाहरण: `maile 200 ko kakro firta`",
          english: "For a return, specify item and amount/qty. Example: `maile 200 ko kakro firta`",
          roman: "Firta ko lagi item ra amount bhannus.",
        },
        followUp: "कति को के फिर्ता?",
      };
    }

    const returnEntities: ExtractedEntities = {
      ...entities,
      transactionType: "return",
    };

    const kind = purchaseReturn ? "खरिद फिर्ता" : "बिक्री फिर्ता";
    const kindEn = purchaseReturn ? "Purchase return" : "Sales return";
    const amt = formatAmount(amount);
    const partyLine = party ? ` · ${party}` : "";

    const actions = actionExecutor.resolve(
      "RETURN_ENTRY",
      returnEntities,
      understoodInput,
      false,
    ).map((a) =>
      purchaseReturn && a.invoiceType === "purchase-return"
        ? { ...a, label: "Create Purchase Return", labelNepali: "खरिद फिर्ता बिल" }
        : a,
    );
    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: {
        nepali: `${kind}: ${product} ${amt}${partyLine}`,
        english: `${kindEn}: ${product} ${amt}${partyLine}`,
        roman: `${kindEn}: ${product} ${amt}${partyLine}`,
      },
      sourceLanguage: "roman",
      transaction: {
        type: "return",
        party,
        amount,
        product,
      },
      actions: actions.length ? actions : undefined,
    };
  }
}

export const returnTransactionHandler = new ReturnTransactionHandler();
