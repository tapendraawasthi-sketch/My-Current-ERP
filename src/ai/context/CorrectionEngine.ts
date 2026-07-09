/** SUTRA AI — explicit user corrections to prior transaction context */

import type { ExtractedEntities, SessionState } from "../types";
import { entityExtractor } from "./EntityExtractor";
import { productCatalog } from "../knowledge/ProductCatalog";

export interface CorrectionResult {
  rewrittenInput: string;
  entities: ExtractedEntities;
  explanation: string;
}

export class CorrectionEngine {
  isCorrection(text: string, session: SessionState): boolean {
    if (session.turnCount < 1) return false;
    return (
      /\b(hoina|galat|wrong|actually|sachhi|nai)\b/i.test(text) ||
      /\bhoina,?\s+\d+/i.test(text)
    );
  }

  apply(text: string, session: SessionState, partial: ExtractedEntities): CorrectionResult | null {
    if (!this.isCorrection(text, session)) return null;

    const base = entityExtractor.mergeWithContext(
      { ...partial },
      session,
    );

    let product = base.product;
    let party = base.party;
    let amount = base.amount;

    const amountFix = text.match(/\b(\d+)\s+hoina\s+(\d+)\b/i) ?? text.match(/hoina,?\s+(\d+)\s*ko?/i);
    if (amountFix) {
      amount = parseInt(amountFix[amountFix.length - 1], 10);
    }

    const productFromText = this.extractProductToken(text);
    if (productFromText) product = productFromText;

    const partySwap = text.match(/\b([a-z]{2,15})\s+hoina\s+([a-z]{2,15})\b/i);
    if (partySwap) party = partySwap[2];

    const partyOnly = text.match(/\bparty\s+([a-z]{2,15})\b/i);
    if (partyOnly) party = partyOnly[1];

    if (!product && !party && amount == null) return null;

    const tx = base.transactionType ?? session.lastTransactionType ?? "sales";
    const verb = tx === "purchase" ? "kinya" : "bechye";
    const amt = amount ?? session.lastAmount ?? 500;
    const prod = product ?? session.lastProduct ?? "saman";
    let phrase = `maile ${amt} ko ${prod} ${verb}`;
    if (party ?? session.lastParty) phrase += ` ${party ?? session.lastParty} lai`;

    const entities = entityExtractor.extract(phrase);
    entities.transactionType = tx as ExtractedEntities["transactionType"];

    return {
      rewrittenInput: phrase,
      entities: { ...base, ...entities, amount: amt, product: prod, party: party ?? base.party },
      explanation: `Correction applied: ${phrase}`,
    };
  }

  private extractProductToken(text: string): string | undefined {
    const tokens = text.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
    for (const token of tokens) {
      if (/\b(hoina|galat|wrong|actually|thiyo|ho|party)\b/.test(token)) continue;
      const found = productCatalog.findProduct(token);
      if (found) return found.entry.romanVariants[0] ?? found.nepali;
    }
    const m = text.match(/\b(?:hoina|actually)\s+([a-z\u0900-\u097F]{2,20})\b/i);
    if (m) return m[1];
    return undefined;
  }
}

export const correctionEngine = new CorrectionEngine();
