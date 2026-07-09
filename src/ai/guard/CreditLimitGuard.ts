/** SUTRA AI — warn when credit sale exceeds party credit limit */

import type { ErpRagContext, ExtractedEntities, IntentClassification } from "../types";

export interface CreditLimitWarning {
  nepali: string;
  english: string;
  roman: string;
}

export class CreditLimitGuard {
  check(
    entities: ExtractedEntities,
    intent: IntentClassification | undefined,
    ctx?: ErpRagContext,
  ): CreditLimitWarning | null {
    const isCreditSale =
      intent?.intent === "SALES_ENTRY" ||
      entities.transactionType === "sales";
    if (!isCreditSale) return null;

    const isCash =
      entities.paymentMode === "cash" ||
      /\b(cash|nagad)\b/i.test(entities.paymentMode ?? "");
    if (isCash) return null;

    const isCredit =
      entities.paymentMode === "credit" ||
      /\b(udhaar|credit|udhar)\b/i.test(String(entities.paymentMode ?? ""));
    if (!isCredit && entities.paymentMode) return null;

    const partyName = entities.partyResolvedName ?? entities.party;
    const amount = entities.amount;
    if (!partyName || !amount || amount <= 0 || !ctx?.parties?.length) return null;

    const party = ctx.parties.find(
      (p) =>
        p.name.toLowerCase() === partyName.toLowerCase() ||
        partyName.toLowerCase().includes(p.name.toLowerCase()),
    );
    const limit = party?.creditLimit;
    if (!limit || limit <= 0) return null;

    const outstanding = Math.max(party?.balance ?? 0, 0);
    const projected = outstanding + amount;
    if (projected <= limit) return null;

    const limitLabel = limit.toLocaleString("en-NP");
    const projLabel = projected.toLocaleString("en-NP");
    const amtLabel = amount.toLocaleString("en-NP");

    return {
      nepali: `⚠️ ${partyName} को क्रेडिट सीमा Rs. ${limitLabel} — यो Rs. ${amtLabel} पछि कुल Rs. ${projLabel} हुन्छ।`,
      english: `⚠️ ${partyName} credit limit Rs. ${limitLabel} — after Rs. ${amtLabel} total would be Rs. ${projLabel}.`,
      roman: `⚠️ ${partyName} credit limit Rs. ${limitLabel} — Rs. ${amtLabel} pachhi kul Rs. ${projLabel} huncha.`,
    };
  }
}

export const creditLimitGuard = new CreditLimitGuard();
