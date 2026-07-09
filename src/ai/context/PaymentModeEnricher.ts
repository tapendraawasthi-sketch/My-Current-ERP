/** SUTRA AI — infer payment mode when not explicitly stated */

import type { ExtractedEntities } from "../types";

export class PaymentModeEnricher {
  enrich(entities: ExtractedEntities, input: string): ExtractedEntities {
    if (entities.paymentMode && entities.paymentMode !== "unknown") {
      return entities;
    }

    const lower = input.toLowerCase();
    const enriched = { ...entities };

    if (/\b(nagad|cash|rokka)\b/i.test(lower) || /\bcash\s+ma\b/i.test(lower)) {
      enriched.paymentMode = "cash";
      return enriched;
    }
    if (/\b(bank|cheque|check|online|esewa|khalti|transfer|connect\s*ips)\b/i.test(lower)) {
      enriched.paymentMode = "bank";
      return enriched;
    }
    if (/\b(udhaar|udhar|credit|dhari)\b/i.test(lower)) {
      enriched.paymentMode = "credit";
      return enriched;
    }

    const isSale =
      entities.transactionType === "sales" ||
      entities.verb === "sold" ||
      entities.verb === "sell" ||
      /\b(bechye|becheko|bechya|bech)\b/i.test(lower);

    if (isSale) {
      if (entities.party && /\blai\b/i.test(lower)) {
        enriched.paymentMode = "credit";
        return enriched;
      }
      if (!entities.party) {
        enriched.paymentMode = "cash";
        return enriched;
      }
    }

    const isPurchase =
      entities.transactionType === "purchase" ||
      entities.verb === "bought" ||
      entities.verb === "buy" ||
      /\b(kinya|kineko|kinna)\b/i.test(lower);

    if (isPurchase && entities.party && /\bbata\b/i.test(lower) && !enriched.paymentMode) {
      enriched.paymentMode = "credit";
    }

    return enriched;
  }
}

export const paymentModeEnricher = new PaymentModeEnricher();
