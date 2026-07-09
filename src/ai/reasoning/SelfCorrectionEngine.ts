/** SUTRA AI — 2-pass self-correction against session contradictions */

import type { ExtractedEntities, SessionState } from "../types";

export interface SelfCorrectionResult {
  entities: ExtractedEntities;
  followUp?: string;
  note?: string;
  reduceConfidence?: boolean;
}

const PRODUCT_CHANGE_MARKERS =
  /\b(aba|ahile|change|instead|arka|aruko|now|replace|feri|nayaa|new)\b/i;

export class SelfCorrectionEngine {
  review(
    input: string,
    entities: ExtractedEntities,
    session: SessionState,
  ): SelfCorrectionResult {
    const result: SelfCorrectionResult = { entities: { ...entities } };

    if (session.turnCount < 1) return result;

    const lastProduct = session.lastProduct?.toLowerCase();
    const newProduct = entities.product?.toLowerCase();

    if (
      lastProduct &&
      newProduct &&
      lastProduct !== newProduct &&
      !PRODUCT_CHANGE_MARKERS.test(input) &&
      (entities.transactionType === "sales" || entities.transactionType === "purchase")
    ) {
      result.followUp =
        `अघिल्लो वस्तु "${session.lastProduct}" थियो — के अब "${entities.product}" हो?`;
      result.note = `Product changed: ${session.lastProduct} → ${entities.product}`;
      result.reduceConfidence = true;
    }

    if (
      session.lastAmount != null &&
      entities.amount != null &&
      session.lastProduct === entities.product &&
      entities.amount >= session.lastAmount * 10 &&
      session.lastAmount > 0
    ) {
      result.followUp =
        `रकम ${entities.amount.toLocaleString("en-NP")} अघिल्लो ${session.lastAmount.toLocaleString("en-NP")} भन्दा धेरै छ — सही हो?`;
      result.note = `Amount jump: ${session.lastAmount} → ${entities.amount}`;
      result.reduceConfidence = true;
    }

    if (
      session.lastParty &&
      entities.party &&
      session.lastParty.toLowerCase() !== entities.party.toLowerCase() &&
      !entities.partyResolvedName &&
      /\b(lai|le|ko)\b/i.test(input) &&
      !PRODUCT_CHANGE_MARKERS.test(input)
    ) {
      result.followUp =
        `पहिले "${session.lastParty}" थियो — अब "${entities.party}" हो?`;
      result.note = `Party changed: ${session.lastParty} → ${entities.party}`;
      result.reduceConfidence = true;
    }

    return result;
  }
}

export const selfCorrectionEngine = new SelfCorrectionEngine();
